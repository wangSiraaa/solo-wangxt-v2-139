<script lang="ts">
  import { onMount } from 'svelte';
  import { params } from '../lib/store';
  import { deleteScene, listScenes, saveScene, type SavedScene } from '../lib/db';

  let scenes: SavedScene[] = [];
  let name = '';
  let dbError = '';

  async function refresh() {
    try {
      scenes = await listScenes();
      dbError = '';
    } catch {
      dbError = 'IndexedDB 不可用，无法保存场景';
    }
  }

  async function save() {
    const sceneName = name.trim() || `场景 ${new Date().toLocaleString()}`;
    try {
      await saveScene({ name: sceneName, createdAt: Date.now(), params: { ...$params } });
      name = '';
      await refresh();
    } catch {
      dbError = '保存失败：IndexedDB 不可用';
    }
  }

  function load(s: SavedScene) {
    params.set({ ...s.params });
  }

  async function remove(id: number | undefined) {
    if (id === undefined) return;
    await deleteScene(id);
    await refresh();
  }

  onMount(refresh);
</script>

<section class="panel">
  <h2>本地场景（IndexedDB，无后端）</h2>
  <div class="save-row">
    <input placeholder="场景名称" bind:value={name} />
    <button type="button" on:click={save}>保存当前参数</button>
  </div>
  {#if dbError}
    <p class="error">{dbError}</p>
  {/if}
  {#if scenes.length === 0 && !dbError}
    <p class="empty">暂无已保存场景</p>
  {/if}
  <ul>
    {#each scenes as s (s.id)}
      <li>
        <button type="button" class="name" on:click={() => load(s)} title="点击载入">
          {s.name}
        </button>
        <span class="meta">
          f={s.params.focalLength}mm N={s.params.fNumber} θ={s.params.tiltDeg}°
        </span>
        <button type="button" class="del" on:click={() => remove(s.id)}>删除</button>
      </li>
    {/each}
  </ul>
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
  .save-row {
    display: flex;
    gap: 8px;
  }
  input {
    flex: 1;
    background: #12161f;
    color: #e6ecf3;
    border: 1px solid #38445a;
    border-radius: 4px;
    padding: 5px 7px;
    font-size: 13px;
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
  ul {
    list-style: none;
    margin: 10px 0 0;
    padding: 0;
    display: flex;
    flex-direction: column;
    gap: 6px;
    max-height: 180px;
    overflow-y: auto;
  }
  li {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 12px;
  }
  .name {
    flex: 0 1 auto;
    text-align: left;
  }
  .meta {
    color: #8fa0b8;
    flex: 1;
  }
  .del {
    background: #4a2430;
    border-color: #6e3547;
  }
  .error {
    color: #ffb3bd;
    font-size: 12px;
  }
  .empty {
    color: #8fa0b8;
    font-size: 12px;
  }
</style>
