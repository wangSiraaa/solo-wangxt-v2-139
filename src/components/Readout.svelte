<script lang="ts">
  import { result, displayUnit } from '../lib/store';
  import { formatLength } from '../lib/units';

  $: r = $result;
  $: u = $displayUnit;
</script>

<section class="panel">
  <h2>计算结果（{r.mode === 'parallel' ? '普通平行焦面' : 'Scheimpflug 倾斜焦面'}）</h2>
  {#if r.valid}
    <dl>
      <div><dt>像距 s′</dt><dd>{formatLength(r.imageDistance, u)}</dd></div>
      <div><dt>放大率 m</dt><dd>{r.magnification.toFixed(4)}×</dd></div>
      <div><dt>焦平面倾角 ψ</dt><dd>{r.focusPlaneTiltDeg.toFixed(2)}°</dd></div>
      <div><dt>景深近端（轴上）</dt><dd>{formatLength(r.nearDistance, u)}</dd></div>
      <div><dt>景深远端（轴上）</dt><dd>{formatLength(r.farDistance, u)}</dd></div>
      <div><dt>超焦距 H</dt><dd>{formatLength(r.hyperfocal, u)}</dd></div>
      <div><dt>像方焦深 ±N·c</dt><dd>±{formatLength(r.depthOfFocus / 2, 'mm')}</dd></div>
      {#if r.hinge}
        <div>
          <dt>铰链点 H</dt>
          <dd>x={formatLength(r.hinge.x, u)}，J=|x|={formatLength(Math.abs(r.hinge.x), u)}</dd>
        </div>
      {/if}
      {#if r.scheimpflugPoint}
        <div>
          <dt>Scheimpflug 点 S</dt>
          <dd>
            x={formatLength(r.scheimpflugPoint.x, u)}，z={formatLength(r.scheimpflugPoint.z, u)}
          </dd>
        </div>
      {/if}
    </dl>
    <p class="note">
      焦平面方程（剖面）：z = {r.focusPlane ? r.focusPlane.slope.toFixed(4) : '—'}·x
      {r.focusPlane ? (r.focusPlane.intercept >= 0 ? ' + ' : ' − ') + Math.abs(r.focusPlane.intercept).toFixed(2) : ''}
      （mm）
    </p>
  {:else}
    <p class="invalid">当前参数处于奇异角度或模型适用范围之外，已停止给出精确结果。</p>
  {/if}
</section>

<style>
  .panel {
    background: #1c2230;
    border: 1px solid #2c3547;
    border-radius: 8px;
    padding: 12px 14px;
  }
  h2 {
    margin: 0 0 8px;
    font-size: 15px;
    color: #9ecbff;
  }
  dl {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 6px 16px;
    margin: 0;
  }
  dl > div {
    display: flex;
    justify-content: space-between;
    gap: 8px;
    font-size: 13px;
  }
  dt {
    color: #8fa0b8;
  }
  dd {
    margin: 0;
    color: #e6ecf3;
    font-variant-numeric: tabular-nums;
  }
  .note {
    margin: 10px 0 0;
    font-size: 12px;
    color: #8fa0b8;
  }
  .invalid {
    color: #ffb3bd;
    font-size: 13px;
  }
</style>
