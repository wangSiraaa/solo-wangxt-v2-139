/**
 * 薄透镜近轴模型（明确、可核验）。
 *
 * 坐标约定（二维剖面 x-y，三维沿倾斜轴 z 拉伸）：
 *   - 透镜中心 O=(0,0)；x 轴由透镜指向被摄体，传感器在 x=-v 处（竖直平面）
 *   - 镜头倾角 θ：透镜平面绕 z 轴（倾斜轴）转动，上端向被摄体前倾为正，
 *     此时光轴向下偏转（标准 tilt-down 配置）
 *   - 透镜平面切向 t=( sinθ, cosθ)，指向被摄体的法向 n=( cosθ,-sinθ)
 *
 * 物点 Q=(x,y) 的透镜局部坐标（q 沿光轴朝前为正，h 沿切向）：
 *   q = n·Q = cosθ·x - sinθ·y， h = t·Q = sinθ·x + cosθ·y
 * 光阑点（孔径圆 a²+b²≤ρ²）：P = a·t + b·z
 *
 * 近轴薄透镜折射（局部系前进方向 = -n）：
 *   m1 = (a-h)/q - a/f， m2 = b/q - b/f
 * 出射光方向 d = -n + m1·t + m2·z：
 *   dx = -cosθ + sinθ·m1，dy = sinθ + cosθ·m1，dz = m2
 * 与传感器 x=-v 交于 λ=(-v-a·sinθ)/dx：
 *   y' = a·cosθ + λ·dy，z' = b + λ·m2
 *
 * 由 y' 对孔径 a 恒定（精确合焦）可解析推出物方合焦面：
 *   x/s - (sinθ/f)·y = 1
 *   - Scheimpflug 交线点（传感器、透镜、合焦三面共线）：S=(-v, -v·cosθ/sinθ)
 *   - 铰链点（合焦面 ∩ 前焦面 q=f）：J=(0, -f/sinθ)，垂直距离 J=f/sinθ
 * θ→0 时合焦面退化为 x=s，v=fs/(s-f)，全部回归普通平行焦面公式。
 */
import { compile, type EvalFunction } from 'mathjs';
import type { DofLimit, Line2, Plane3, SceneInput, SceneResult, Vec2 } from './types';
import { angleBetweenDeg, deg2rad, normalize, v2 } from './geometry';

/** 平行分支判定阈值（度）：小于此值直接走解析式 */
export const TILT_EPS_DEG = 0.01;
/** 模型机械/近轴适用范围 */
export const LIMITS = {
  tiltMaxDeg: 8.5, // 常见移轴镜头最大倾角（Canon TS-E / PC-E）
  fNumberMin: 1.0, // 近轴近似下限
  fNumberWarn: 1.4,
  focusMin_mm: 50,
  focusMax_mm: 100_000, // 100 m
  farInfinity_mm: 1e7, // 10 km 以上视为无穷远
};

const CONTOUR_HEIGHTS = 16;
/** 等值线直线核验残差（mm），超过则不宣称"平面" */
const PLANAR_RESIDUAL_MM = 0.5;

interface ModelExprs {
  m1: EvalFunction;
  dx: EvalFunction;
}

let _exprs: ModelExprs | null = null;

/** 惰性编译 mathjs 表达式（sn=sinθ, cs=cosθ） */
function exprs(): ModelExprs {
  if (!_exprs) {
    _exprs = {
      m1: compile('(a - h) / q - a / f'),
      dx: compile('-cs + sn * m1'),
    };
  }
  return _exprs;
}

export interface BlurResult {
  diameter_mm: number;
  /** 倾斜面内半轴（像 y' 方向）对应直径 */
  diameterY_mm: number;
  /** 倾斜轴方向半轴（z' 方向）对应直径 */
  diameterZ_mm: number;
  /** 是否出现数值异常（光线与像面平行等） */
  singular: boolean;
}

/**
 * 物点 (x,y) 在传感器上的弥散斑长轴直径（mm）。
 *
 * 孔径圆 (a,b) 到像面的近轴线性映射恒为轴对齐椭圆（交叉偏导为零）：
 *   m1 = a·k - h/q，k = 1/q - 1/f；dx0 = -cosθ + sinθ·(-h/q)
 *   λ0 = -v/dx0，dλ/da = sinθ·(-dx0 + v·k)/dx0²
 *   倾斜面内直径 2ρ·α，α = |cosθ + dλ/da·(sinθ+cosθ·m10) + λ0·cosθ·k|
 *   倾斜轴直径   2ρ·β，β = |1 + λ0·k|
 * 长轴直径 = 2ρ·max(α,β)。θ=0 时 α=β=|1−v(1/f−1/q)|，回归标准公式。
 */
