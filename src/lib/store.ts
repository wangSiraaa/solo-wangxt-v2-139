import { derived, writable } from 'svelte/store';
import { computeOptics, type LensParams } from './optics';
import type { LengthUnit } from './units';

export const DEFAULT_PARAMS: LensParams = {
  focalLength: 50, // mm
  fNumber: 2.8,
  tiltDeg: 5,
  focusDistance: 1500, // mm
  coc: 0.03 // mm（全画幅常用值，仅作默认，标准由用户给定）
};

/** 镜头与对焦参数（内部单位 mm / 度） */
export const params = writable<LensParams>({ ...DEFAULT_PARAMS });

/** 显示单位 */
export const displayUnit = writable<LengthUnit>('mm');

/** 计算结果：2D 剖面与 3D 场景共用同一数据源，保证同步 */
export const result = derived(params, ($p) => computeOptics($p));

export function resetParams(): void {
  params.set({ ...DEFAULT_PARAMS });
}
