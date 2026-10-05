<script lang="ts">
  import { inputStore, resultStore, unitStore } from './lib/state';
  import type { LengthUnit, SceneInput } from './lib/optics/types';
  import Controls from './lib/components/Controls.svelte';
  import InfoPanel from './lib/components/InfoPanel.svelte';
  import Section2D from './lib/components/Section2D.svelte';
  import Scene3D from './lib/components/Scene3D.svelte';
  import SceneStore from './lib/components/SceneStore.svelte';

  const inputVal = $derived($inputStore);
  const resultVal = $derived($resultStore);
  const unitVal = $derived($unitStore);

  function setInput(next: SceneInput) {
    inputStore.set(next);
  }
  function setUnit(u: LengthUnit) {
    unitStore.set(u);
  }
  function loadScene(i: SceneInput, u: LengthUnit) {
    inputStore.set(i);
    unitStore.set(u);
  }

  let sectionMode = $state<'overview' | 'detail'>('overview');
</script>

<main>
  <header>
    <h1>移轴镜头焦平面实验室</h1>
    <p class="sub">
      薄透镜近轴模型 · 普通平行焦面与 Scheimpflug 情形分别处理 · 景深只按用户给定弥散圆标准判定
    </p>
  </header>

  <div class="layout">
    <aside class="sidebar">
      <Controls input={inputVal} unit={unitVal} onchange={setInput} onunit={setUnit} />
      <InfoPanel result={resultVal} unit={unitVal} />
      <details>
        <summary>本地场景（IndexedDB）与导出</summary>
        <SceneStore input={inputVal} result={resultVal} unit={unitVal} onload={loadScene} />
      </details>
    </aside>

    <section class="stage">
      <div class="panel-card">
        <h2>三维场景（传感器 · 透镜 · 合焦面 · 景深楔）</h2>
        <Scene3D input={inputVal} result={resultVal} unit={unitVal} />
      </div>
    </section>
  </div>

  <section class="sections">
    <div class="panel-card">
      <div class="card-head">
        <h2>二维光路剖面</h2>
        <div class="toggle">
          <button class:active={sectionMode === 'overview'} onclick={() => (sectionMode = 'overview')}>
            物方全尺度
          </button>
          <button class:active={sectionMode === 'detail'} onclick={() => (sectionMode = 'detail')}>
            透镜/传感器细节
          </button>
        </div>
      </div>
      <Section2D input={inputVal} result={resultVal} unit={unitVal} mode={sectionMode} />
      <p class="note">
        二维与三维由同一份 <code>computeScene()</code> 结果驱动。绿色为精确合焦面；橙/紫为以弥散圆
        c={inputVal.coc_mm} mm 判定的近/远可接受平面（经数值核验为绕铰链线 J 的平面）；
        红线为铰链线，青色为 Scheimpflug 交线。材质本身不表达景深。
      </p>
    </div>
  </section>

  <footer>
    模型：薄透镜近轴，像面不摆、仅镜头 tilt，光阑 ρ=f/(2N)；景深取弥散椭圆沿倾斜轴分量 d_z
    （等值面严格过铰链线），d_y 仅作长轴包络参考。角度 ±8.5°、F≥1.0、物距≥50mm
    之外停止精确结果。导出文件含完整简化假设。
  </footer>
</main>

<style></style>
