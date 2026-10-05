import { describe, expect, it } from 'vitest';
import {
  axisRoots,
  blurDiameter,
  computeScene,
  parallelDof,
  traceLimit,
  TILT_EPS_DEG,
} from './model';
import { deg2rad, fromMm, lineIntersect, toMm } from './geometry';
import type { SceneInput } from './types';

const input = (p: Partial<SceneInput>): SceneInput => ({
  focalLength_mm: 50,
  fNumber: 8,
  tilt_deg: 0,
  focusDistance_mm: 2000,
  coc_mm: 0.03,
  ...p,
});

describe('单位切换', () => {
  it('mm/cm/m 往返一致', () => {
    expect(toMm(50, 'mm')).toBe(50);
    expect(toMm(2, 'm')).toBe(2000);
    expect(fromMm(toMm(3.7, 'm'), 'm')).toBeCloseTo(3.7, 12);
    expect(fromMm(toMm(80, 'cm'), 'cm')).toBeCloseTo(80, 12);
  });
});

describe('零倾角回归：解析薄透镜', () => {
  const f = 50;
  const N = 8;
  const c = 0.03;
  const s = 2000;

  it('像距回归 1/f = 1/s + 1/v', () => {
    const r = computeScene(input({}));
    const vExpected = (f * s) / (s - f);
    expect(r.v_mm).toBeCloseTo(vExpected, 6);
    expect(1 / f).toBeCloseTo(1 / s + 1 / r.v_mm, 10);
  });

  it('超焦距与近/远景深公式', () => {
    const d = parallelDof(f, N, c, s);
    const H = (f * f) / (N * c) + f;
    expect(d.hyperfocal).toBeCloseTo(H, 6);
    expect(d.near).toBeCloseTo((s * (H - f)) / (H + s - 2 * f), 6);
    expect(d.far).toBeCloseTo((s * (H - f)) / (H - s), 6);
  });

  it('对超焦距对焦时远景深为无穷远', () => {
    const H = parallelDof(f, N, c, 1000).hyperfocal;
    const d = parallelDof(f, N, c, H);
    expect(d.far).toBe(Infinity);
    expect(d.near).toBeCloseTo(H / 2, 1);
  });

  it('数值弥散根与解析景深一致（同口径核）', () => {
    const r = computeScene(input({}));
    const roots = axisRoots(s, 1, 0, f, r.v_mm, f / (2 * N), c);
    const d = parallelDof(f, N, c, s);
    expect(roots.near).not.toBeNull();
    expect(roots.far).not.toBeNull();
    expect(Math.abs(roots.near! - d.near) / d.near).toBeLessThan(2e-3);
    expect(Math.abs(roots.far! - d.far) / d.far).toBeLessThan(2e-3);
  });

  it('合焦面上轴点弥散为零；离焦点弥散符号正确', () => {
    const r = computeScene(input({}));
    const rho = f / (2 * N);
    expect(blurDiameter(s, 0, 1, 0, f, r.v_mm, rho).diameter_mm).toBeLessThan(1e-9);
    expect(blurDiameter(d_near(f, N, c, s) - 10, 0, 1, 0, f, r.v_mm, rho).diameter_mm).toBeGreaterThan(c);
    expect(blurDiameter(d_far(f, N, c, s) + 10, 0, 1, 0, f, r.v_mm, rho).diameter_mm).toBeGreaterThan(c);
  });

  it('θ→0 小角分支仍判定 parallel 且结果连续', () => {
    const r0 = computeScene(input({ tilt_deg: 0 }));
    const r1 = computeScene(input({ tilt_deg: TILT_EPS_DEG / 2 }));
    expect(r1.branch).toBe('parallel');
    expect(r1.v_mm).toBeCloseTo(r0.v_mm, 8);
  });
});

function d_near(f: number, N: number, c: number, s: number) {
  return parallelDof(f, N, c, s).near;
}
function d_far(f: number, N: number, c: number, s: number) {
  return parallelDof(f, N, c, s).far;
}

