<script lang="ts">
  import type { LengthUnit, SceneInput } from '../optics/types';
  import { fromMm, toMm } from '../optics/geometry';
  import { LIMITS, TILT_EPS_DEG } from '../optics/model';

  interface Props {
    input: SceneInput;
    unit: LengthUnit;
    onchange: (next: SceneInput) => void;
    onunit: (u: LengthUnit) => void;
  }
  let { input, unit, onchange, onunit }: Props = $props();

  // 数值字段以当前显示单位编辑，失焦或拖动时写回（内部统一 mm）
  const focusDisplay = $derived(fromMm(input.focusDistance_mm, unit));
  let focusText = $state('');
  $effect(() => {
    focusText = fromMm(input.focusDistance_mm, unit).toFixed(unit === 'm' ? 3 : 1);
  });

  const fStops = [1.4, 2, 2.8, 4, 5.6, 8, 11, 16, 22];

  function patch(p: Partial<SceneInput>) {
    onchange({ ...input, ...p });
  }

  function commitFocus() {
    const v = parseFloat(focusText);
    if (Number.isFinite(v) && v > 0) patch({ focusDistance_mm: toMm(v, unit) });
  }

  const branchLabel = $derived(
    Math.abs(input.tilt_deg) < TILT_EPS_DEG ? '普通平行焦面（解析分支）' : 'Scheimpflug 倾斜分支',
  );
</script>

<div class="panel">
  <div class="row">
    <label>
      <span>焦距 f</span>
      <div class="numline">
        <input type="number" min="10" max="200" step="1" value={input.focalLength_mm}
               oninput={(e) => patch({ focalLength_mm: Number(e.currentTarget.value) })} />
        <em>mm</em>
      </div>
    </label>
    <label>
      <span>光圈</span>
      <select value={input.fNumber} onchange={(e) => patch({ fNumber: Number(e.currentTarget.value) })}>
        {#each fStops as n}<option value={n}>F/{n}</option>{/each}
      </select>
    </label>
  </div>

  <label class="block">
    <span>
      镜头倾角 θ
      <b class={input.tilt_deg !== 0 ? 'tilt-on' : ''}>{input.tilt_deg.toFixed(2)}°</b>
    </span>
    <input type="range" min="-{LIMITS.tiltMaxDeg}" max="{LIMITS.tiltMaxDeg}" step="0.05"
           value={input.tilt_deg} oninput={(e) => patch({ tilt_deg: Number(e.currentTarget.value) })} />
    <small>正 = 上端朝被摄体前倾（光轴下压）。范围 ±{LIMITS.tiltMaxDeg}°，超界停止精确结果。</small>
  </label>

  <label class="block">
    <span>
      对焦距离 s（主平面 → 合焦面与光轴交点）
      <b>{focusDisplay.toFixed(unit === 'm' ? 3 : 1)} {unit}</b>
    </span>
    <div class="numline wide">
      <input type="number" bind:value={focusText} onblur={commitFocus} onkeydown={(e) => e.key === 'Enter' && commitFocus()} />
      <div class="units">
        {#each (['mm', 'cm', 'm'] as LengthUnit[]) as u}
          <button class:active={u === unit} onclick={() => onunit(u)}>{u}</button>
        {/each}
      </div>
    </div>
    <input type="range" min={Math.max(60, input.focalLength_mm * 1.2)} max="20000" step="10"
           value={input.focusDistance_mm} oninput={(e) => patch({ focusDistance_mm: Number(e.currentTarget.value) })} />
  </label>

  <label class="block">
    <span>
      弥散圆标准 c（景深唯一判定，用户给定）
      <b>{input.coc_mm.toFixed(3)} mm</b>
    </span>
    <input type="range" min="0.005" max="0.1" step="0.001" value={input.coc_mm}
           oninput={(e) => patch({ coc_mm: Number(e.currentTarget.value) })} />
    <small>全画幅常用 ~0.03 mm，APS-C ~0.02 mm。景深按此弥散标准绘制，不用材质清晰度假充。</small>
  </label>

  <div class="branch">{branchLabel}</div>
</div>

<style>
  .panel {
    display: flex;
    flex-direction: column;
    gap: 14px;
  }
  .row {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 12px;
  }
  label {
    display: flex;
    flex-direction: column;
    gap: 5px;
    font-size: 13px;
    color: #292524;
  }
  label.block span {
    display: flex;
    justify-content: space-between;
    gap: 8px;
  }
  label b {
    font-family: ui-monospace, monospace;
    font-weight: 600;
    color: #065f46;
  }
  .tilt-on {
    color: #9333ea;
  }
  small {
    color: #78716c;
    font-size: 11px;
    line-height: 1.4;
  }
  input[type='number'],
  select {
    width: 100%;
    padding: 6px 8px;
    border: 1px solid #d6d3d1;
    border-radius: 6px;
    font: inherit;
    font-size: 14px;
    background: white;
  }
  .numline {
    display: flex;
    align-items: center;
    gap: 6px;
  }
  .numline em {
    font-style: normal;
    color: #78716c;
    font-size: 12px;
  }
  .numline.wide input {
    flex: 1;
  }
  .units {
    display: flex;
    border: 1px solid #d6d3d1;
    border-radius: 6px;
    overflow: hidden;
  }
  .units button {
    border: 0;
    background: #f5f5f4;
    padding: 6px 10px;
    cursor: pointer;
    font-size: 12px;
  }
  .units button.active {
    background: #292524;
    color: white;
  }
  input[type='range'] {
    width: 100%;
    accent-color: #059669;
  }
  .branch {
    font-size: 12px;
    font-family: ui-monospace, monospace;
    color: #57534e;
    background: #f5f5f4;
    border-radius: 6px;
    padding: 6px 10px;
  }
</style>
