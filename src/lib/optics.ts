/**
 * 薄透镜近轴（高斯）模型：移轴（tilt）情形下的焦平面与景深计算。
 *
 * 坐标约定（剖面坐标，y 为俯仰轴/倾斜转轴，垂直于剖面）：
 *  - 镜头中心位于原点，z 轴沿相机光轴，被摄体在 z < 0 一侧，传感器在 z = s' 处且垂直于 z 轴；
 *  - 镜头绕 y 轴倾斜 θ（tiltDeg），x 为剖面内的横向坐标；
 *  - 所有长度内部统一为 mm。
 *
 * 推导要点（薄透镜、近轴、距离沿镜头法线方向度量）：
 *  - 轴上物距 u 时像距 s' = f·u / (u·cosθ − f)；
 *  - 清晰焦平面（物方）为直线 z = −u − (u·sinθ/f)·x，过铰链点 H=(−f/sinθ, 0)
 *    与 Scheimpflug 点 S（镜头平面与传感器平面的交点）；
 *  - 像方焦深容差 ±N·c（N 光圈值，c 弥散圈直径）映射为物方过铰链线的两个平面，
 *    即景深楔形的近/远边界。
 *
 * mathjs 用于透镜方程求值与平面交线的线性方程组求解（lusolve）。
 */
import { evaluate, lusolve, matrix } from 'mathjs';

export interface LensParams {
  /** 焦距 f (mm) */
  focalLength: number;
  /** 光圈值 N */
  fNumber: number;
  /** 倾角 θ（度），绕竖直轴 tilt */
  tiltDeg: number;
  /** 轴上对焦距离 u (mm) */
  focusDistance: number;
  /** 弥散圈直径 c (mm)，由用户给定 */
  coc: number;
}

/** 剖面内直线：z = slope·x + intercept */
export interface ProfileLine {
  slope: number;
  intercept: number;
}

export interface ProfilePoint {
  x: number;
  z: number;
}

export type Mode = 'parallel' | 'scheimpflug';

export interface OpticsResult {
  mode: Mode;
  /** false 表示处于奇异角度或模型适用范围之外，不应采信任何数值 */
  valid: boolean;
  errors: string[];
  warnings: string[];
  /** 像距 s' (mm) */
  imageDistance: number;
  /** 轴上放大率 m */
  magnification: number;
  /** 清晰焦平面（物方） */
  focusPlane: ProfileLine | null;
  /** 景深近端面 */
  nearPlane: ProfileLine | null;
  /** 景深远端面；null 表示延伸至无穷远 */
  farPlane: ProfileLine | null;
  /** 近端面与光轴交点距离 (mm) */
  nearDistance: number;
  /** 远端面与光轴交点距离 (mm)，可为 Infinity */
  farDistance: number;
  /** 铰链点 H（Scheimpflug 模式）；平行模式为 null */
  hinge: ProfilePoint | null;
  /** Scheimpflug 点 S（三平面共线）；平行模式为 null */
  scheimpflugPoint: ProfilePoint | null;
  /** 焦平面相对传感器平行面的倾角 ψ（度，带符号） */
  focusPlaneTiltDeg: number;
  /** 超焦距 (mm) */
  hyperfocal: number;
  /** 像方总焦深 2·N·c (mm) */
  depthOfFocus: number;
}

/** 倾角低于该值视为平行模式（普通焦面） */
export const TILT_EPS_DEG = 1e-6;
/** 超过该倾角给出近轴精度警告 */
export const WARN_TILT_DEG = 15;
/** 超过该倾角判定为超出薄透镜近轴模型适用范围，停止给出精确结果 */
export const MAX_TILT_DEG = 45;

function invalidResult(errors: string[], warnings: string[]): OpticsResult {
  return {
    mode: 'parallel',
    valid: false,
    errors,
    warnings,
    imageDistance: NaN,
    magnification: NaN,
    focusPlane: null,
    nearPlane: null,
    farPlane: null,
    nearDistance: NaN,
    farDistance: NaN,
    hinge: null,
    scheimpflugPoint: null,
    focusPlaneTiltDeg: NaN,
    hyperfocal: NaN,
    depthOfFocus: NaN
  };
}

/**
 * 由像方离焦平面位置 zi 求物方对应平面（过铰链线）。
 * 物方平面：z = −zi·(x·sinθ + f) / (zi·cosθ − f)
 */
function planeFromImageDistance(zi: number, f: number, sinT: number, cosT: number): ProfileLine {
  const denom = zi * cosT - f;
  return {
    slope: (-zi * sinT) / denom,
    intercept: (-f * zi) / denom
  };
}

/** 用 mathjs 解线性方程组，求镜头平面与传感器平面的交点（Scheimpflug 点） */
function intersectLensAndSensor(sinT: number, cosT: number, sp: number): ProfilePoint {
  // 镜头平面: sinT·x + cosT·z = 0 ；传感器平面: z = sp
  const sol = lusolve(
    matrix([
      [sinT, cosT],
      [0, 1]
    ]),
    matrix([0, sp])
  );
  const arr = sol.toArray() as number[][];
  return { x: arr[0][0], z: arr[1][0] };
}

