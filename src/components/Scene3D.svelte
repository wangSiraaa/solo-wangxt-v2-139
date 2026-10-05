<script lang="ts">
  import { onDestroy, onMount } from 'svelte';
  import { get } from 'svelte/store';
  import * as THREE from 'three';
  import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
  import { params, result } from '../lib/store';
  import type { LensParams, OpticsResult, ProfileLine } from '../lib/optics';

  /** mm → 场景单位换算（1 单位 = 1 m） */
  const SCALE = 0.001;

  let container: HTMLDivElement;
  let renderer: THREE.WebGLRenderer;
  let scene: THREE.Scene;
  let camera: THREE.PerspectiveCamera;
  let controls: OrbitControls;
  let dynamic = new THREE.Group();
  let frame = 0;
  let resizeObserver: ResizeObserver;
  let unsubscribe: () => void;

  function disposeGroup(g: THREE.Group) {
    g.traverse((obj) => {
      const mesh = obj as THREE.Mesh;
      if (mesh.geometry) mesh.geometry.dispose();
      const mat = (mesh as THREE.Mesh).material as THREE.Material | THREE.Material[] | undefined;
      if (Array.isArray(mat)) mat.forEach((m) => m.dispose());
      else if (mat) mat.dispose();
    });
    g.clear();
  }

  /** 由剖面直线 z = slope·x + intercept 构造 3D 平面（沿 y 轴延伸） */
  function planeGroup(line: ProfileLine, size: number, color: number, opacity: number): THREE.Group {
    const g = new THREE.Group();
    const normal = new THREE.Vector3(-line.slope, 0, 1).normalize();
    g.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), normal);
    g.position.set(0, 0, line.intercept * SCALE);

    const mesh = new THREE.Mesh(
      new THREE.PlaneGeometry(size, size),
      new THREE.MeshBasicMaterial({
        color,
        transparent: true,
        opacity,
        side: THREE.DoubleSide,
        depthWrite: false
      })
    );
    g.add(mesh);

    const grid = new THREE.GridHelper(size, 12, color, color);
    grid.rotation.x = Math.PI / 2;
    const gm = grid.material as THREE.LineBasicMaterial;
    gm.transparent = true;
    gm.opacity = Math.min(0.8, opacity + 0.25);
    g.add(grid);
    return g;
  }

  function lineBetween(a: THREE.Vector3, b: THREE.Vector3, color: number, dashed = false): THREE.Line {
    const geo = new THREE.BufferGeometry().setFromPoints([a, b]);
    const mat = dashed
      ? new THREE.LineDashedMaterial({ color, dashSize: 0.04, gapSize: 0.03 })
      : new THREE.LineBasicMaterial({ color });
    const line = new THREE.Line(geo, mat);
    if (dashed) line.computeLineDistances();
    return line;
  }

  function rebuild(r: OpticsResult, p: LensParams) {
    disposeGroup(dynamic);
    scene.remove(dynamic);
    dynamic = new THREE.Group();
    scene.add(dynamic);

    const theta = (p.tiltDeg * Math.PI) / 180;
    const sp = r.valid ? r.imageDistance : p.focalLength;
    const E = Math.max(p.focusDistance, sp, 2 * p.focalLength) * SCALE;

    // 光轴
    dynamic.add(
      lineBetween(new THREE.Vector3(0, 0, -1.25 * E), new THREE.Vector3(0, 0, 0.6 * E), 0x55617a)
    );

    // 传感器（示意尺寸，未按比例）
    const sensorW = 0.3 * E;
    const sensorH = 0.2 * E;
    const sensor = new THREE.Mesh(
      new THREE.PlaneGeometry(sensorW, sensorH),
      new THREE.MeshBasicMaterial({ color: 0x3d6fb4, transparent: true, opacity: 0.6, side: THREE.DoubleSide })
    );
    sensor.position.set(0, 0, sp * SCALE);
    dynamic.add(sensor);
    dynamic.add(
      new THREE.LineSegments(
        new THREE.EdgesGeometry(sensor.geometry),
        new THREE.LineBasicMaterial({ color: 0x9ecbff })
      ).translateZ(sp * SCALE)
    );

    // 镜头（示意尺寸，绕 y 轴倾斜 θ）
    const lensGroup = new THREE.Group();
    const lensR = 0.16 * E;
    const lens = new THREE.Mesh(
      new THREE.CircleGeometry(lensR, 48),
      new THREE.MeshBasicMaterial({ color: 0x8a5cf6, transparent: true, opacity: 0.5, side: THREE.DoubleSide })
    );
    const ring = new THREE.LineLoop(
      new THREE.RingGeometry(lensR * 0.98, lensR, 64),
      new THREE.LineBasicMaterial({ color: 0xc4b5fd })
    );
    lensGroup.add(lens, ring);
    lensGroup.rotation.y = theta;
    dynamic.add(lensGroup);

    // 镜头到传感器边角的光束轮廓（仅示意视场，不代表景深）
    for (const sx of [-1, 1])
      for (const sy of [-1, 1])
        dynamic.add(
          lineBetween(
            new THREE.Vector3(0, 0, 0),
            new THREE.Vector3((sx * sensorW) / 2, (sy * sensorH) / 2, sp * SCALE),
            0x2c3547
          )
        );

    if (!r.valid) return; // 奇异/越界：不绘制任何计算平面

    // 清晰焦平面（目标平面）
    dynamic.add(planeGroup(r.focusPlane!, 1.6 * E, 0x2fbf71, 0.28));
    // 景深近/远界面
    if (r.nearPlane) dynamic.add(planeGroup(r.nearPlane, 1.6 * E, 0xe8a13a, 0.15));
    if (r.farPlane) dynamic.add(planeGroup(r.farPlane, 1.6 * E, 0xe8543a, 0.15));

    // 铰链线（过 H，平行于 y 轴）
    if (r.hinge) {
      const hx = r.hinge.x * SCALE;
      dynamic.add(
        lineBetween(new THREE.Vector3(hx, -E, 0), new THREE.Vector3(hx, E, 0), 0xb388ff, true)
      );
    }
    // Scheimpflug 线（过 S，平行于 y 轴）
    if (r.scheimpflugPoint) {
      const sx = r.scheimpflugPoint.x * SCALE;
      const sz = r.scheimpflugPoint.z * SCALE;
      dynamic.add(
        lineBetween(new THREE.Vector3(sx, -E, sz), new THREE.Vector3(sx, E, sz), 0xffd166, true)
      );
    }

    // 轴上被摄点
    const subject = new THREE.Mesh(
      new THREE.SphereGeometry(0.02 * E, 16, 16),
      new THREE.MeshBasicMaterial({ color: 0x2fbf71 })
    );
    subject.position.set(0, 0, -p.focusDistance * SCALE);
    dynamic.add(subject);
  }

  function resetView() {
    const p = get(params);
    const E = Math.max(p.focusDistance, 2 * p.focalLength) * SCALE;
    camera.position.set(1.1 * E, 0.7 * E, 0.9 * E);
    controls.target.set(0, 0, -0.4 * E);
    controls.update();
  }

  onMount(() => {
    renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setPixelRatio(window.devicePixelRatio);
    container.appendChild(renderer.domElement);

    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x12161f);
    camera = new THREE.PerspectiveCamera(50, 1, 0.001, 100);
    controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;

    scene.add(new THREE.AxesHelper(0.5));
    scene.add(dynamic);

    unsubscribe = result.subscribe((r) => rebuild(r, get(params)));
    resetView();

    resizeObserver = new ResizeObserver(() => {
      const w = container.clientWidth;
      const h = container.clientHeight;
      renderer.setSize(w, h);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
    });
    resizeObserver.observe(container);

    const loop = () => {
      frame = requestAnimationFrame(loop);
      controls.update();
      renderer.render(scene, camera);
    };
    loop();
  });

  onDestroy(() => {
    cancelAnimationFrame(frame);
    unsubscribe?.();
    resizeObserver?.disconnect();
    controls?.dispose();
    disposeGroup(dynamic);
    renderer?.dispose();
  });
