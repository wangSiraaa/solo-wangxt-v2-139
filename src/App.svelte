<script lang="ts">
  import Controls from './components/Controls.svelte';
  import Profile2D from './components/Profile2D.svelte';
  import Readout from './components/Readout.svelte';
  import Scene3D from './components/Scene3D.svelte';
  import SceneList from './components/SceneList.svelte';
  import { displayUnit, params, result } from './lib/store';
  import { ASSUMPTIONS, buildExport, downloadJSON } from './lib/export';

  let showAssumptions = false;

  function doExport() {
    downloadJSON(
      buildExport($params, $result, $displayUnit),
      `tilt-shift-lab-${new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-')}.json`
    );
  }
</script>

<header>
  <h1>移轴镜头焦平面实验室</h1>
  <p>
    薄透镜近轴模型 · Scheimpflug 原理 · 景深由用户给定弥散圈计算（非视觉清晰材质）
  </p>
</header>

<main>
  <div class="left">
    <Controls />
    <Readout />
    <SceneList />
  </div>
  <div class="right">
    <div class="scene3d"><Scene3D /></div>
    <div class="profile"><Profile2D /></div>
  </div>
</main>

<footer>
  <div class="actions">
    <button type="button" on:click={doExport}>导出结果 JSON（含简化假设）</button>
    <button type="button" on:click={() => (showAssumptions = !showAssumptions)}>
      {showAssumptions ? '隐藏' : '查看'}模型简化假设
    </button>
  </div>
  {#if showAssumptions}
    <ol>
      {#each ASSUMPTIONS as a}
        <li>{a}</li>
      {/each}
    </ol>
  {/if}
</footer>

<style>
  :global(body) {
    margin: 0;
    background: #12161f;
    color: #e6ecf3;
    font-family: 'Segoe UI', 'PingFang SC', 'Microsoft YaHei', sans-serif;
  }
  header {
    padding: 14px 20px 6px;
  }
  header h1 {
    margin: 0;
    font-size: 20px;
    color: #9ecbff;
  }
  header p {
    margin: 4px 0 0;
    font-size: 12px;
    color: #8fa0b8;
  }
  main {
    display: grid;
    grid-template-columns: 340px 1fr;
    gap: 12px;
    padding: 12px 20px;
    align-items: start;
  }
  .left {
    display: flex;
    flex-direction: column;
    gap: 12px;
  }
  .right {
    display: grid;
    grid-template-rows: minmax(340px, 46vh) auto;
    gap: 12px;
  }
  .scene3d {
    border: 1px solid #2c3547;
    border-radius: 8px;
    overflow: hidden;
    min-height: 340px;
  }
  footer {
    padding: 0 20px 20px;
  }
  .actions {
    display: flex;
    gap: 10px;
  }
  footer button {
    background: #2b3a55;
    color: #dfe8f5;
    border: 1px solid #3d4f74;
    border-radius: 4px;
    padding: 6px 14px;
    font-size: 13px;
    cursor: pointer;
  }
  footer button:hover {
    background: #36496e;
  }
  footer ol {
    font-size: 12px;
    color: #8fa0b8;
    line-height: 1.7;
  }
  @media (max-width: 900px) {
    main {
      grid-template-columns: 1fr;
    }
  }
</style>
