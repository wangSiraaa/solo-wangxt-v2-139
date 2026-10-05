<script lang="ts">
  import { onMount } from 'svelte';
  import type { LengthUnit, Plane3, SceneInput, SceneResult } from '../optics/types';
  import { fromMm } from '../optics/geometry';
  import { LIMITS } from '../optics/model';
  import * as THREE from 'three';
  import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';

  interface Props {
    input: SceneInput;
    result: SceneResult;
    unit: LengthUnit;
  }
  let { input, result, unit }: Props = $props();

  let container: HTMLDivElement;
  let renderer: THREE.WebGLRenderer;
  let scene: THREE.Scene;
  let camera: THREE.PerspectiveCamera;
  let controls: OrbitControls;
  let group: THREE.Group;

  const COLORS = {
    sensor: 0x2563eb,
    lens: 0x111827,
    focal: 0x059669,
    near: 0xd97706,
    far: 0x7c3aed,
    hinge: 0xdc2626,
    axis: 0xa8a29e,
  };

  onMount(() => {
    renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    container.appendChild(renderer.domElement);
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0xfafaf9);
    camera = new THREE.PerspectiveCamera(45, 1, 0.1, 1e6);
    controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;

    scene.add(new THREE.AmbientLight(0xffffff, 1));
    group = new THREE.Group();
    scene.add(group);

    const resize = () => {
      const w = container.clientWidth;
      const h = container.clientHeight;
      renderer.setSize(w, h, false);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
    };
    const ro = new ResizeObserver(resize);
    ro.observe(container);
    resize();

    let raf = 0;
    const loop = () => {
      controls.update();
      renderer.render(scene, camera);
      raf = requestAnimationFrame(loop);
    };
    loop();

    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      controls.dispose();
      renderer.dispose();
      renderer.domElement.remove();
    };
  });

  type PlaneSize = { along: number; across: number; center: [number, number, number] };

  /** 由 Plane3 生成带边框的半透明矩形（沿 z 轴有宽度 across） */
  function makePlane(
    plane: Plane3,
    size: PlaneSize,
    color: number,
    opacity: number,
    label: string | undefined,
    labelScale: number,
  ): THREE.Group {
    const g = new THREE.Group();
    const geom = new THREE.PlaneGeometry(size.across, size.along, 1, 1);
    const mat = new THREE.MeshBasicMaterial({
      color,
      transparent: true,
      opacity,
      side: THREE.DoubleSide,
      depthWrite: false,
    });
    const mesh = new THREE.Mesh(geom, mat);
    // PlaneGeometry 默认法向 +z，先转到 +x，再转到目标法向
    const base = new THREE.Quaternion().setFromUnitVectors(
      new THREE.Vector3(0, 0, 1),
      new THREE.Vector3(1, 0, 0),
    );
    const n = new THREE.Vector3(...plane.normal).normalize();
    const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(1, 0, 0), n);
    mesh.quaternion.copy(q.multiply(base));
    mesh.position.set(...size.center);
    g.add(mesh);

    const edges = new THREE.LineSegments(
      new THREE.EdgesGeometry(geom),
      new THREE.LineBasicMaterial({ color, transparent: true, opacity: Math.min(1, opacity + 0.3) }),
    );
    edges.quaternion.copy(mesh.quaternion);
    edges.position.copy(mesh.position);
    g.add(edges);

    if (label) {
      const sprite = makeLabel(label, color, labelScale);
      sprite.position.set(...size.center);
      // 沿法向偏移一点（随场景尺度缩放，小场景下限 8 mm）
      sprite.position.add(n.clone().multiplyScalar(Math.max(8, labelScale * 0.012)));
      g.add(sprite);
    }
    return g;
  }

  function makeLabel(text: string, color: number, worldScale: number): THREE.Sprite {
    const c = document.createElement('canvas');
    c.width = 256;
    c.height = 64;
    const ctx = c.getContext('2d')!;
    ctx.fillStyle = 'rgba(255,255,255,0.85)';
    ctx.fillRect(0, 0, c.width, c.height);
    ctx.font = '28px system-ui, sans-serif';
    ctx.fillStyle = '#' + new THREE.Color(color).getHexString();
    ctx.textBaseline = 'middle';
    ctx.textAlign = 'center';
    ctx.fillText(text, c.width / 2, c.height / 2);
    const tex = new THREE.CanvasTexture(c);
    const mat = new THREE.SpriteMaterial({ map: tex, transparent: true, depthTest: false });
    const s = new THREE.Sprite(mat);
    const k = worldScale / 900;
    s.scale.set(120 * k, 30 * k, 1);
    s.renderOrder = 999;
    return s;
  }

  function makeLine(points: [number, number, number][], color: number, dashed = false): THREE.Line {
    const geom = new THREE.BufferGeometry().setFromPoints(points.map((p) => new THREE.Vector3(...p)));
    const mat = dashed
      ? new THREE.LineDashedMaterial({ color, dashSize: 12, gapSize: 8 })
      : new THREE.LineBasicMaterial({ color });
    const line = new THREE.Line(geom, mat);
    if (dashed) line.computeLineDistances();
    return line;
  }

  function clearGroup() {
    if (!group) return;
    for (const child of [...group.children]) {
      group.remove(child);
      child.traverse((o) => {
        const anyO = o as THREE.Mesh;
        if (anyO.geometry) anyO.geometry.dispose();
        const m = anyO.material as THREE.Material | THREE.Material[] | undefined;
        if (Array.isArray(m)) m.forEach((mm) => mm.dispose());
        else m?.dispose();
      });
    }
  }

  /** 由平面法向求面内竖直方向（xy 面内、垂直于法向）：u = z × n */
  function inPlaneUp(n: THREE.Vector3): THREE.Vector3 {
    return new THREE.Vector3(-n.y, n.x, 0).normalize();
  }

  /** 物方大平面：让矩形沿 u 覆盖世界 y∈[yLow,yHigh]，z 向宽度 across */
  function objectSheet(
    plane: Plane3,
    yLow: number,
    yHigh: number,
    across: number,
    color: number,
    opacity: number,
    label: string,
    labelScale: number,
  ): THREE.Group {
    const n = new THREE.Vector3(...plane.normal).normalize();
    const u = inPlaneUp(n);
    const p0 = new THREE.Vector3(...plane.point);
    // 平面上 y=yLow / y=yHigh 的点参数（u_y = n.x）
    const tLow = (yLow - p0.y) / n.x;
    const tHigh = (yHigh - p0.y) / n.x;
    const along = Math.abs(tHigh - tLow);
    const center = p0.clone().add(u.clone().multiplyScalar((tLow + tHigh) / 2));
    return makePlane(
      plane,
      { along, across, center: [center.x, center.y, 0] },
      color,
      opacity,
      label,
      labelScale,
    );
  }

  /** 传感器/透镜：真实小尺寸薄片，中心在各自直线与 y=0 的交点附近 */
  function physicalSheet(
    plane: Plane3,
    along: number,
    across: number,
    yCenter: number,
    color: number,
    opacity: number,
    label: string,
    labelScale: number,
  ): THREE.Group {
    const n = new THREE.Vector3(...plane.normal).normalize();
    const u = inPlaneUp(n);
    const p0 = new THREE.Vector3(...plane.point);
    const tc = (yCenter - p0.y) / n.x;
    const center = p0.clone().add(u.multiplyScalar(tc));
    return makePlane(
      plane,
      { along, across, center: [center.x, center.y, 0] },
      color,
      opacity,
      label,
      labelScale,
    );
  }

  function rebuild() {
    if (!renderer || !result) return;
    clearGroup();
    if (!result.applicable) return;

    const s = input.focusDistance_mm;
    const f = input.focalLength_mm;
    let far = result.farLimit.axisDistance_mm ?? s * 1.4;
    if (!Number.isFinite(far)) far = Math.min(s * 1.6, LIMITS.farInfinity_mm);
    const spanX = far;
    // 物方高度范围与二维剖面保持一致
    let yLow: number;
    let yHigh: number;
    if (result.hingePoint) {
      yLow = result.hingePoint.y * 1.08;
      yHigh = Math.abs(yLow) * 0.55;
    } else {
      const near = result.nearLimit.axisDistance_mm ?? s * 0.7;
      const h = Math.max(Math.abs(far - near) * 0.9, s * 0.08);
      yLow = -h;
      yHigh = h;
    }
    const halfZ = Math.max(60, Math.abs(yLow) * 0.5);

    // 传感器（约全画幅 36×24 示意）与透镜（44 mm 示意）保持真实小尺寸
    const labelScale = spanX;
    const smallLabelScale = 90;
    group.add(
      physicalSheet(result.sensorPlane, 42, 30, 0, COLORS.sensor, 0.28, '传感器', smallLabelScale),
    );
    group.add(
      physicalSheet(result.lensPlane, 44, 44, 0, COLORS.lens, 0.2, '透镜', smallLabelScale),
    );
    // 物方三面：大平面覆盖景深楔（低不透明度，靠边线区分）
    if (result.focalPlane)
      group.add(objectSheet(result.focalPlane, yLow, yHigh, halfZ * 2, COLORS.focal, 0.09, '合焦面', labelScale));
    if (result.nearLimit.plane)
      group.add(objectSheet(result.nearLimit.plane, yLow, yHigh, halfZ * 2, COLORS.near, 0.07, '近极限', labelScale));
    if (result.farLimit.plane)
      group.add(objectSheet(result.farLimit.plane, yLow, yHigh, halfZ * 2, COLORS.far, 0.07, '远极限', labelScale));

    // 参考地面（x-z 平面，位于最低点 yLow）
    const gridSize = Math.max(2000, Math.ceil(spanX / 500) * 500);
    const gridFloor = new THREE.GridHelper(gridSize, gridSize / 100, 0xd6d3d1, 0xe7e5e4);
    gridFloor.position.set(gridSize / 2 - 100, yLow, 0);
    group.add(gridFloor);

    // 坐标轴：x 被摄体（绿）、y 竖直（红）、z 倾斜轴（蓝）
    const axisLen = Math.min(spanX * 0.25, 600);
    const axisGroup = new THREE.Group();
    const axisDefs: [[number, number, number], number][] = [
      [[axisLen, 0, 0], COLORS.focal],
      [[0, axisLen * 0.6, 0], COLORS.hinge],
      [[0, 0, axisLen * 0.6], 0x2563eb],
    ];
    for (const [end, color] of axisDefs) {
      axisGroup.add(makeLine([[0, 0, 0], end], color));
    }
    group.add(axisGroup);

    // 原光轴
    group.add(
      makeLine(
        [
          [result.v_mm ? -result.v_mm * 1.2 : -f * 2, 0, 0],
          [spanX, 0, 0],
        ],
        COLORS.axis,
        true,
      ),
    );

    // 铰链线（沿 z）
    if (result.hingePoint) {
      const J = result.hingePoint;
      group.add(
        makeLine(
          [
            [J.x, J.y, -halfZ],
            [J.x, J.y, halfZ],
          ],
          COLORS.hinge,
        ),
      );
    }
    // Scheimpflug 交线（沿 z）：传感器 ∩ 透镜
    if (result.scheimpflugPoint) {
      const S = result.scheimpflugPoint;
      group.add(makeLine([[S.x, S.y, -halfZ], [S.x, S.y, halfZ]], 0x0891b2));
    }

    // 相机取景：拉远并抬高，从被摄体侧上方俯瞰整个景深楔
    const camDist = Math.max(spanX * 1.25, 1200);
    camera.position.set(-spanX * 0.05, Math.abs(yLow) * 1.15 + 120, camDist);
    camera.near = 1;
    camera.far = camDist * 20;
    camera.updateProjectionMatrix();
    controls.target.set(spanX * 0.42, yLow * 0.25, 0);
    controls.minDistance = 60;
    controls.maxDistance = camDist * 8;
    controls.update();
  }

  $effect(() => {
    // 依赖输入与结果，场景重建
    void input;
    void result;
    void unit;
    rebuild();
  });
