import { derived, writable } from 'svelte/store';
import { computeScene } from './optics/model';
import type { LengthUnit, SceneInput } from './optics/types';

export const defaultInput: SceneInput = {
  focalLength_mm: 50,
  fNumber: 8,
  tilt_deg: 4,
  focusDistance_mm: 1500,
  coc_mm: 0.03,
};

export const inputStore = writable<SceneInput>({ ...defaultInput });
export const unitStore = writable<LengthUnit>('mm');

/** 模型结果（computeScene 为纯函数，开销小，响应式派生） */
export const resultStore = derived(inputStore, ($input) => computeScene($input));
