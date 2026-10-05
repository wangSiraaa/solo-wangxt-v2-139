<script lang="ts">
  import type { LengthUnit, SceneResult } from '../optics/types';
  import { fromMm } from '../optics/geometry';

  interface Props {
    result: SceneResult;
    unit: LengthUnit;
  }
  let { result, unit }: Props = $props();

  const f = (mm: number | null | undefined, digits = 2) => {
    if (mm === null || mm === undefined) return '—';
    if (!Number.isFinite(mm)) return '∞';
    return fromMm(mm, unit).toFixed(digits);
  };
</script>

<div class="info">
  {#if !result.applicable}
    <div class="errors">
      <strong>停止给出精确结果</strong>
      <ul>
        {#each result.errors as e}<li>{e}</li>{/each}
      </ul>
    </div>
  {:else}
    <table>
      <tbody>
        <tr>
          <td>分支</td>
          <td class="v">{result.branch === 'parallel' ? '普通平行焦面' : 'Scheimpflug'}</td>
        </tr>
        <tr>
          <td>像距 v</td>
          <td class="v mono">{f(result.v_mm, 3)} {unit}</td>
        </tr>
        <tr>
          <td>光阑半径 ρ=f/(2N)</td>
          <td class="v mono">{f(result.apertureRadius_mm, 3)} {unit}</td>
        </tr>
        {#if result.focalPlaneTilt_deg !== null}
          <tr>
            <td>合焦面相对竖直面夹角</td>
            <td class="v mono">{result.focalPlaneTilt_deg.toFixed(2)}°</td>
          </tr>
        {/if}
        {#if result.scheimpflugPoint}
          <tr>
            <td>Scheimpflug 点 S (x,y)</td>
            <td class="v mono">({f(result.scheimpflugPoint.x, 2)}, {f(result.scheimpflugPoint.y, 2)}) {unit}</td>
          </tr>
        {/if}
        {#if result.hingePoint}
          <tr>
            <td>铰链点 J (x,y)</td>
            <td class="v mono">({f(result.hingePoint.x, 2)}, {f(result.hingePoint.y, 2)}) {unit}</td>
          </tr>
        {/if}
        <tr>
          <td>近景深（轴上）</td>
          <td class="v mono near">{f(result.nearLimit.axisDistance_mm)} {unit}</td>
        </tr>
        <tr>
          <td>远景深（轴上）</td>
          <td class="v mono far">{f(result.farLimit.axisDistance_mm)} {unit}</td>
        </tr>
      </tbody>
    </table>

    {#if result.warnings.length > 0}
      <div class="warnings">
        {#each result.warnings as w}<div>~ {w}</div>{/each}
      </div>
    {/if}
    {#if result.errors.length > 0}
      <div class="errors">
        {#each result.errors as e}<div>! {e}</div>{/each}
      </div>
    {/if}
  {/if}
</div>

<style>
  .info {
    font-size: 13px;
  }
  table {
    width: 100%;
    border-collapse: collapse;
  }
  td {
    padding: 5px 4px;
    border-bottom: 1px solid #f0eeec;
    vertical-align: top;
  }
  td:first-child {
    color: #57534e;
  }
  td.v {
    text-align: right;
  }
  .mono {
    font-family: ui-monospace, monospace;
  }
  .near {
    color: #b45309;
  }
  .far {
    color: #6d28d9;
  }
  .warnings,
  .errors {
    margin-top: 8px;
    font-size: 12px;
    line-height: 1.5;
    border-radius: 6px;
    padding: 8px 10px;
  }
  .warnings {
    background: #fffbeb;
    color: #92400e;
  }
  .errors {
    background: #fef2f2;
    color: #991b1b;
  }
  .errors ul {
    margin: 6px 0 0;
    padding-left: 18px;
  }
</style>