export function blurDiameter(
  x: number,
  y: number,
  cs: number,
  sn: number,
  f: number,
  v: number,
  rho: number,
): BlurResult {
  const q = cs * x - sn * y;
  const h = sn * x + cs * y;
  if (!(q > 1e-9)) return { diameter_mm: NaN, diameterY_mm: NaN, diameterZ_mm: NaN, singular: true };

  const { m1, dx } = exprs();
  const scope0 = { cs, sn, f, v, q, h, a: 0 };
  const m10 = m1.evaluate(scope0);
  const dx0 = dx.evaluate({ ...scope0, m1: m10 });
  if (!Number.isFinite(dx0) || Math.abs(dx0) < 1e-12) {
    return { diameter_mm: NaN, diameterY_mm: NaN, diameterZ_mm: NaN, singular: true };
  }
  const k = 1 / q - 1 / f;
  const lambda0 = -v / dx0;
  const dLambda = (sn * (-dx0 + v * k)) / (dx0 * dx0);
  const alpha = Math.abs(cs + dLambda * (sn + cs * m10) + lambda0 * cs * k);
  const beta = Math.abs(1 + lambda0 * k);
  const dY = 2 * rho * alpha;
  const dZ = 2 * rho * beta;
  return { diameter_mm: Math.max(dY, dZ), diameterY_mm: dY, diameterZ_mm: dZ, singular: false };
}

/** 二分法求 g(x)=0（端点可倒序） */
function bisect(g: (x: number) => number, x0: number, x1: number, tol = 1e-9, maxIter = 100): number | null {
  let lo = Math.min(x0, x1);
  let hi = Math.max(x0, x1);
  const glo = g(lo);
  const ghi = g(hi);
  if (!Number.isFinite(glo) || !Number.isFinite(ghi) || glo * ghi > 0) return null;
  let a = lo;
  let b = hi;
  let ga = glo;
  for (let i = 0; i < maxIter; i++) {
    const mid = (a + b) / 2;
    const gm = g(mid);
    if (!Number.isFinite(gm)) return null;
    if (Math.abs(gm) <= tol || b - a < 1e-10) return mid;
    if (ga * gm <= 0) {
      b = mid;
    } else {
      a = mid;
      ga = gm;
    }
  }
  return (a + b) / 2;
}

/**
 * 从合焦点正外侧 start 朝 end 单调扫描，返回第一个 g=0 穿越点。
 * outward=true 时用对数间距。起点与终点必须同号或异号均可，
 * 但调用方保证 start 位于合焦侧（g<0），第一个异号即最近穿越。
 */
function scanCrossing(
  g: (x: number) => number,
  start: number,
  end: number,
  outward: boolean,
  steps = 300,
): number | null {
  const pts: number[] = [start];
  for (let i = 1; i <= steps; i++) {
    const t = i / steps;
    pts.push(outward ? start * Math.exp(t * Math.log(end / start)) : start + t * (end - start));
  }
  for (let i = 0; i < pts.length - 1; i++) {
    const g0 = g(pts[i]);
    const g1 = g(pts[i + 1]);
    if (!Number.isFinite(g0) || !Number.isFinite(g1)) continue;
    if (g0 * g1 <= 0) {
      const root = bisect(g, pts[i], pts[i + 1]);
      if (root !== null) return root;
    }
  }
  return null;
}

/**
 * 在轴 y=0 上求 blur_z(x,0)=c 的两个根。
 *
 * 景深判定取弥散椭圆沿【倾斜轴方向】的直径 d_z = 2ρ·|1+λ0·k|：
 * 该分量的等值面经核验严格为绕铰链线旋转的平面（经典 Scheimpflug 景深楔，
 * 与 Merklinger 铰链公式一致）。面内分量 d_y 因倾斜投影只近似共面，
 * 仅用于 3D 长轴包络参考，不作为景深平面结论依据。
 * 近侧无根 → null；远侧无穿越（g 恒负直到再增）→ Infinity（远极限无穷远）。
 */
