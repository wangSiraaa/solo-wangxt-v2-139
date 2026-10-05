/**
 * 导出核验：导出文件必须注明简化假设，且在无效参数下不输出数值结果。
 */
import { describe, expect, it } from 'vitest';
import { computeOptics, type LensParams } from './optics';
import { ASSUMPTIONS, buildExport } from './export';

const good: LensParams = { focalLength: 50, fNumber: 2.8, tiltDeg: 5, focusDistance: 1500, coc: 0.03 };

describe('导出', () => {
  it('导出包含全部简化假设与输入参数', () => {
    const payload = buildExport(good, computeOptics(good), 'mm');
    expect(payload.assumptions).toEqual(ASSUMPTIONS);
    expect(payload.assumptions.length).toBeGreaterThanOrEqual(6);
    expect(payload.assumptions.join('')).toContain('薄透镜');
    expect(payload.assumptions.join('')).toContain('弥散圈');
    expect(payload.inputs.focalLength).toBe(50);
    expect(payload.results.mode).toBe('scheimpflug');
  });

  it('无效参数导出标记 invalid 且不包含平面数据', () => {
    const bad = { ...good, tiltDeg: 60 };
    const payload = buildExport(bad, computeOptics(bad), 'mm');
    expect(payload.results.invalid).toBe(true);
    expect(payload.results.focusPlane).toBeUndefined();
  });
});
