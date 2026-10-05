<script lang="ts">
  import type { LengthUnit, Line2, SceneInput, SceneResult, Vec2 } from '../optics/types';
  import { fromMm } from '../optics/geometry';
  import { LIMITS } from '../optics/model';

  interface Props {
    input: SceneInput;
    result: SceneResult;
    unit: LengthUnit;
    /** 'overview' 显示物方全尺度，'detail' 放大透镜/传感器侧 */
    mode: 'overview' | 'detail';
  }
  let { input, result, unit, mode }: Props = $props();

  const W = 560;
  const H = 420;
  const PAD = 46;

  // 世界坐标可视范围（mm）
  const view = $derived.by((): { x0: number; x1: number; y0: number; y1: number } => {
    if (!result.applicable) {
      const v = Number.isFinite(result.v_mm) ? result.v_mm : input.focalLength_mm;
      const span = Math.max(v * 4, input.focalLength_mm * 6, 80);
      return { x0: -span * 0.32, x1: span * 0.68, y0: -span * 0.5, y1: span * 0.5 };
    }
    if (mode === 'detail') {
      const v = result.v_mm;
      // 细节视图：让 O 与 Scheimpflug 点 S 同框，并留边距
      const sY = result.scheimpflugPoint ? result.scheimpflugPoint.y : -v * 4;
      const x0 = -v * 2.6;
      const x1 = Math.abs(sY) * 0.32;
      const y0 = sY * 1.12;
      const y1 = Math.abs(sY) * 0.18;
      return { x0, x1, y0, y1 };
    }
    const s = input.focusDistance_mm;
    let far = result.farLimit.axisDistance_mm ?? s * 1.4;
    if (!Number.isFinite(far)) far = Math.min(s * 1.6, LIMITS.farInfinity_mm);
    const near = result.nearLimit.axisDistance_mm ?? s * 0.7;
    const x0 = -result.v_mm * 6;
    let x1 = Math.max(far, s) * 1.05;
    let yLow: number;
    let yHigh: number;
    if (result.hingePoint) {
      yLow = result.hingePoint.y * 1.08;
      yHigh = Math.abs(yLow) * 0.55;
    } else {
      // 平行分支：竖直面无限延伸，取与近/远间距相称的高度
      const h = Math.max(Math.abs(far - near) * 0.9, s * 0.08);
      yLow = -h;
      yHigh = h;
    }
    for (const lim of [result.nearLimit, result.farLimit]) {
      if (lim.line && Math.abs(lim.line.dir.y) > 1e-9) {
        const xAtLow = lim.line.point.x + ((yLow - lim.line.point.y) / lim.line.dir.y) * lim.line.dir.x;
        if (Number.isFinite(xAtLow)) {
          x1 = Math.max(x1, xAtLow * 1.05);
        }
      }
    }
    return { x0, x1, y0: yLow, y1: yHigh };
  });

  const tr = $derived.by(() => {
    const v = view;
    const vw = v.x1 - v.x0;
    const vh = v.y1 - v.y0;
    const k = Math.min((W - 2 * PAD) / vw, (H - 2 * PAD) / vh);
    const ox = PAD + (W - 2 * PAD - vw * k) / 2;
    const oy = PAD + (H - 2 * PAD - vh * k) / 2;
    return {
      k,
      sx: (x: number) => ox + (x - v.x0) * k,
      sy: (y: number) => H - (oy + (y - v.y0) * k),
    };
  });

  interface GridLine {
    x1: number;
    y1: number;
    x2: number;
    y2: number;
    major: boolean;
  }

  function niceStep(raw: number): number {
    const p = Math.pow(10, Math.floor(Math.log10(raw)));
    const n = raw / p;
    return (n < 1.5 ? 1 : n < 3.5 ? 2 : n < 7.5 ? 5 : 10) * p;
  }

  const grid = $derived.by<GridLine[]>(() => {
    const v = view;
    const gx = niceStep((v.x1 - v.x0) / 7);
    const gy = niceStep((v.y1 - v.y0) / 6);
    const lines: GridLine[] = [];
    for (let x = Math.ceil(v.x0 / gx) * gx; x <= v.x1; x += gx) {
      lines.push({ x1: x, y1: v.y0, x2: x, y2: v.y1, major: Math.abs(x) < 1e-9 });
    }
    for (let y = Math.ceil(v.y0 / gy) * gy; y <= v.y1; y += gy) {
      lines.push({ x1: v.x0, y1: y, x2: v.x1, y2: y, major: Math.abs(y) < 1e-9 });
    }
    return lines;
  });

  function lineSeg(line: Line2, yA: number, yB: number): string {
    const tA = (yA - line.point.y) / line.dir.y;
    const tB = (yB - line.point.y) / line.dir.y;
    const pA = { x: line.point.x + tA * line.dir.x, y: yA };
    const pB = { x: line.point.x + tB * line.dir.x, y: yB };
    return `M ${tr.sx(pA.x).toFixed(2)} ${tr.sy(pA.y).toFixed(2)} L ${tr.sx(pB.x).toFixed(2)} ${tr.sy(pB.y).toFixed(2)}`;
  }

  function polylinePath(points: Vec2[]): string {
    return points
      .map((p, i) => `${i === 0 ? 'M' : 'L'} ${tr.sx(p.x).toFixed(2)} ${tr.sy(p.y).toFixed(2)}`)
      .join(' ');
  }

  const fmtU = (mm: number | null | undefined, digits = 1): string => {
    if (mm === null || mm === undefined) return '—';
    if (!Number.isFinite(mm)) return '∞';
    return fromMm(mm, unit).toFixed(digits);
  };

  const colors = $state({
    sensor: '#2563eb',
    lens: '#111827',
    focal: '#059669',
    near: '#d97706',
    far: '#7c3aed',
    hinge: '#dc2626',
  });
