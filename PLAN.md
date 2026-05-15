# 实现计划：XPan 电影画幅照片生成器

## 背景

这是一个全新项目。目标是构建一个 Node.js CLI 工具，将哈苏 XPan 全景照片转换为 16:9 电影画幅风格图片，并在底部黑色区域叠加中英双语字幕。

- **渲染方案**：sharp + SVG text overlay（轻量，无需 Cairo 等原生依赖）
- **字体方案**：项目内置字体（./fonts 目录），代码中通过 SVG `@font-face` 引用 base64 编码的字体文件

---

## 实现步骤

### 步骤 1：项目初始化

**创建文件：** `package.json`

```bash
npm init -y
npm install sharp
npm install minimist   # 轻量命令行参数解析
```

- 创建目录结构：`src/`、`input/`、`output/`、`fonts/`
- 在 `package.json` 中设置 `"type": "module"` 使用 ESM
- 添加 `scripts.start`: `"node src/index.js"`

---

### 步骤 2：配置加载器

**创建文件：** `src/config.js`

职责：
1. 读取 `config.json`（如不存在则使用空配置）
2. 解析命令行参数 `--cn` / `--en` / `--no-overwrite`
3. 合并优先级：命令行参数 > 单张图片配置 > 全局默认配置
4. 导出 `loadConfig()` 函数，返回完整配置对象

```js
// 返回结构示例
{
  defaultSubtitle: { cn: "...", en: "..." },
  images: { "DSC00123": { cn: "...", en: "..." } },
  noOverwrite: false,
  cliSubtitle: { cn: "...", en: "..." } | null
}
```

同时创建示例文件 `config.json`。

---

### 步骤 3：字体加载工具

**创建文件：** `src/fonts.js`

职责：
1. 扫描 `./fonts` 目录中的 `.ttf` / `.otf` 文件
2. 将字体文件读取并转为 base64 编码
3. 生成 SVG `@font-face` 声明字符串，供后续 SVG 文字渲染使用
4. 按文件名识别中文字体和英文字体（或通过配置指定）

字体查找策略：
- 优先使用 `./fonts` 目录下的字体
- 如果 `./fonts` 为空，回退到系统字体路径（macOS: `/System/Library/Fonts`，列出常见中文字体如 PingFang SC）
- 导出 `loadFonts()` 返回 `{ cnFontFace, enFontFace, cnFontFamily, enFontFamily }`

---

### 步骤 4：核心图片处理逻辑

**创建文件：** `src/process.js`

这是项目的核心模块，包含一个主函数 `processImage(inputPath, outputPath, subtitle, fonts)`：

#### 4a. 读取原图元数据

```js
const metadata = await sharp(inputPath).metadata();
const { width: origW, height: origH } = metadata;
```

#### 4b. 计算画布尺寸与定位

```js
const targetRatio = 16 / 9;
const origRatio = origW / origH;

let canvasW, canvasH, offsetX, offsetY;

if (origRatio > targetRatio) {
  // 原图更宽（XPan 典型情况）→ 上下补黑边
  canvasW = origW;
  canvasH = Math.round(origW / targetRatio);
  offsetX = 0;
  offsetY = Math.round((canvasH - origH) * 0.45); // 偏上放置
} else {
  // 原图更窄 → 左右补黑边
  canvasH = origH;
  canvasW = Math.round(origH * targetRatio);
  offsetX = Math.round((canvasW - origW) / 2);
  offsetY = 0;
}
```

#### 4c. 创建黑色画布 + 合成原图

```js
const canvas = sharp({
  create: {
    width: canvasW,
    height: canvasH,
    channels: 3,
    background: { r: 0, g: 0, b: 0 }
  }
}).jpeg();

// 将原图合成到画布上
const result = canvas.composite([
  { input: inputPath, left: offsetX, top: offsetY }
]);
```

#### 4d. 生成字幕 SVG 叠加层

如果有字幕文案，生成一个与画布同尺寸的 SVG：

