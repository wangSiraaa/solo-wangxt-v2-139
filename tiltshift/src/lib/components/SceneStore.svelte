<script lang="ts">
  import { onMount } from 'svelte';
  import type { LengthUnit, SceneInput } from '../optics/types';
  import { deleteScene, listScenes, newId, saveScene, type StoredScene } from '../storage/idb';
  import { reportToJson, reportToText } from '../exportReport';
  import type { SceneResult } from '../optics/types';

  interface Props {
    input: SceneInput;
    result: SceneResult;
    unit: LengthUnit;
    onload: (input: SceneInput, unit: LengthUnit) => void;
  }
  let { input, result, unit, onload }: Props = $props();

  let scenes = $state<StoredScene[]>([]);
  let name = $state('未命名场景');
  let status = $state('');

  async function refresh() {
    try {
      scenes = await listScenes();
    } catch (e) {
      status = `本地存储不可用：${(e as Error).message}`;
    }
  }
  onMount(refresh);

  async function save() {
    const scene: StoredScene = { id: newId(), name: name || '未命名场景', updatedAt: Date.now(), input, unit };
    await saveScene(scene);
    status = `已保存「${scene.name}」到浏览器 IndexedDB`;
    await refresh();
  }

  async function remove(id: string) {
    await deleteScene(id);
    await refresh();
  }

  function load(s: StoredScene) {
    onload({ ...s.input }, s.unit);
    name = s.name;
    status = `已载入「${s.name}」`;
  }

  function download(filename: string, content: string, type: string) {
    const blob = new Blob([content], { type });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  }

  const stamp = () => new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-');

  function exportJson() {
    download(`tiltshift-${stamp()}.json`, reportToJson(input, result, unit), 'application/json');
  }
  function exportText() {
    download(`tiltshift-${stamp()}.txt`, reportToText(input, result, unit), 'text/plain');
  }
</script>

<div class="store">
  <div class="save-row">
    <input bind:value={name} placeholder="场景名称" />
    <button onclick={save}>保存到本地</button>
  </div>

  {#if scenes.length > 0}
    <ul class="scenes">
      {#each scenes as s (s.id)}
        <li>
          <button class="load" onclick={() => load(s)} title="载入">
            <strong>{s.name}</strong>
            <span>{new Date(s.updatedAt).toLocaleString()}</span>
            <span class="params">
              f={s.input.focalLength_mm}mm F/{s.input.fNumber} θ={s.input.tilt_deg}° s={s.input.focusDistance_mm}mm
              c={s.input.coc_mm}mm
            </span>
          </button>
          <button class="del" onclick={() => remove(s.id)} title="删除">×</button>
        </li>
      {/each}
    </ul>
  {/if}

  <div class="export-row">
    <button onclick={exportJson}>导出 JSON（含简化假设）</button>
    <button onclick={exportText}>导出文本报告</button>
  </div>

  {#if status}<div class="status">{status}</div>{/if}
</div>

<style>
  .store {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }
  .save-row,
  .export-row {
    display: flex;
    gap: 8px;
  }
  input {
    flex: 1;
    padding: 6px 8px;
    border: 1px solid #d6d3d1;
    border-radius: 6px;
    font: inherit;
    font-size: 13px;
  }
  button {
    border: 1px solid #292524;
    background: #292524;
    color: white;
    border-radius: 6px;
    padding: 6px 12px;
    cursor: pointer;
    font-size: 13px;
  }
  button:hover {
    background: #44403c;
  }
  .export-row button {
    background: white;
    color: #292524;
  }
  .export-row button:hover {
    background: #f5f5f4;
  }
  ul.scenes {
    list-style: none;
    margin: 0;
    padding: 0;
    display: flex;
    flex-direction: column;
    gap: 6px;
    max-height: 220px;
    overflow: auto;
  }
  ul.scenes li {
    display: flex;
    gap: 4px;
    align-items: stretch;
  }
  button.load {
    flex: 1;
    text-align: left;
    background: #f5f5f4;
    color: #292524;
    border-color: #e7e5e4;
    display: flex;
    flex-direction: column;
    gap: 2px;
    padding: 6px 10px;
  }
  button.load span {
    font-size: 11px;
    color: #78716c;
    font-family: ui-monospace, monospace;
  }
  button.del {
    padding: 0 10px;
    background: #fef2f2;
    color: #b91c1c;
    border-color: #fecaca;
  }
  .status {
    font-size: 12px;
    color: #047857;
  }
</style>