export function axisRoots(
  s: number,
  cs: number,
  sn: number,
  f: number,
  v: number,
  rho: number,
  coc: number,
): { near: number | null; far: number | null } {
  const g = (x: number) => {
    const r = blurDiameter(x, 0, cs, sn, f, v, rho);
    return r.singular ? NaN : r.diameterZ_mm - coc;
  };
  // 近侧：从略小于 s 线性扫到可成像下限
  const xMin = Math.max(f + 1e-6, s * 1e-4, 1);
  const near = scanCrossing(g, s * (1 - 1e-8), xMin, false);
  // 远侧：从略大于 s 对数扫到 10 km
  const far = scanCrossing(g, s * (1 + 1e-8), LIMITS.farInfinity_mm, true);
  return { near, far: far === null ? Infinity : far };
}

export interface TraceLineResult {
  line: Line2;
  maxResidual_mm: number;
  contour: Vec2[];
  /** 是否通过"过铰链点的直线"核验 */
  planar: boolean;
}

/**
 * 已知轴上根 axisRoot，沿高度方向追踪 blur_z=c 等值线，
 * 并核验它是否为一条过铰链点 J 的直线（景深极限平面绕铰链线旋转）。
 */
export function traceLimit(
  axisRoot: number,
  J: Vec2,
  cs: number,
  sn: number,
  f: number,
  v: number,
  rho: number,
  coc: number,
): TraceLineResult {
  // 无穷远极限：过 J 平行光轴
  if (!Number.isFinite(axisRoot)) {
    return {
      line: { point: J, dir: normalize(v2(1, 0)) },
      maxResidual_mm: 0,
      contour: [],
      planar: true,
    };
  }

  // 先验直线：连接轴上根与铰链点（经典景深楔假设）
  const line: Line2 = { point: J, dir: normalize(v2(axisRoot - J.x, -J.y)) };
  const predX = (y: number) => J.x + ((y - J.y) / (0 - J.y)) * (axisRoot - J.x);

  // 在铰链点下方 90% 到上方 |J|·0.5 之间采样，避开 q=0 奇点
  const yLow = J.y * 0.9;
  const yHigh = Math.abs(J.y) * 0.5;
  const xFloor = f + 1e-6;
  const contour: Vec2[] = [v2(axisRoot, 0)];

  for (let i = 1; i <= CONTOUR_HEIGHTS; i++) {
    const tt = i / (CONTOUR_HEIGHTS + 1);
    const y = yLow + tt * (yHigh - yLow);
    const px = Math.max(predX(y), xFloor * 2);
    const g = (x: number) => {
      const r = blurDiameter(x, y, cs, sn, f, v, rho);
      return r.singular ? NaN : r.diameterZ_mm - coc;
    };
    const root = rootNear(g, px, xFloor);
    if (root !== null) contour.push(v2(root, y));
  }

  if (contour.length < CONTOUR_HEIGHTS * 0.75) {
    return { line, maxResidual_mm: Infinity, contour, planar: false };
  }

  let maxRes = 0;
  for (const pt of contour) {
    const rx = pt.x - line.point.x;
    const ry = pt.y - line.point.y;
    const proj = rx * line.dir.x + ry * line.dir.y;
    const res = Math.hypot(rx - proj * line.dir.x, ry - proj * line.dir.y);
    if (res > maxRes) maxRes = res;
  }

  return { line, maxResidual_mm: maxRes, contour, planar: maxRes <= PLANAR_RESIDUAL_MM };
}

/** 在预测点 px 附近用自适应扩张窗口寻找穿越并二分 */
function rootNear(g: (x: number) => number, px: number, floor: number): number | null {
  for (const frac of [0.02, 0.05, 0.1, 0.2, 0.4, 0.8]) {
    const lo = Math.max(px * (1 - frac), floor);
    const hi = px * (1 + frac) + 1e-9;
    const glo = g(lo);
    const ghi = g(hi);
    if (Number.isFinite(glo) && Number.isFinite(ghi) && glo * ghi <= 0) {
      const r = bisect(g, lo, hi);
      if (r !== null) return r;
    }
  }
  return null;
}