</script>

<svg viewBox="0 0 {W} {H}" class="section" role="img" aria-label="移轴镜头二维光路剖面（x 指向被摄体，y 竖直）">
  <rect x="0.5" y="0.5" width="{W - 1}" height="{H - 1}" rx="10" class="frame" />

  {#each grid as g}
    <line x1="{tr.sx(g.x1)}" y1="{tr.sy(g.y1)}" x2="{tr.sx(g.x2)}" y2="{tr.sy(g.y2)}"
          class={g.major ? 'grid major' : 'grid'} />
  {/each}

  {#if result.applicable}
    <!-- 原光轴 -->
    <line x1="{tr.sx(view.x0)}" y1="{tr.sy(0)}" x2="{tr.sx(view.x1)}" y2="{tr.sy(0)}"
          class="optical-axis" />

    <circle cx="{tr.sx(0)}" cy="{tr.sy(0)}" r="3" fill="{colors.lens}" />

    <path d="{lineSeg(result.sensorLine, view.y0, view.y1)}" stroke="{colors.sensor}" stroke-width="3" fill="none" />
    <path d="{lineSeg(result.lensLine, view.y0, view.y1)}" stroke="{colors.lens}" stroke-width="3" fill="none" />

    {#if result.focalPlaneLine}
      <path d="{lineSeg(result.focalPlaneLine, view.y0, view.y1)}" stroke="{colors.focal}" stroke-width="2.5" fill="none" />
    {/if}

    {#if result.nearLimit.line}
      <path d="{lineSeg(result.nearLimit.line, view.y0, view.y1)}" stroke="{colors.near}" stroke-width="1.8"
            stroke-dasharray="8 4" fill="none" />
    {:else if result.nearLimit.contour}
      <path d="{polylinePath(result.nearLimit.contour)}" stroke="{colors.near}" stroke-width="1.8"
            stroke-dasharray="3 3" fill="none" />
    {/if}
    {#if result.farLimit.line}
      <path d="{lineSeg(result.farLimit.line, view.y0, view.y1)}" stroke="{colors.far}" stroke-width="1.8"
            stroke-dasharray="8 4" fill="none" />
    {:else if result.farLimit.contour}
      <path d="{polylinePath(result.farLimit.contour)}" stroke="{colors.far}" stroke-width="1.8"
            stroke-dasharray="3 3" fill="none" />
    {/if}

    {#if result.hingePoint}
      <g>
        <circle cx="{tr.sx(result.hingePoint.x)}" cy="{tr.sy(result.hingePoint.y)}" r="4.5"
                fill="white" stroke="{colors.hinge}" stroke-width="2" />
        <text x="{tr.sx(result.hingePoint.x) + 7}" y="{tr.sy(result.hingePoint.y) + 4}"
              class="lbl" fill="{colors.hinge}">J 铰链线</text>
      </g>
    {/if}
    {#if result.scheimpflugPoint && mode === 'detail' &&
         tr.sx(result.scheimpflugPoint.x) > 0 && tr.sx(result.scheimpflugPoint.x) < W}
      <g>
        <circle cx="{tr.sx(result.scheimpflugPoint.x)}" cy="{tr.sy(result.scheimpflugPoint.y)}" r="4.5"
                fill="white" stroke="#0891b2" stroke-width="2" />
        <text x="{tr.sx(result.scheimpflugPoint.x) - 8}" y="{tr.sy(result.scheimpflugPoint.y) - 8}"
              text-anchor="end" class="lbl" fill="#0891b2">S Scheimpflug</text>
      </g>
    {/if}

    <circle cx="{tr.sx(input.focusDistance_mm)}" cy="{tr.sy(0)}" r="4" fill="{colors.focal}" />
  {/if}

  <text x="10" y="{H - 8}" class="axis-label">x 被摄体方向 ({unit})</text>
  <text x="10" y="16" class="axis-label">y</text>
</svg>

<div class="readout">
  <span><i style="background:{colors.sensor}"></i>传感器</span>
  <span><i style="background:{colors.lens}"></i>透镜</span>
  <span><i style="background:{colors.focal}"></i>合焦面</span>
  <span><i style="background:{colors.near}"></i>近极限</span>
  <span><i style="background:{colors.far}"></i>远极限</span>
  {#if result.applicable}
    <span class="nums">
      v={fmtU(result.v_mm, 3)} {unit} · 近={fmtU(result.nearLimit.axisDistance_mm)} ·
      远={fmtU(result.farLimit.axisDistance_mm)} {unit}
    </span>
  {/if}
</div>

<style>
  .section {
    width: 100%;
    height: auto;
    display: block;
    background: #fafaf9;
  }
  .frame {
    fill: none;
    stroke: #e7e5e4;
  }
  .grid {
    stroke: #eeeeec;
    stroke-width: 1;
  }
  .grid.major {
    stroke: #d6d3d1;
  }
  .optical-axis {
    stroke: #a8a29e;
    stroke-width: 1;
    stroke-dasharray: 6 4;
  }
  .lbl {
    font-size: 11px;
    font-family: ui-monospace, monospace;
  }
  .axis-label {
    font-size: 11px;
    fill: #78716c;
    font-family: ui-monospace, monospace;
  }
  .readout {
    display: flex;
    flex-wrap: wrap;
    gap: 10px;
    align-items: center;
    font-size: 12px;
    color: #44403c;
    padding: 6px 4px;
  }
  .readout i {
    display: inline-block;
    width: 12px;
    height: 3px;
    margin-right: 4px;
    border-radius: 2px;
  }
  .nums {
    margin-left: auto;
    font-family: ui-monospace, monospace;
  }
</style>
