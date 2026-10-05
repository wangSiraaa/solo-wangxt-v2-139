/** 光学模型共用类型。内部统一使用毫米、度。 */

export type LengthUnit = 'mm' | 'cm' | 'm';

/** 用户输入参数（全部以毫米 / 度保存） */
export interface SceneInput {
  /** 焦距 f (mm) */
  focalLength_mm: number;
  /** 光圈 F 数 N（如 2.8） */
  fNumber: number;
  /** 镜头倾角 θ（度）。正号：镜头上端朝被摄体方向前倾 */
  tilt_deg: number;
  /** 对焦距离 s (mm)：沿原光轴从透镜主平面到对焦面与光轴交点的距离 */
  focusDistance_mm: number;
  /** 用户给定的可接受弥散圆直径 c (mm)，作为景深的唯一判定标准 */
  coc_mm: number;
}

export interface Vec2 {
  x: number;
  y: number;
}

/** 二维有向直线：P + t·dir */
export interface Line2 {
  point: Vec2;
  dir: Vec2;
}

/** 三维平面：过 point，法向 normal（不必归一化） */
export interface Plane3 {
  point: [number, number, number];
  normal: [number, number, number];
}

export type Branch = 'parallel' | 'scheimpflug';

export interface DofLimit {
  /** 该极限面与原光轴 (y=0) 的交点距离；Infinity 表示无穷远，null 表示无法判定 */
  axisDistance_mm: number | null;
  /** 二维剖面中的极限线（若通过铰链直线核验） */
  line: Line2 | null;
  /** 三维极限平面 */
  plane: Plane3 | null;
  /** 数值等值线（当直线核验失败时使用，折线采样点） */
  contour: Vec2[] | null;
}

export interface SceneResult {
  branch: Branch;
  /** 输入是否落在模型适用范围内；false 时不给出精确数值结果 */
  applicable: boolean;
  errors: string[];
  warnings: string[];

  // 基本量
  v_mm: number; // 像距（透镜到传感器，沿原光轴）
  apertureRadius_mm: number; // ρ = f/(2N)
  axisFocusPoint: Vec2; // 对焦面与光轴交点 (s, 0)

  // 二维几何
  sensorLine: Line2; // 像平面 x = -v
  lensLine: Line2; // （倾斜的）透镜平面
  focalPlaneLine: Line2 | null; // 精确合焦的物方平面
  /** Scheimpflug 交线在剖面上的点 */
  scheimpflugPoint: Vec2 | null;
  /** 铰链（hinge）线在剖面上的点 J */
  hingePoint: Vec2 | null;

  // 景深极限
  nearLimit: DofLimit;
  farLimit: DofLimit;

  // 三维（沿倾斜轴 z 拉伸）
  sensorPlane: Plane3;
  lensPlane: Plane3;
  focalPlane: Plane3 | null;
  /** 合焦面与竖直面的夹角（度） */
  focalPlaneTilt_deg: number | null;
}

/** 平行分支的解析中间量，供测试与 UI 使用 */
export interface ParallelDetail {
  hyperfocal_mm: number;
  near_mm: number;
  far_mm: number; // Infinity 表示无穷远
}