/** 平行分支（θ≈0）解析景深，主平面起算 */
export function parallelDof(f: number, N: number, coc: number, s: number) {
  const H = (f * f) / (N * coc) + f; // 超焦距
  const near = (s * (H - f)) / (H + s - 2 * f);
  const farDenom = H - s;
  const far = farDenom > 0 ? (s * (H - f)) / farDenom : Infinity;
  return { hyperfocal: H, near, far };
}

/** 二维直线沿倾斜轴 z 拉伸为三维平面 */
function lineToPlane(line: Line2): Plane3 {
  return {
    point: [line.point.x, line.point.y, 0],
    normal: [line.dir.y, -line.dir.x, 0],
  };
}

export interface Validation {
  applicable: boolean;
  errors: string[];
  warnings: string[];
}

/** 输入校验 / 模型适用范围 */
export function validate(input: SceneInput): Validation {
  const errors: string[] = [];
  const warnings: string[] = [];
  const { focalLength_mm: f, fNumber: N, tilt_deg, focusDistance_mm: s, coc_mm: c } = input;

  if (!(f > 0)) errors.push('焦距必须为正数。');
  if (!(N > 0)) errors.push('光圈 F 数必须为正数。');
  if (!(s > 0)) errors.push('对焦距离必须为正数。');
  if (!(c > 0)) errors.push('弥散圆直径必须为正数。');
  if (errors.length) return { applicable: false, errors, warnings };

  if (Math.abs(tilt_deg) > LIMITS.tiltMaxDeg)
    errors.push(`倾角 ${tilt_deg}° 超出常见移轴镜头机械/模型范围（±${LIMITS.tiltMaxDeg}°），停止给出精确结果。`);
  if (N < LIMITS.fNumberMin)
    errors.push(`光圈 F/${N} 超出薄透镜近轴模型适用范围（F 值过小），停止给出精确结果。`);
  if (s < LIMITS.focusMin_mm)
    errors.push(`对焦距离 ${s.toFixed(1)} mm 过近，近轴薄透镜模型不适用，停止给出精确结果。`);
  if (s > LIMITS.focusMax_mm)
    warnings.push('对焦距离超过 100 m，远侧结果将按无穷远处理。');
  if (N < LIMITS.fNumberWarn)
    warnings.push(`F/${N} 接近近轴近似边缘，绝对弥散量存在数个百分点的模型误差。`);
  if (c > 0.1)
    warnings.push('弥散圆标准大于 0.1 mm（全画幅常用约 0.03 mm），景深将异常大，请确认输入。');
  if (f < 10 || f > 200)
    warnings.push('焦距超出常见移轴镜头范围（约 17–135 mm），结果仅作模型演示。');

  const cs = Math.cos(deg2rad(tilt_deg));
  const eff = Math.abs(tilt_deg) < TILT_EPS_DEG ? s : s * cs;
  if (eff <= f * 1.001)
    errors.push(
      Math.abs(tilt_deg) < TILT_EPS_DEG
        ? `对焦距离 ${s.toFixed(1)} mm 未大于焦距 ${f} mm，不能成实像，停止给出精确结果。`
        : `该倾角下 s·cosθ=${(s * cs).toFixed(1)} mm 未大于焦距 f=${f} mm，不能成实像（v≤0），停止给出精确结果。`,
    );

  return { applicable: errors.length === 0, errors, warnings };
}

function emptyLimit(): DofLimit {
  return { axisDistance_mm: null, line: null, plane: null, contour: null };
}

