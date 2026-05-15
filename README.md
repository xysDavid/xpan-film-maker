# XPan Film Maker

将哈苏 XPan 全景照片转换为电影画幅风格图片，自动补黑边至 16:9 并叠加中英双语字幕。

```
┌─────────────────────────────────────────────────┐
│                 （顶部黑色区域）                    │
├─────────────────────────────────────────────────┤
│                                                 │
│              原始 XPan 照片                       │
│                                                 │
├─────────────────────────────────────────────────┤
│                （底部黑色区域）                     │
│              这是中文字幕示例                      │
│          This is an English subtitle             │
│                                                 │
└─────────────────────────────────────────────────┘
```

## 功能特点

- **自动补黑边**：将任意宽高比照片补齐至 16:9，XPan 比例（约 2.7:1）照片上下补黑边
- **中英双语字幕**：电影风格的中英文字幕，中文大号白色在上、英文小号浅灰在下
- **字号自适应**：字体大小根据图片宽度自动缩放，适配不同分辨率
- **批量处理**：自动扫描 `input` 目录，支持并发处理（默认 3 张）
- **灵活配置**：支持 `config.json` 配置文件和命令行参数，可按文件名单独设置字幕
- **自定义字体**：支持在 `fonts` 目录放置 `.ttf` / `.otf` 字体文件

## 作为 Claude Code Plugin 安装

在 Claude Code 中执行以下命令即可安装：

```
/plugin marketplace add xysDavid/xpan-film-maker
/plugin install xpan-film-maker
```

安装后可用：
- **Skill**：`/xpan-film-maker:xpan-film "东京的黄昏" "Dusk in Tokyo"`
- **MCP 工具**：`process_xpan_image` — 其他 agent 可直接通过工具调用

## 手动安装（CLI 使用）

```bash
git clone git@github.com:xysDavid/xpan-film-maker.git
cd xpan-film-maker
npm install
```

### 准备字体（可选）

在 `fonts/` 目录放入中文字体文件（如 [Noto Sans SC](https://fonts.google.com/noto/specimen/Noto+Sans+SC)）。

如未提供自定义字体，程序会自动回退到系统字体。

### 使用

1. 将照片放入 `input/` 目录
2. 编辑 `config.json` 配置字幕
3. 运行：

```bash
npm start
```

输出图片会保存在 `output/` 目录。

### 命令行参数

```bash
# 通过命令行指定字幕（覆盖 config.json，应用于所有图片）
node src/index.js --cn "东京的黄昏" --en "Dusk in Tokyo"

# 跳过已存在的输出文件
node src/index.js --no-overwrite
```

## 配置文件

编辑 `config.json`：

```json
{
  "defaultSubtitle": {
    "cn": "默认中文字幕",
    "en": "Default English Subtitle"
  },
  "images": {
    "DSC00123": {
      "cn": "东京的黄昏",
      "en": "Dusk in Tokyo"
    },
    "DSC00456": {
      "cn": "京都的雨季",
      "en": "Rainy Season in Kyoto"
    }
  }
}
```

- **defaultSubtitle**：全局默认字幕，应用于没有单独配置的图片
- **images**：按输入文件名（不含扩展名）单独配置字幕

字幕优先级：命令行参数 > 单图配置 > 全局默认。如果都没有配置，则只生成补黑边的画幅，不添加文字。

## 支持的图片格式

`.jpg` `.jpeg` `.png` `.tiff` `.tif`

## 目录结构

```
xpan-film-maker/
├── .claude-plugin/
│   └── plugin.json # Claude Code Plugin 清单
├── skills/
│   └── xpan-film/
│       └── SKILL.md  # Skill 定义
├── .mcp.json       # MCP Server 配置
├── mcp-server.js   # MCP Server 入口
├── input/          # 放置源照片
├── output/         # 生成的电影画幅图片
├── fonts/          # 自定义字体文件
├── config.json     # 字幕配置
└── src/
    ├── index.js    # CLI 入口与批量调度
    ├── config.js   # 配置加载
    ├── fonts.js    # 字体加载
    └── process.js  # 核心图片处理
```

## 技术栈

- **Node.js** >= 18
- **[sharp](https://sharp.pixelplumbing.com/)** — 高性能图片处理
- **SVG text overlay** — 轻量文字渲染，无需 Cairo 等原生依赖
- **[@modelcontextprotocol/sdk](https://github.com/modelcontextprotocol/typescript-sdk)** — MCP Server 支持

## License

ISC