</script>

<div class="three-host" bind:this={container}>
  {#if !result.applicable}
    <div class="blocked">
      <strong>模型不适用，停止给出精确三维结果</strong>
      <ul>
        {#each result.errors as e}<li>{e}</li>{/each}
      </ul>
    </div>
  {/if}
</div>

<div class="hint">
  拖动旋转 · 滚轮缩放 · 坐标单位 {unit}（内部 mm：
  对焦 {fromMm(input.focusDistance_mm, unit).toFixed(1)} {unit}，像距 {result.applicable ? fromMm(result.v_mm, unit).toFixed(3) : '—'} {unit}）
</div>

<style>
  .three-host {
    position: relative;
    width: 100%;
    height: 460px;
    border-radius: 10px;
    overflow: hidden;
    background: #fafaf9;
    border: 1px solid #e7e5e4;
  }
  :global(.three-host canvas) {
    display: block;
  }
  .blocked {
    position: absolute;
    inset: 0;
    display: flex;
    flex-direction: column;
    justify-content: center;
    padding: 0 12%;
    color: #991b1b;
    background: rgba(254, 242, 242, 0.92);
    font-size: 14px;
  }
  .blocked ul {
    margin: 8px 0 0;
    padding-left: 18px;
  }
  .hint {
    font-size: 12px;
    color: #78716c;
    padding: 6px 4px;
  }
</style>