/** 主入口：由场景输入计算完整几何结果 */
export function computeScene(input: SceneInput): SceneResult {
  const val = validate(input);
  const f = input.focalLength_mm;
  const N = input.fNumber;
  const s = input.focusDistance_mm;
  const c = input.coc_mm;
  const theta = deg2rad(input.tilt_deg);
  const cs = Math.cos(theta);
  const sn = Math.sin(theta);
  const rho = f / (2 * N);
  const parallel = Math.abs(input.tilt_deg) < TILT_EPS_DEG;

  const lensLine: Line2 = { point: v2(0, 0), dir: normalize(v2(sn, cs)) };
  const result: SceneResult = {
    branch: parallel ? 'parallel' : 'scheimpflug',
    applicable: val.applicable,
    errors: val.errors,
    warnings: val.warnings,
    v_mm: NaN,
    apertureRadius_mm: rho,
    axisFocusPoint: v2(s, 0),
    sensorLine: { point: v2(0, 0), dir: v2(0, 1) },
    lensLine,
    focalPlaneLine: null,
    scheimpflugPoint: null,
    hingePoint: null,
    nearLimit: emptyLimit(),
    farLimit: emptyLimit(),
    sensorPlane: { point: [0, 0, 0], normal: [1, 0, 0] },
    lensPlane: { point: [0, 0, 0], normal: [cs, -sn, 0] },
    focalPlane: null,
    focalPlaneTilt_deg: null,
  };

  if (!val.applicable) return result;

  // 像距（皮腔）v = f·s/(s·cosθ - f)
  const v = parallel ? (f * s) / (s - f) : (f * s) / (s * cs - f);
  result.v_mm = v;
  result.sensorLine = { point: v2(-v, 0), dir: v2(0, 1) };
  result.sensorPlane = { point: [-v, 0, 0], normal: [1, 0, 0] };

  // 合焦面过轴上点 (s,0) 与铰链点 J=(0,-f/sinθ)
  const J: Vec2 = parallel ? v2(Infinity, Infinity) : v2(0, -f / sn);
  const focalLine: Line2 = parallel
    ? { point: v2(s, 0), dir: v2(0, 1) }
    : { point: v2(s, 0), dir: normalize(v2(s, f / sn)) };
  result.focalPlaneLine = focalLine;
  result.focalPlane = lineToPlane(focalLine);
  result.focalPlaneTilt_deg = angleBetweenDeg(v2(0, 1), focalLine.dir);
  if (!parallel) {
    result.hingePoint = J;
    result.scheimpflugPoint = v2(-v, (-v * cs) / sn);
  }

  if (parallel) {
    const d = parallelDof(f, N, c, s);
    result.nearLimit = {
      axisDistance_mm: d.near,
      line: { point: v2(d.near, 0), dir: v2(0, 1) },
      plane: { point: [d.near, 0, 0], normal: [1, 0, 0] },
      contour: null,
    };
    result.farLimit = Number.isFinite(d.far)
      ? {
          axisDistance_mm: d.far,
          line: { point: v2(d.far, 0), dir: v2(0, 1) },
          plane: { point: [d.far, 0, 0], normal: [1, 0, 0] },
          contour: null,
        }
      : {
          axisDistance_mm: Infinity,
          line: { point: v2(LIMITS.farInfinity_mm, 0), dir: v2(0, 1) },
          plane: null,
          contour: null,
        };
    return result;
  }

  // Scheimpflug 分支：数值求轴上弥散根 → 追踪等值线 → 核验为过铰链点的平面
  const roots = axisRoots(s, cs, sn, f, v, rho, c);
  result.nearLimit = buildLimit(roots.near, J, cs, sn, f, v, rho, c, result.warnings, '近');
  result.farLimit = buildLimit(roots.far, J, cs, sn, f, v, rho, c, result.warnings, '远');

  return result;
}

function buildLimit(
  axisRoot: number | null,
  J: Vec2,
  cs: number,
  sn: number,
  f: number,
  v: number,
  rho: number,
  coc: number,
  warnings: string[],
  label: string,
): DofLimit {
  if (axisRoot === null) {
    warnings.push(`未能在模型范围内找到${label}景深轴上交点，${label}极限不可用。`);
    return emptyLimit();
  }
  const tr = traceLimit(axisRoot, J, cs, sn, f, v, rho, coc);
  if (tr.planar) {
    if (tr.maxResidual_mm > 1e-6) {
      warnings.push(`${label}景深面等值线核验残差 ${tr.maxResidual_mm.toFixed(3)} mm（仍按过铰链线平面显示）。`);
    }
    return {
      axisDistance_mm: axisRoot,
      line: tr.line,
      plane: Number.isFinite(axisRoot) ? lineToPlane(tr.line) : null,
      contour: null,
    };
  }
  warnings.push(
    `${label}景深面的弥散圆等值线未能核验为过铰链线的单一平面（残差 ${tr.maxResidual_mm === Infinity ? '—' : tr.maxResidual_mm.toFixed(2) + ' mm'}），改用数值折线显示，不给出精确平面交线结论。`,
  );
  return { axisDistance_mm: axisRoot, line: null, plane: null, contour: tr.contour };
}
