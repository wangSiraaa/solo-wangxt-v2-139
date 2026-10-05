import type { LengthUnit, Line2, Vec2 } from './types';

/** 各单位与毫米之间的换算系数 */
const TO_MM: Record<LengthUnit, number> = {
  mm: 1,
  cm: 10,
  m: 1000,
};

export function toMm(value: number, unit: LengthUnit): number {
  return value * TO_MM[unit];
}

export function fromMm(valueMm: number, unit: LengthUnit): number {
  return valueMm / TO_MM[unit];
}

/** 角度换算 */
export const deg2rad = (deg: number): number => (deg * Math.PI) / 180;
export const rad2deg = (rad: number): number => (rad * 180) / Math.PI;

export const v2 = (x: number, y: number): Vec2 => ({ x, y });

export function linePoint(line: Line2, t: number): Vec2 {
  return { x: line.point.x + t * line.dir.x, y: line.point.y + t * line.dir.y };
}

/**
 * 求两条直线 P1+t·d1 与 P2+u·d2 的交点。
 * 返回参数 t，使交点 = P1 + t·d1；平行时返回 null。
 */
export function lineIntersect(l1: Line2, l2: Line2): { point: Vec2; t: number; u: number } | null {
  const det = l1.dir.x * l2.dir.y - l1.dir.y * l2.dir.x;
  if (Math.abs(det) < 1e-12) return null;
  const dx = l2.point.x - l1.point.x;
  const dy = l2.point.y - l1.point.y;
  const t = (dx * l2.dir.y - dy * l2.dir.x) / det;
  const u = (dx * l1.dir.y - dy * l1.dir.x) / det;
  return { point: linePoint(l1, t), t, u };
}

/** 归一化向量 */
export function normalize(v: Vec2): Vec2 {
  const n = Math.hypot(v.x, v.y);
  if (n < 1e-15) return { x: 0, y: 0 };
  return { x: v.x / n, y: v.y / n };
}

/** 两条线（方向）之间的锐角/有向夹角，单位度 */
export function angleBetweenDeg(d1: Vec2, d2: Vec2): number {
  const a1 = Math.atan2(d1.y, d1.x);
  const a2 = Math.atan2(d2.y, d2.x);
  let d = (a2 - a1) * 180 / Math.PI;
  while (d > 180) d -= 360;
  while (d < -180) d += 360;
  return d;
}
