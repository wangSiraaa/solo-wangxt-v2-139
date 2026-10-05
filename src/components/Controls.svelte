<script lang="ts">
  import { params, displayUnit, result, resetParams } from '../lib/store';
  import { fromDisplay, toDisplay, UNIT_LABELS, type LengthUnit } from '../lib/units';
  import { MAX_TILT_DEG } from '../lib/optics';

  const cocPresets = [
    { label: '全画幅 0.030mm', value: 0.03 },
    { label: 'APS-C 0.020mm', value: 0.02 },
    { label: 'M4/3 0.015mm', value: 0.015 }
  ];

  function setFocusDistance(e: Event) {
    const v = parseFloat((e.currentTarget as HTMLInputElement).value);
    if (Number.isFinite(v) && v > 0) {
      params.update((p) => ({ ...p, focusDistance: fromDisplay(v, $displayUnit) }));
    }
  }

  function setUnit(e: Event) {
    displayUnit.set((e.currentTarget as HTMLSelectElement).value as LengthUnit);
  }
</script>

<section class="panel">
  <h2>参数设置</h2>

  <label>
    焦距 f（mm）
    <input type="number" min="1" step="1" bind:value={$params.focalLength} />
  </label>

  <label>
    光圈值 N（f/N）
    <input type="number" min="0.5" step="0.1" bind:value={$params.fNumber} />
  </label>

  <label>
    倾角 θ（度，±{MAX_TILT_DEG}° 内）
    <input type="range" min="-12" max="12" step="0.1" bind:value={$params.tiltDeg} />
    <input type="number" min={-MAX_TILT_DEG} max={MAX_TILT_DEG} step="0.1" bind:value={$params.tiltDeg} />
  </label>

  <label>
    对焦距离 u（{UNIT_LABELS[$displayUnit]}，轴上）
    <input
      type="number"
      min="0"
      step="any"
      value={toDisplay($params.focusDistance, $displayUnit)}
      on:input={setFocusDistance}
    />
  </label>

  <label>
    显示单位
    <select value={$displayUnit} on:change={setUnit}>
      {#each Object.entries(UNIT_LABELS) as [key, label]}
        <option value={key}>{label}</option>
      {/each}
    </select>
  </label>

  <fieldset>
    <legend>弥散圈直径 c（mm，标准由用户给定）</legend>
    <input type="number" min="0.001" step="0.005" bind:value={$params.coc} />
    <div class="presets">
      {#each cocPresets as preset}
        <button type="button" on:click={() => params.update((p) => ({ ...p, coc: preset.value }))}>
          {preset.label}
        </button>
      {/each}
    </div>
    <p class="hint">景深完全由此标准决定；取景器里"看起来清晰"不代表满足该标准。</p>
  </fieldset>

  <div class="row">
    <button type="button" on:click={resetParams}>重置参数</button>
  </div>

  {#if !$result.valid}
    <div class="errors">
      <strong>已停止给出精确结果：</strong>
      <ul>
        {#each $result.errors as err}
          <li>{err}</li>
        {/each}
      </ul>
    </div>
  {/if}
  {#if $result.warnings.length > 0}
    <div class="warnings">
      <ul>
        {#each $result.warnings as w}
          <li>{w}</li>
        {/each}
      </ul>
    </div>
  {/if}
</section>

<style>
  .panel {
    background: #1c2230;
    border: 1px solid #2c3547;
    border-radius: 8px;
    padding: 12px 14px;
    display: flex;
    flex-direction: column;
    gap: 10px;
  }
  h2 {
    margin: 0;
    font-size: 15px;
    color: #9ecbff;
  }
  label {
    display: flex;
    flex-direction: column;
    gap: 4px;
    font-size: 13px;
    color: #c8d2e0;
  }
  input,
  select {
    background: #12161f;
    color: #e6ecf3;
    border: 1px solid #38445a;
    border-radius: 4px;
    padding: 5px 7px;
    font-size: 13px;
  }
  input[type='range'] {
    padding: 0;
  }
  fieldset {
    border: 1px solid #2c3547;
    border-radius: 6px;
    font-size: 13px;
    color: #c8d2e0;
  }
  .presets {
    display: flex;
    gap: 6px;
    margin-top: 6px;
    flex-wrap: wrap;
  }
  button {
    background: #2b3a55;
    color: #dfe8f5;
    border: 1px solid #3d4f74;
    border-radius: 4px;
    padding: 4px 10px;
    font-size: 12px;
    cursor: pointer;
  }
  button:hover {
    background: #36496e;
  }
  .hint {
    font-size: 11px;
    color: #8fa0b8;
    margin: 6px 0 0;
  }
  .row {
    display: flex;
    gap: 8px;
  }
  .errors {
    background: #3a1d22;
    border: 1px solid #7a2f3a;
    color: #ffb3bd;
    border-radius: 6px;
    padding: 8px 10px;
    font-size: 12px;
  }
  .warnings {
    background: #3a3018;
    border: 1px solid #7a652a;
    color: #ffd98a;
    border-radius: 6px;
    padding: 8px 10px;
    font-size: 12px;
  }
  ul {
    margin: 4px 0 0;
    padding-left: 18px;
  }
</style>
