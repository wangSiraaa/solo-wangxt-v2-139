<script lang="ts">
  import { params, result } from '../lib/store';
  import type { LensParams, OpticsResult, ProfileLine } from '../lib/optics';

  interface View {
    E: number;
    xMin: number;
    yMin: number;
    w: number;
    h: number;
  }

  interface Seg {
    x1: number;
    y1: number;
    x2: number;
    y2: number;
  }

  /** 剖面坐标：SVG X = z（光轴，右为正），SVG Y = x（横向，下为正） */
  function computeView(r: OpticsResult, p: LensParams): View {
    const pts = [p.focusDistance, p.focalLength * 2, r.valid ? r.imageDistance : p.focalLength];
    const limit = 6 * p.focusDistance;
    if (r.hinge && Math.abs(r.hinge.x) < limit) pts.push(Math.abs(r.hinge.x));
    if (r.scheimpflugPoint && Math.abs(r.scheimpflugPoint.x) < limit) {
      pts.push(Math.abs(r.scheimpflugPoint.x), Math.abs(r.scheimpflugPoint.z));
    }
    const E = Math.max(...pts) * 1.15;
    const xMin = -1.02 * E;
    const yMin = -0.72 * E;
    return { E, xMin, yMin, w: 1.52 * E - xMin, h: 1.44 * E };
  }

  /** 平面直线在 ±B 处的两个端点（交给 SVG 视口裁剪） */
  function seg(line: ProfileLine, B: number): Seg {
    return {
      x1: line.slope * -B + line.intercept,
      y1: -B,
      x2: line.slope * B + line.intercept,
      y2: B
    };
  }

  /** 景深楔形多边形（近界与远界/焦平面之间） */
  function wedge(a: ProfileLine, b: ProfileLine, B: number): string {
    const p1 = seg(a, B);
    const p2 = seg(b, B);
    return `${p1.x1},${p1.y1} ${p1.x2},${p1.y2} ${p2.x2},${p2.y2} ${p2.x1},${p2.y1}`;
  }

  $: r = $result;
  $: p = $params;
  $: view = computeView(r, p);
  $: B = 8 * view.E;
  $: theta = (p.tiltDeg * Math.PI) / 180;
  $: sp = r.valid ? r.imageDistance : p.focalLength;
  $: farMissing = r.valid && r.farPlane === null;
  // 预计算各线段与楔形，避免在模板中使用 TS 断言
  $: focusSeg = r.valid && r.focusPlane ? seg(r.focusPlane, B) : null;
  $: nearSeg = r.valid && r.nearPlane ? seg(r.nearPlane, B) : null;
  $: farSeg = r.valid && r.farPlane ? seg(r.farPlane, B) : null;
  $: wedgePoints =
    r.valid && r.nearPlane && r.focusPlane
      ? wedge(r.nearPlane, r.farPlane ?? r.focusPlane, B)
      : '';
</script>

<section class="panel">
  <h2>二维剖面（沿倾斜转轴观察，与 3D 场景同步）</h2>
  <svg viewBox="{view.xMin} {view.yMin} {view.w} {view.h}" preserveAspectRatio="xMidYMid meet">
    <!-- 景深楔形 -->
    {#if wedgePoints}
      <polygon points={wedgePoints} fill="#e8a13a" opacity="0.12" />
    {/if}

    <!-- 光轴 -->
    <line x1={view.xMin} y1="0" x2={0.5 * view.E} y2="0" stroke="#55617a" vector-effect="non-scaling-stroke" />

    <!-- 镜头平面 -->
    <line
      x1={B * Math.tan(theta)}
      y1={-B}
      x2={-B * Math.tan(theta)}
      y2={B}
      stroke="#8a5cf6"
      stroke-width="2"
      vector-effect="non-scaling-stroke"
    />

    <!-- 传感器 -->
    <line
      x1={sp}
      y1={-0.22 * view.E}
      x2={sp}
      y2={0.22 * view.E}
      stroke="#3d6fb4"
      stroke-width="4"
      vector-effect="non-scaling-stroke"
    />

    {#if focusSeg}
      <line {...focusSeg} stroke="#2fbf71" stroke-width="2" vector-effect="non-scaling-stroke" />
    {/if}
    {#if nearSeg}
      <line {...nearSeg} stroke="#e8a13a" stroke-dasharray="6 4" vector-effect="non-scaling-stroke" />
    {/if}
    {#if farSeg}
      <line {...farSeg} stroke="#e8543a" stroke-dasharray="6 4" vector-effect="non-scaling-stroke" />
    {/if}

    {#if r.valid && r.hinge}
      <circle cx={r.hinge.z} cy={r.hinge.x} r={0.012 * view.E} fill="#b388ff" />
      <text x={r.hinge.z} y={r.hinge.x - 0.03 * view.E} font-size={0.05 * view.E} fill="#b388ff">H</text>
    {/if}
    {#if r.valid && r.scheimpflugPoint}
      <circle cx={r.scheimpflugPoint.z} cy={r.scheimpflugPoint.x} r={0.012 * view.E} fill="#ffd166" />
      <text
        x={r.scheimpflugPoint.z + 0.02 * view.E}
        y={r.scheimpflugPoint.x}
        font-size={0.05 * view.E}
        fill="#ffd166">S</text
      >
    {/if}
    {#if r.valid}
      <circle cx={-p.focusDistance} cy="0" r={0.014 * view.E} fill="#2fbf71" />
    {/if}

    <!-- 坐标标注 -->
    <text x={0.42 * view.E} y={-0.03 * view.E} font-size={0.05 * view.E} fill="#8fa0b8">z（光轴）→</text>
    <text x={0.02 * view.E} y={-0.62 * view.E} font-size={0.05 * view.E} fill="#8fa0b8">x ↑</text>
    <text x={sp + 0.015 * view.E} y={0.24 * view.E} font-size={0.045 * view.E} fill="#9ecbff">传感器</text>
    <text x={0.02 * view.E} y={0.1 * view.E} font-size={0.045 * view.E} fill="#c4b5fd">镜头</text>
    {#if !r.valid}
      <text x={view.xMin + 0.05 * view.E} y={-0.5 * view.E} font-size={0.06 * view.E} fill="#ffb3bd">
        参数超出模型适用范围：不绘制计算平面
      </text>
    {/if}
    {#if farMissing}
      <text x={view.xMin + 0.05 * view.E} y={0.62 * view.E} font-size={0.045 * view.E} fill="#e8543a">
        景深远端延伸至无穷远（楔形在焦平面与近界之间仅示意近侧）
      </text>
    {/if}
  </svg>
  <div class="legend">
    <span style="color:#2fbf71">— 清晰焦平面</span>
    <span style="color:#e8a13a">-- 景深近界</span>
    <span style="color:#e8543a">-- 景深远界</span>
    <span style="color:#b388ff">● H 铰链点</span>
    <span style="color:#ffd166">● S Scheimpflug 点</span>
    <span style="color:#e8a13a">▨ 景深楔形</span>
  </div>
</section>

<style>
  .panel {
    background: #1c2230;
    border: 1px solid #2c3547;
    border-radius: 8px;
    padding: 12px 14px;
    display: flex;
    flex-direction: column;
    height: 100%;
    box-sizing: border-box;
  }
  h2 {
    margin: 0 0 8px;
    font-size: 15px;
    color: #9ecbff;
  }
  svg {
    width: 100%;
    flex: 1;
    min-height: 260px;
    background: #12161f;
    border-radius: 6px;
  }
  .legend {
    display: flex;
    flex-wrap: wrap;
    gap: 12px;
    margin-top: 8px;
    font-size: 12px;
  }
</style>
