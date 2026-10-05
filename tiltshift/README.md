# 移轴镜头焦平面实验室（Tilt–Shift Scheimpflug Lab）

摄影课程教学工具：直观展示移轴镜头倾斜后**合焦面**与**景深楔**如何改变。
Svelte 5 + TypeScript 界面，Three.js 三维场景，mathjs 求值的**明确薄透镜近轴模型**，
IndexedDB 本地保存场景，纯前端、无后端。

## 运行

```bash
npm install
npm run dev        # 开发
npm test           # 光学模型核验测试（Vitest）
npm run check      # 类型检查
npm run build      # 生产构建
```

`e2e-smoke.ts` / `e2e-shots.ts` 是可选的 Playwright 浏览器冒烟/截图脚本（已在 devDependencies）。

## 模型（明确假设，可核验）

二维剖面坐标：透镜中心 O=(0,0)，x 轴指向被摄体，传感器为 x=−v 的竖直面；
镜头绕 z 轴（倾斜轴）前倾 θ（正 = 上端朝被摄体、光轴下压）。

- 透镜切向 **t=(sinθ, cosθ)**，被摄体侧法向 **n=(cosθ, −sinθ)**
- 物点 Q=(x,y) 局部坐标：q=cosθ·x−sinθ·y（轴向），h=sinθ·x+cosθ·y（切向）
- 近轴折射（mathjs 编译表达式）：`m1 = (a−h)/q − a/f`，`m2 = b/q − b/f`
- 像距：**v = f·s / (s·cosθ − f)**（θ=0 回归 v=fs/(s−f)）
- **精确合焦面**：`x/s − (sinθ/f)·y = 1`
  - Scheimpflug 交线点：**S=(−v, −v·cosθ/sinθ)**（传感器 ∩ 透镜 ∩ 合焦面）
  - 铰链点（前焦面 q=f ∩ 合焦面）：**J=(0, −f/sinθ)**，垂直距离 J=f/sinθ
- θ=0 分支：合焦面 x=s 与传感器平行，景深用解析超焦距公式

### 景深与弥散圆（关键约定）

- 景深**只按用户给定的弥散圆标准 c** 绘制，界面材质清晰度不代表景深。
- 孔径圆到像面的近轴映射是轴对齐椭圆：
  - 沿倾斜轴分量 d_z = 2ρ·|1+λ0·(1/q−1/f)|，ρ=f/(2N)
  - 面内分量 d_y（含倾斜投影项），max(d_z,d_y) 为长轴包络
- 数值核验表明 **d_z = c 的等值面严格为过铰链线 J 的平面**（残差 < 0.5 mm），
  这就是经典 Scheimpflug 景深楔；景深平面据此绘制并做逐点直线核验，
  核验失败时改画数值折线并**拒绝给出平面交线结论**。
- d_y 因倾斜投影仅近似共面，只作参考。

### 何时停止给出精确结果

| 条件 | 处理 |
|---|---|
| \|θ\| > 8.5° | 超出机械/模型范围，停止 |
| F < 1.0 | 近轴近似失效，停止 |
| s < 50 mm | 过近，停止 |
| s·cosθ ≤ f（不成实像，v≤0） | 停止 |
| s > 100 m | 远侧按无穷远处理（警告） |
| F < 1.4 / c > 0.1 mm / f 超出 17–135 mm | 警告但仍计算 |

## 核验（见 `src/lib/optics/model.test.ts`）

- **零倾角回归**：1/f=1/s+1/v、超焦距、近/远解析景深、对超焦距对焦远景深 ∞
- 数值弥散根与解析景深一致（同口径互验，相对误差 < 0.2%）
- **已知平面**：合焦面多点弥散为零；S 点三线共点；J 在 q=f 与合焦面上，J=f/sinθ
- 景深等值线逐点核验为过 J 的直线；θ→0.02° 与平行分支连续
- mm/cm/m 单位往返一致
- 2D 与 3D 由同一个 `computeScene()` 结果驱动，天然同步

## 导出

JSON / 文本报告均包含完整输入、S/J 交线、近远轴上距离与 7 条**简化假设**
（薄透镜近轴、像面不摆、ρ=f/(2N) 圆孔、d_z 判据、适用范围等）。

## 目录

```
src/lib/optics/      模型（model.ts）、几何、类型、测试
src/lib/storage/     IndexedDB 封装
src/lib/components/  Controls / InfoPanel / Section2D(SVG) / Scene3D(Three.js) / SceneStore
src/lib/exportReport.ts
```
