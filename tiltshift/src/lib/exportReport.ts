import type { LengthUnit, SceneInput, SceneResult } from './optics/types';

export const MODEL_ASSUMPTIONS = [
  '薄透镜、近轴（paraxial）模型：忽略主平面间距、畸变、像场弯曲与色差。',
  '像平面（传感器）保持竖直不摆（swing），仅镜头绕倾斜轴 tilt；三维景深楔沿倾斜轴拉伸。',
  '有效入射光瞳取 ρ = f/(2N) 的正圆孔，位于透镜平面；倾斜导致的瞳椭圆化仅作近轴一阶近似。',
  '景深判定使用弥散椭圆沿倾斜轴方向的直径 d_z（用户给定弥散圆标准 c）；其等值面严格为绕铰链线旋转的平面。面内直径 d_y 仅用于长轴包络参考，因倾斜投影不严格共面。',
  '对焦距离 s 沿原光轴从透镜主平面量到合焦面与光轴交点；像距 v = f·s/(s·cosθ−f)。',
  '角度限制 ±8.5°、F ≥ 1.0、物距 ≥ 50 mm；超出范围不给出精确数值结果。',
  '远极限超过 10 km 记为无穷远。模型用于教学可视化，不作为真实镜头的精确景深测量。',
];

export interface ExportReport {
  app: string;
  exportedAt: string;
  input: SceneInput;
  displayUnit: LengthUnit;
  result: {
    branch: SceneResult['branch'];
    applicable: boolean;
    errors: string[];
    warnings: string[];
    v_mm: number;
    apertureRadius_mm: number;
    focalPlaneTilt_deg: number | null;
    scheimpflugPoint_mm: { x: number; y: number } | null;
    hingePoint_mm: { x: number; y: number } | null;
    nearAxis_mm: number | null;
    farAxis_mm: number | null;
    nearIsPlanar: boolean;
    farIsPlanar: boolean;
    nearUsedNumericalContour: boolean;
    farUsedNumericalContour: boolean;
  };
  assumptions: string[];
}

export function buildReport(input: SceneInput, result: SceneResult, unit: LengthUnit): ExportReport {
  return {
    app: 'tiltshift-scheimpflug-lab',
    exportedAt: new Date().toISOString(),
    input,
    displayUnit: unit,
    result: {
      branch: result.branch,
      applicable: result.applicable,
      errors: result.errors,
      warnings: result.warnings,
      v_mm: result.v_mm,
      apertureRadius_mm: result.apertureRadius_mm,
      focalPlaneTilt_deg: result.focalPlaneTilt_deg,
      scheimpflugPoint_mm: result.scheimpflugPoint,
      hingePoint_mm: result.hingePoint,
      nearAxis_mm: result.nearLimit.axisDistance_mm,
      farAxis_mm: result.farLimit.axisDistance_mm,
      nearIsPlanar: result.nearLimit.line !== null,
      farIsPlanar: result.farLimit.line !== null,
      nearUsedNumericalContour: result.nearLimit.line === null && result.nearLimit.contour !== null,
      farUsedNumericalContour: result.farLimit.line === null && result.farLimit.contour !== null,
    },
    assumptions: MODEL_ASSUMPTIONS,
  };
}

export function reportToJson(input: SceneInput, result: SceneResult, unit: LengthUnit): string {
  return JSON.stringify(buildReport(input, result, unit), null, 2);
}

/** 供粘贴到报告的纯文本摘要 */
export function reportToText(input: SceneInput, result: SceneResult, unit: LengthUnit): string {
  const lines: string[] = [];
  lines.push('移轴镜头焦平面可视化 — 场景导出');
  lines.push(`时间: ${new Date().toLocaleString()}`);
  lines.push('');
  lines.push('输入（内部单位 mm / 度）:');
  lines.push(`  焦距 f = ${input.focalLength_mm} mm`);
  lines.push(`  光圈 F/${input.fNumber}`);
  lines.push(`  倾角 θ = ${input.tilt_deg}°`);
  lines.push(`  对焦距离 s = ${input.focusDistance_mm} mm`);
  lines.push(`  弥散圆标准 c = ${input.coc_mm} mm`);
  lines.push(`  显示单位: ${unit}`);
  lines.push('');
  if (!result.applicable) {
    lines.push('模型不适用，未给出精确结果：');
    result.errors.forEach((e) => lines.push(`  ! ${e}`));
  } else {
    lines.push(`分支: ${result.branch === 'parallel' ? '普通平行焦面' : 'Scheimpflug 倾斜'}`);
    lines.push(`像距 v = ${fmt(result.v_mm)} mm`);
    lines.push(`光阑半径 ρ = ${fmt(result.apertureRadius_mm)} mm`);
    if (result.focalPlaneTilt_deg !== null)
      lines.push(`合焦面与竖直面夹角 = ${fmt(result.focalPlaneTilt_deg)}°`);
    if (result.scheimpflugPoint)
      lines.push(
        `Scheimpflug 交线点 S = (${fmt(result.scheimpflugPoint.x)}, ${fmt(result.scheimpflugPoint.y)}) mm`,
      );
    if (result.hingePoint)
      lines.push(`铰链线点 J = (${fmt(result.hingePoint.x)}, ${fmt(result.hingePoint.y)}) mm`);
    lines.push(`近景深轴上距离 = ${fmtAxis(result.nearLimit.axisDistance_mm)}`);
    lines.push(`远景深轴上距离 = ${fmtAxis(result.farLimit.axisDistance_mm)}`);
    result.warnings.forEach((w) => lines.push(`  ~ ${w}`));
  }
  lines.push('');
  lines.push('简化假设:');
  MODEL_ASSUMPTIONS.forEach((a, i) => lines.push(`  ${i + 1}. ${a}`));
  return lines.join('\n');
}

function fmt(n: number | null): string {
  if (n === null || !Number.isFinite(n)) return '—';
  return n.toFixed(3);
}

function fmtAxis(n: number | null): string {
  if (n === null) return '不可用';
  if (!Number.isFinite(n)) return '∞（无穷远）';
  return `${n.toFixed(1)} mm`;
}
