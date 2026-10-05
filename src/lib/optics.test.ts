/**
 * 模型核验：
 *  1. 零倾角回归 —— 平行模式与标准超焦距景深公式一致；
 *  2. 已知平面 —— Scheimpflug 三平面共线、铰链规则 J=f/sinθ、焦平面过已知点；
 *  3. 对焦距离 —— 沿镜头法线的薄透镜方程成立；
 *  4. 单位切换 —— mm/m 换算不改变几何结果；
 *  5. 奇异与越界 —— 停止给出精确结果。
 */
import { describe, expect, it } from 'vitest';
import { computeOptics, MAX_TILT_DEG, type LensParams } from './optics';
import { fromDisplay, toDisplay } from './units';

const DEG = Math.PI / 180;

const parallelBase: LensParams = {
  focalLength: 50,
  fNumber: 8,
  tiltDeg: 0,
  focusDistance: 5000,
  coc: 0.03
};

const tiltedBase: LensParams = {
  focalLength: 50,
  fNumber: 8,
  tiltDeg: 5,
  focusDistance: 2000,
  coc: 0.03
};

describe('零倾角回归（普通平行焦面）', () => {
  it('景深与标准超焦距公式一致', () => {
    const r = computeOptics(parallelBase);
    expect(r.valid).toBe(true);
    expect(r.mode).toBe('parallel');
    const { focalLength: f, fNumber: N, coc: c, focusDistance: u } = parallelBase;
    const H = f + (f * f) / (N * c);
    const dNear = (u * (H - f)) / (H + u - 2 * f);
    const dFar = (u * (H - f)) / (H - u);
    expect(r.nearDistance).toBeCloseTo(dNear, 8);
    expect(r.farDistance).toBeCloseTo(dFar, 8);
    expect(r.hyperfocal).toBeCloseTo(H, 10);
  });

  it('像距满足薄透镜方程 1/u + 1/s′ = 1/f', () => {
    const r = computeOptics(parallelBase);
    expect(1 / parallelBase.focusDistance + 1 / r.imageDistance).toBeCloseTo(
      1 / parallelBase.focalLength,
      12
    );
  });

  it('对焦距离达到/超过超焦距时远端为无穷远', () => {
    const r = computeOptics({ ...parallelBase, focusDistance: 20000 });
    expect(r.valid).toBe(true);
    expect(r.farDistance).toBe(Infinity);
    expect(r.farPlane).toBeNull();
  });

  it('焦平面为平行于传感器的平面 z = −u', () => {
    const r = computeOptics(parallelBase);
    expect(r.focusPlane).toEqual({ slope: 0, intercept: -parallelBase.focusDistance });
    expect(r.focusPlaneTiltDeg).toBe(0);
  });
});

describe('Scheimpflug 情形（已知平面核验）', () => {
  it('像距满足沿镜头法线的薄透镜方程', () => {
    const r = computeOptics(tiltedBase);
    expect(r.valid).toBe(true);
    expect(r.mode).toBe('scheimpflug');
    const theta = tiltedBase.tiltDeg * DEG;
    const dO = tiltedBase.focusDistance * Math.cos(theta);
    const dI = r.imageDistance * Math.cos(theta);
    expect(1 / dO + 1 / dI).toBeCloseTo(1 / tiltedBase.focalLength, 10);
  });

  it('三平面共线：焦平面过 Scheimpflug 点（镜头平面 ∩ 传感器平面）', () => {
    const r = computeOptics(tiltedBase);
    const S = r.scheimpflugPoint!;
    const theta = tiltedBase.tiltDeg * DEG;
    // S 在传感器平面上
    expect(S.z).toBeCloseTo(r.imageDistance, 10);
    // S 在镜头平面上：x·sinθ + z·cosθ = 0
    expect(S.x * Math.sin(theta) + S.z * Math.cos(theta)).toBeCloseTo(0, 10);
    // S 在焦平面上
    expect(r.focusPlane!.slope * S.x + r.focusPlane!.intercept).toBeCloseTo(S.z, 8);
  });

  it('铰链规则：J = f/sinθ，焦平面与景深界面均过铰链点', () => {
    const r = computeOptics(tiltedBase);
    const H = r.hinge!;
    expect(Math.abs(H.x)).toBeCloseTo(tiltedBase.focalLength / Math.sin(tiltedBase.tiltDeg * DEG), 8);
    expect(H.z).toBe(0);
    for (const plane of [r.focusPlane, r.nearPlane, r.farPlane]) {
      expect(plane!.slope * H.x + plane!.intercept).toBeCloseTo(H.z, 8);
    }
  });

  it('焦平面过已知点 (0, −u)，斜率 tanψ = (u/f)·sinθ', () => {
    const r = computeOptics(tiltedBase);
    const theta = tiltedBase.tiltDeg * DEG;
    const expectedSlope = -(tiltedBase.focusDistance / tiltedBase.focalLength) * Math.sin(theta);
    expect(r.focusPlane!.intercept).toBeCloseTo(-tiltedBase.focusDistance, 10);
    expect(r.focusPlane!.slope).toBeCloseTo(expectedSlope, 12);
    expect(Math.abs(r.focusPlaneTiltDeg)).toBeCloseTo(
      Math.abs((Math.atan(expectedSlope) * 180) / Math.PI),
      10
    );
  });

  it('小倾角极限回归平行模式（连续性）', () => {
    const a = computeOptics({ ...parallelBase });
    const b = computeOptics({ ...parallelBase, tiltDeg: 0.001 });
    expect(b.mode).toBe('scheimpflug');
    expect(b.nearDistance).toBeCloseTo(a.nearDistance, 1);
    expect(b.farDistance).toBeCloseTo(a.farDistance, 1);
    expect(b.imageDistance).toBeCloseTo(a.imageDistance, 4);
  });
});