</script>

<div class="scene-wrap">
  <div class="scene" bind:this={container}></div>
  <div class="overlay">
    <span class="chip axis">光轴 z</span>
    <span class="chip sensor">传感器</span>
    <span class="chip lens">镜头</span>
    <span class="chip focus">清晰焦平面</span>
    <span class="chip near">景深近界</span>
    <span class="chip far">景深远界</span>
    <span class="chip hinge">铰链线</span>
    <span class="chip scheimpflug">Scheimpflug 线</span>
  </div>
  <button type="button" class="reset" on:click={resetView}>重置视角</button>
  <p class="caution">传感器/镜头为示意尺寸；未渲染任何虚化材质，景深仅以计算平面表示。</p>
</div>

<style>
  .scene-wrap {
    position: relative;
    width: 100%;
    height: 100%;
    min-height: 320px;
  }
  .scene {
    position: absolute;
    inset: 0;
  }
  .overlay {
    position: absolute;
    top: 8px;
    left: 8px;
    display: flex;
    flex-wrap: wrap;
    gap: 4px;
    max-width: 70%;
  }
  .chip {
    font-size: 11px;
    padding: 2px 7px;
    border-radius: 10px;
    background: rgba(18, 22, 31, 0.8);
    border: 1px solid #2c3547;
  }
  .axis { color: #8fa0b8; }
  .sensor { color: #9ecbff; }
  .lens { color: #c4b5fd; }
  .focus { color: #2fbf71; }
  .near { color: #e8a13a; }
  .far { color: #e8543a; }
  .hinge { color: #b388ff; }
  .scheimpflug { color: #ffd166; }
  .reset {
    position: absolute;
    top: 8px;
    right: 8px;
    background: #2b3a55;
    color: #dfe8f5;
    border: 1px solid #3d4f74;
    border-radius: 4px;
    padding: 4px 10px;
    font-size: 12px;
    cursor: pointer;
  }
  .caution {
    position: absolute;
    bottom: 6px;
    left: 8px;
    margin: 0;
    font-size: 11px;
    color: #8fa0b8;
  }
</style>
