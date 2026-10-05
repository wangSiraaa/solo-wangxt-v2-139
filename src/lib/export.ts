/**
 * 导出：JSON 中明确列出全部简化假设，便于课堂溯源。
 */
import type { LensParams, OpticsResult } from './optics';
import type { LengthUnit } from './units';

export const ASSUMPTIONS: string[] = [
  '薄透镜模型：镜头厚度为零，物方/像方主面重合于镜头平面',
  '近轴（高斯）光学：忽略球差、彗差、像散、畸变与渐晕，大倾角下精度下降',
  '仅绕竖直轴倾斜（tilt），不含摆动（swing）与平移（shift）像差效应',
  '传感器平面固定垂直于相机光轴；距离沿镜头法线方向度量',
  '景深由像方焦深 ±N·c 推出，c 为用户给定的弥散圈直径；不同 CoC 标准会得到不同景深',
  '忽略衍射与像素采样；景深边界是几何光学的等弥散圈平面',
  '可视化不渲染任何"看起来清晰"的材质/虚化效果，景深仅以计算平面（楔形）表示',
  '3D 视图中传感器与镜头为示意尺寸，未与距离严格成比例'
];

export interface ExportPayload {
  title: string;
  generatedAt: string;
  displayUnit: LengthUnit;
  inputs: LensParams & { unitNote: string };
  results: Record<string, unknown>;
  warnings: string[];
  assumptions: string[];
}

export function buildExport(p: LensParams, r: OpticsResult, u: LengthUnit): ExportPayload {
  return {
    title: '移轴镜头焦平面计算导出（薄透镜近轴模型）',
    generatedAt: new Date().toISOString(),
    displayUnit: u,
    inputs: { ...p, unitNote: '内部统一单位：长度 mm，角度 度' },
    results: r.valid
      ? {
          mode: r.mode,
          imageDistanceMm: r.imageDistance,
          magnification: r.magnification,
          focusPlane: r.focusPlane,
          nearPlane: r.nearPlane,
          farPlane: r.farPlane,
          nearDistanceMm: r.nearDistance,
          farDistanceMm: Number.isFinite(r.farDistance) ? r.farDistance : 'Infinity',
          hingeMm: r.hinge,
          scheimpflugPointMm: r.scheimpflugPoint,
          focusPlaneTiltDeg: r.focusPlaneTiltDeg,
          hyperfocalMm: r.hyperfocal,
          depthOfFocusMm: r.depthOfFocus
        }
      : { invalid: true, errors: r.errors },
    warnings: r.warnings,
    assumptions: ASSUMPTIONS
  };
}

export function downloadJSON(payload: unknown, filename: string): void {
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
