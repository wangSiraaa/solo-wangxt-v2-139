/**
 * 显示单位切换。内部计算一律使用 mm，仅在显示层做换算。
 * 换算经 mathjs 的单位系统完成，保证切换不改变几何结果。
 */
import { unit } from 'mathjs';

export type LengthUnit = 'mm' | 'm';

export const UNIT_LABELS: Record<LengthUnit, string> = {
  mm: '毫米 mm',
  m: '米 m'
};

/** mm → 显示单位 */
export function toDisplay(mm: number, u: LengthUnit): number {
  return unit(mm, 'mm').toNumber(u);
}

/** 显示单位 → mm */
export function fromDisplay(v: number, u: LengthUnit): number {
  return unit(v, u).toNumber('mm');
}

/** 格式化长度（mm 内部值 → 当前单位字符串） */
export function formatLength(mm: number, u: LengthUnit, digits = 4): string {
  if (!Number.isFinite(mm)) return '∞';
  const v = toDisplay(mm, u);
  const abs = Math.abs(v);
  const text = abs >= 100 ? v.toFixed(1) : abs >= 1 ? v.toFixed(2) : v.toPrecision(digits);
  return `${text} ${u}`;
}