```js
function createSubtitleSvg(canvasW, canvasH, origH, offsetY, subtitle, fonts) {
  const bottomBarTop = offsetY + origH;          // 底部黑色区域起始 Y
  const bottomBarHeight = canvasH - bottomBarTop; // 底部黑色区域高度

  const cnFontSize = Math.round(canvasW / 55);
  const enFontSize = Math.round(canvasW / 70);
  const lineGap = Math.round(cnFontSize * 0.4);

  // 字幕块总高度
  const blockHeight = cnFontSize + lineGap + enFontSize;
  // 垂直居中于底部黑色区域
  const blockTopY = bottomBarTop + (bottomBarHeight - blockHeight) / 2;

  const cnY = blockTopY + cnFontSize;               // 中文基线
  const enY = cnY + lineGap + enFontSize;            // 英文基线

  return `<svg width="${canvasW}" height="${canvasH}" xmlns="...">
    <style>
      ${fonts.cnFontFace}
      ${fonts.enFontFace}
    </style>
    <text x="50%" y="${cnY}" text-anchor="middle"
          font-family="${fonts.cnFontFamily}" font-size="${cnFontSize}"
          fill="white">${escapeXml(subtitle.cn)}</text>
    <text x="50%" y="${enY}" text-anchor="middle"
          font-family="${fonts.enFontFamily}" font-size="${enFontSize}"
          fill="#CCCCCC">${escapeXml(subtitle.en)}</text>
  </svg>`;
}
```

将 SVG 作为 Buffer 合成到画布：

```js
const svgBuffer = Buffer.from(subtitleSvg);
result.composite([
  { input: inputPath, left: offsetX, top: offsetY },
  { input: svgBuffer, left: 0, top: 0 }
]);
```

#### 4e. 输出

```js
await result.jpeg({ quality: 90 }).toFile(outputPath);
```

---

### 步骤 5：入口文件与批量处理

**创建文件：** `src/index.js`

职责：
1. 调用 `loadConfig()` 获取配置
2. 调用 `loadFonts()` 加载字体
3. 扫描 `./input` 目录，过滤出支持的图片格式
4. 确保 `./output` 目录存在（`fs.mkdirSync({ recursive: true })`）
5. 遍历图片列表，受控并发处理（使用 Promise 池，并发数 3）
6. 对每张图片：
   - 确定字幕文案（命令行 > 单图配置 > 全局默认 > 无字幕）
   - 检查 `--no-overwrite` 是否跳过
   - 调用 `processImage()`
   - 打印进度 `[2/10] 正在处理 DSC00123.jpg...`
7. 处理完成后打印汇总信息

并发控制实现（不引入额外依赖）：

```js
async function processWithConcurrency(items, concurrency, handler) {
  const results = [];
  let index = 0;
  async function next() {
    const i = index++;
    if (i >= items.length) return;
    results[i] = await handler(items[i], i);
    await next();
  }
  await Promise.all(Array.from({ length: concurrency }, () => next()));
  return results;
}
```

---

### 步骤 6：创建示例配置与 .gitignore

**创建文件：**
- `config.json` — 带有示例字幕的配置模板
- `.gitignore` — 忽略 `node_modules/`、`output/`、`input/`（保留目录结构用 `.gitkeep`）
- `input/.gitkeep`、`output/.gitkeep`、`fonts/.gitkeep` — 保留空目录

---

## 文件清单

| 文件 | 说明 |
|------|------|
| `package.json` | 项目配置，依赖 sharp + minimist |
| `config.json` | 字幕配置模板 |
| `.gitignore` | 忽略规则 |
| `src/index.js` | 入口：参数解析、批量调度、进度输出 |
| `src/config.js` | 配置加载器：合并 config.json + CLI 参数 |
| `src/fonts.js` | 字体加载：读取 ./fonts 并生成 SVG @font-face |
| `src/process.js` | 核心处理：画布创建、图片合成、SVG 字幕叠加 |
| `input/.gitkeep` | 保留空目录 |
| `output/.gitkeep` | 保留空目录 |
| `fonts/.gitkeep` | 保留空目录 |

---

## 验证方法

1. **安装依赖**：`npm install` 确认无报错
2. **准备测试素材**：在 `./input` 放入一张 XPan 比例照片（或任意宽幅照片）
3. **准备字体**：在 `./fonts` 放入一个支持中文的 TTF 字体文件（如 Noto Sans SC Regular）
4. **编辑 config.json**：填入测试字幕
5. **运行**：`node src/index.js`
6. **检查输出**：
   - `./output` 中生成了 JPG 文件
   - 打开图片确认：16:9 比例、黑色边框、原图居上偏移、底部有中英文字幕
   - 文件大小合理（质量 90 的 JPEG）
7. **测试命令行覆盖**：`node src/index.js --cn "测试" --en "Test"`
8. **测试无字幕模式**：清空 config.json 中的字幕配置，确认只输出补黑边的画幅
9. **测试 --no-overwrite**：重复运行确认跳过已存在文件