export function computeOptics(p: LensParams): OpticsResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  const f = p.focalLength;
  const N = p.fNumber;
  const c = p.coc;
  const u = p.focusDistance;

  if (!(f > 0)) errors.push('焦距必须为正数');
  if (!(N > 0)) errors.push('光圈值 N 必须为正数');
  if (!(c > 0)) errors.push('弥散圈直径必须为正数');
  if (!(u > 0)) errors.push('对焦距离必须为正数');

  const absTilt = Math.abs(p.tiltDeg);
  if (absTilt > MAX_TILT_DEG) {
    errors.push(
      `倾角 |θ| = ${absTilt.toFixed(2)}° 超出薄透镜近轴模型适用范围（±${MAX_TILT_DEG}°），已停止给出精确结果`
    );
  } else if (absTilt > WARN_TILT_DEG) {
    warnings.push(`倾角超过 ${WARN_TILT_DEG}°：近轴近似精度下降，结果仅供定性参考`);
  }
  if (errors.length > 0) return invalidResult(errors, warnings);

  const theta = (p.tiltDeg * Math.PI) / 180;
  const k = (N * c) / f; // 无量纲焦深系数
  if (k >= 1) {
    warnings.push('N·c/f ≥ 1：焦深公差过大，景深近端以前焦平面为界');
  }
  const hyperfocal = f + (f * f) / (N * c);
  const depthOfFocus = 2 * N * c;

  if (absTilt < TILT_EPS_DEG) {
    // ---------- 普通平行焦面模式 ----------
    if (u <= f) {
      return invalidResult(
        [`对焦距离 u=${u}mm 必须大于焦距 f=${f}mm 才能成实像，已停止给出精确结果`],
        warnings
      );
    }
    const sp = evaluate('f*u/(u-f)', { f, u }) as number;
    const m = evaluate('f/(u-f)', { f, u }) as number;
    const focusPlane: ProfileLine = { slope: 0, intercept: -u };

    const ziNear = k < 1 ? sp / (1 - k) : Infinity;
    const ziFar = sp / (1 + k);
    const objFromImage = (zi: number) => (f * zi) / (zi - f);
    const uNear = Number.isFinite(ziNear) ? objFromImage(ziNear) : f;
    const uFar = ziFar <= f ? Infinity : objFromImage(ziFar);

    return {
      mode: 'parallel',
      valid: true,
      errors,
      warnings,
      imageDistance: sp,
      magnification: m,
      focusPlane,
      nearPlane: { slope: 0, intercept: -uNear },
      farPlane: Number.isFinite(uFar) ? { slope: 0, intercept: -uFar } : null,
      nearDistance: uNear,
      farDistance: uFar,
      hinge: null,
      scheimpflugPoint: null,
      focusPlaneTiltDeg: 0,
      hyperfocal,
      depthOfFocus
    };
  }

  // ---------- Scheimpflug 模式 ----------
  const cosT = Math.cos(theta);
  const sinT = Math.sin(theta);
  const denom = u * cosT - f;
  if (denom <= 0) {
    return invalidResult(
      [
        `沿镜头法线方向的物距分量 u·cosθ = ${(u * cosT).toFixed(2)}mm 不大于焦距 f=${f}mm，` +
          '无法成实像（奇异几何），已停止给出精确结果'
      ],
      warnings
    );
  }

  const sp = (f * u) / denom;
  const m = f / denom;
  const focusPlane: ProfileLine = { slope: -(u * sinT) / f, intercept: -u };
  const hinge: ProfilePoint = { x: -f / sinT, z: 0 };
  const S = intersectLensAndSensor(sinT, cosT, sp);

  // 内部一致性核验：焦平面必须过 Scheimpflug 点（三平面共线）
  const residual = Math.abs(focusPlane.slope * S.x + focusPlane.intercept - S.z);
  if (residual > 1e-6 * Math.max(1, Math.abs(S.z))) {
    warnings.push('内部一致性核验未通过：焦平面未精确过 Scheimpflug 点，结果不可采信');
  }

  // 像方焦深容差对应的两个像面位置
  const ziNear = k < 1 ? sp / (1 - k) : Infinity;
  const ziFar = sp / (1 + k);

  // 近端面：k≥1 时退化为前焦平面 x·sinθ + z·cosθ = −f
  const nearPlane: ProfileLine = Number.isFinite(ziNear)
    ? planeFromImageDistance(ziNear, f, sinT, cosT)
    : { slope: -sinT / cosT, intercept: -f / cosT };
  const nearDistance = -nearPlane.intercept;

  // 远端面：zi·cosθ ≤ f 时对应物方无穷远
  let farPlane: ProfileLine | null = null;
  let farDistance = Infinity;
  if (ziFar * cosT > f) {
    farPlane = planeFromImageDistance(ziFar, f, sinT, cosT);
    farDistance = -farPlane.intercept;
  }

  return {
    mode: 'scheimpflug',
    valid: true,
    errors,
    warnings,
    imageDistance: sp,
    magnification: m,
    focusPlane,
    nearPlane,
    farPlane,
    nearDistance,
    farDistance,
    hinge,
    scheimpflugPoint: S,
    focusPlaneTiltDeg: (Math.atan(focusPlane.slope) * 180) / Math.PI,
    hyperfocal,
    depthOfFocus
  };
}