describe('Scheimpflug：已知平面与交线核验', () => {
  const p = input({ tilt_deg: 4, focusDistance_mm: 1500 });

  it('分支判定与像距公式 v=fs/(s·cosθ−f)', () => {
    const r = computeScene(p);
    expect(r.branch).toBe('scheimpflug');
    const cs = Math.cos(deg2rad(4));
    const v = (50 * 1500) / (1500 * cs - 50);
    expect(r.v_mm).toBeCloseTo(v, 6);
  });

  it('合焦面上多点弥散为零（整平面合焦，而非仅轴点）', () => {
    const r = computeScene(p);
    const rho = r.apertureRadius_mm;
    const cs = Math.cos(deg2rad(4));
    const sn = Math.sin(deg2rad(4));
    // 合焦面 x/s - sinθ/f · y = 1 → x = s(1 + sinθ/f · y)
    for (const y of [-400, -200, 0, 200, 400]) {
      const x = 1500 * (1 + (sn / 50) * y);
      const b = blurDiameter(x, y, cs, sn, 50, r.v_mm, rho);
      expect(b.diameter_mm).toBeLessThan(1e-7);
    }
  });

  it('Scheimpflug 点：传感器、透镜、合焦面三面共线（剖面共点）', () => {
    const r = computeScene(p);
    expect(r.scheimpflugPoint).not.toBeNull();
    expect(r.focalPlaneLine).not.toBeNull();
    const lensSensor = lineIntersect(r.lensLine, r.sensorLine);
    expect(lensSensor).not.toBeNull();
    expect(lensSensor!.point.x).toBeCloseTo(r.scheimpflugPoint!.x, 6);
    expect(lensSensor!.point.y).toBeCloseTo(r.scheimpflugPoint!.y, 4);
    // 合焦面也经过同一点
    const lensFocal = lineIntersect(r.lensLine, r.focalPlaneLine!);
    expect(lensFocal!.point.x).toBeCloseTo(r.scheimpflugPoint!.x, 4);
    expect(lensFocal!.point.y).toBeCloseTo(r.scheimpflugPoint!.y, 2);
  });

  it('铰链点位于前焦面 q=f 且在合焦面上，垂直距离 J=f/sinθ', () => {
    const r = computeScene(p);
    const J = r.hingePoint!;
    const cs = Math.cos(deg2rad(4));
    const sn = Math.sin(deg2rad(4));
    expect(J.x).toBeCloseTo(0, 9);
    expect(J.y).toBeCloseTo(-50 / sn, 6);
    // q = cosθ·Jx − sinθ·Jy = f
    expect(cs * J.x - sn * J.y).toBeCloseTo(50, 8);
    // x/s - sinθ/f·y = 1
    expect(J.x / 1500 - (sn / 50) * J.y).toBeCloseTo(1, 8);
  });

  it('景深极限等值线核验为过铰链点的直线', () => {
    const r = computeScene(p);
    const roots = axisRoots(1500, Math.cos(deg2rad(4)), Math.sin(deg2rad(4)), 50, r.v_mm, r.apertureRadius_mm, 0.03);
    expect(roots.near).not.toBeNull();
    const tr = traceLimit(roots.near!, r.hingePoint!, Math.cos(deg2rad(4)), Math.sin(deg2rad(4)), 50, r.v_mm, r.apertureRadius_mm, 0.03);
    expect(tr.planar).toBe(true);
    expect(tr.maxResidual_mm).toBeLessThan(0.5);
  });

  it('倾角→0 时 Scheimpflug 结果连续回归平行情形', () => {
    const rPara = computeScene(input({ tilt_deg: 0 }));
    const rTiny = computeScene(input({ tilt_deg: 0.02 }));
    expect(rTiny.branch).toBe('scheimpflug');
    expect(rTiny.v_mm).toBeCloseTo(rPara.v_mm, 3);
    const rel = (a: number, b: number) => Math.abs(a - b) / b;
    expect(rel(rTiny.nearLimit.axisDistance_mm!, rPara.nearLimit.axisDistance_mm!)).toBeLessThan(2e-3);
    expect(rel(rTiny.farLimit.axisDistance_mm!, rPara.farLimit.axisDistance_mm!)).toBeLessThan(2e-3);
  });
});

describe('二维/三维同步：同一 computeScene 的平面与直线一致', () => {
  it('三维平面拉伸自二维直线（法向与共点一致）', () => {
    const r = computeScene(input({ tilt_deg: 5, focusDistance_mm: 2000 }));
    expect(r.focalPlane).not.toBeNull();
    expect(r.focalPlaneLine).not.toBeNull();
    // 平面法向 = (dir_y, -dir_x, 0)
    const n = r.focalPlane!.normal;
    expect(n[0]).toBeCloseTo(r.focalPlaneLine!.dir.y, 10);
    expect(n[1]).toBeCloseTo(-r.focalPlaneLine!.dir.x, 10);
    expect(n[2]).toBe(0);
    // 平面点在直线上
    const p = r.focalPlane!.point;
    const d = r.focalPlaneLine!.dir;
    const cross = (p[0] - r.focalPlaneLine!.point.x) * d.y - (p[1] - r.focalPlaneLine!.point.y) * d.x;
    expect(Math.abs(cross)).toBeLessThan(1e-9);
    // 景深平面同样由其二维直线拉伸
    for (const lim of [r.nearLimit, r.farLimit]) {
      expect(lim.plane).not.toBeNull();
      expect(lim.line).not.toBeNull();
      expect(lim.plane!.normal[0]).toBeCloseTo(lim.line!.dir.y, 10);
      expect(lim.plane!.normal[1]).toBeCloseTo(-lim.line!.dir.x, 10);
    }
    // 三维合焦面经过 Scheimpflug 点（n·(S−p)=0）
    const S = r.scheimpflugPoint!;
    const val = n[0] * (S.x - p[0]) + n[1] * (S.y - p[1]);
    expect(Math.abs(val)).toBeLessThan(1e-6);
  });
});

describe('适用范围：奇异角度/范围外停止精确结果', () => {
  it('倾角超界不给出几何结果', () => {
    const r = computeScene(input({ tilt_deg: 20 }));
    expect(r.applicable).toBe(false);
    expect(r.focalPlane).toBeNull();
    expect(r.errors.join()).toContain('范围');
  });

  it('s·cosθ≤f 判定不能成实像', () => {
    // 50.5·cos8°≈50.01 < f·1.001=50.05 → 触发（倾角仍在机械范围内）
    const r = computeScene(input({ tilt_deg: 8, focusDistance_mm: 50.5 }));
    expect(r.applicable).toBe(false);
    expect(r.errors.join()).toContain('实像');
  });

  it('零/负输入直接拒绝', () => {
    expect(computeScene(input({ focalLength_mm: 0 })).applicable).toBe(false);
    expect(computeScene(input({ coc_mm: -1 })).applicable).toBe(false);
  });

  it('F/1.2 仍计算但触发近轴警告；F/0.8 拒绝', () => {
    const r = computeScene(input({ fNumber: 1.2 }));
    expect(r.applicable).toBe(true);
    expect(r.warnings.join()).toContain('近轴');
    expect(computeScene(input({ fNumber: 0.8 })).applicable).toBe(false);
  });
});