describe('单位切换核验', () => {
  it('mm 与 m 输入同一物理场景，几何结果一致', () => {
    const mm = computeOptics({ focalLength: 50, fNumber: 2.8, tiltDeg: 5, focusDistance: 1500, coc: 0.03 });
    const m = computeOptics({
      focalLength: fromDisplay(0.05, 'm'),
      fNumber: 2.8,
      tiltDeg: 5,
      focusDistance: fromDisplay(1.5, 'm'),
      coc: fromDisplay(0.00003, 'm')
    });
    expect(m.valid).toBe(true);
    expect(m.imageDistance).toBeCloseTo(mm.imageDistance, 10);
    expect(m.focusPlane!.slope).toBeCloseTo(mm.focusPlane!.slope, 12);
    expect(m.nearDistance).toBeCloseTo(mm.nearDistance, 8);
    expect(m.farDistance).toBeCloseTo(mm.farDistance, 8);
    expect(toDisplay(mm.nearDistance, 'm')).toBeCloseTo(m.nearDistance / 1000, 10);
  });

  it('单位换算互逆', () => {
    expect(fromDisplay(toDisplay(1234.5, 'm'), 'm')).toBeCloseTo(1234.5, 10);
    expect(toDisplay(1000, 'm')).toBeCloseTo(1, 12);
  });
});

describe('奇异角度与模型适用范围之外：停止给出精确结果', () => {
  it('物距沿法线分量不大于焦距（u·cosθ ≤ f）判定无效', () => {
    const r = computeOptics({ ...tiltedBase, focusDistance: 40 });
    expect(r.valid).toBe(false);
    expect(r.focusPlane).toBeNull();
    expect(r.errors.length).toBeGreaterThan(0);
  });

  it('平行模式下 u ≤ f 判定无效', () => {
    const r = computeOptics({ ...parallelBase, focusDistance: 50 });
    expect(r.valid).toBe(false);
  });

  it('倾角超出 ±MAX_TILT_DEG 判定无效', () => {
    const r = computeOptics({ ...tiltedBase, tiltDeg: MAX_TILT_DEG + 1 });
    expect(r.valid).toBe(false);
    expect(r.errors.join('')).toContain('超出');
  });

  it('非法输入（负焦距/负光圈/负 CoC）判定无效', () => {
    expect(computeOptics({ ...tiltedBase, focalLength: -50 }).valid).toBe(false);
    expect(computeOptics({ ...tiltedBase, fNumber: 0 }).valid).toBe(false);
    expect(computeOptics({ ...tiltedBase, coc: -0.03 }).valid).toBe(false);
  });

  it('N·c/f ≥ 1 时给出警告且近端面退化为前焦平面', () => {
    const r = computeOptics({ ...tiltedBase, coc: 4 }); // k = 8*4/50 = 0.64 <1，先验证不触发
    expect(r.warnings.length).toBe(0);
    const r2 = computeOptics({ ...tiltedBase, coc: 8 }); // k = 1.28 ≥ 1
    expect(r2.valid).toBe(true);
    expect(r2.warnings.join('')).toContain('焦深公差过大');
    const theta = tiltedBase.tiltDeg * DEG;
    expect(r2.nearPlane!.slope).toBeCloseTo(-Math.tan(theta), 10);
    expect(r2.nearPlane!.intercept).toBeCloseTo(-tiltedBase.focalLength / Math.cos(theta), 8);
  });
});
