---
name: xpan-film
description: 将照片转换为 16:9 电影画幅风格图片，支持中英双语字幕
---

# XPan Film Maker - 电影画幅照片生成

将照片转换为 16:9 电影画幅风格图片，并添加中英双语字幕。

## 你的任务

根据用户的指令处理照片。用户输入如下：

$ARGUMENTS

## 执行步骤

### 1. 检查环境

确认插件目录下 `node_modules` 存在，如果不存在则在插件根目录运行 `npm install` 安装依赖。

### 2. 解析用户意图

用户的输入可能是以下几种形式，请灵活识别：

- **指定字幕**：如 `"东京的黄昏" "Dusk in Tokyo"` 或 `cn=东京的黄昏 en=Dusk in Tokyo`
  → 将中文和英文字幕提取出来
- **批量配置**：如 `配置所有图片的字幕` 或用户提供了一个文件名到字幕的映射
  → 更新 config.json 中的 images 字段
- **仅处理**：如 `处理所有图片` 或 `运行`
  → 直接使用现有 config.json 配置运行
- **无文字模式**：如 `只加黑边不要字幕`
  → 清空 config.json 中的字幕配置后运行

### 3. 使用 MCP 工具或 CLI

**方式 A - 使用 MCP 工具 `process_xpan_image`（推荐）：**

如果 xpan-film MCP 工具可用，直接调用：

```
process_xpan_image({
  inputDir: "/用户的输入目录绝对路径",
  outputDir: "/用户的输出目录绝对路径",
  cn: "中文字幕",
  en: "English subtitle"
})
```

**方式 B - 使用 CLI 命令：**

在插件根目录下运行：

```bash
# 使用命令行参数
node src/index.js --cn "中文字幕" --en "English subtitle"

# 使用 config.json 配置
node src/index.js

# 不覆盖已有输出
node src/index.js --no-overwrite
```

config.json 格式：

```json
{
  "defaultSubtitle": {
    "cn": "中文字幕",
    "en": "English Subtitle"
  },
  "images": {
    "文件名不含扩展名": {
      "cn": "单独中文字幕",
      "en": "Individual English Subtitle"
    }
  }
}
```

### 4. 报告结果

处理完成后，告诉用户：
- 成功处理了多少张图片
- 输出文件保存在哪个目录
- 如果有失败的图片，说明失败原因

## 注意事项

- 支持的输入格式：`.jpg` `.jpeg` `.png` `.tiff` `.tif`
- 输出格式：JPEG 质量 90
- 如果输入目录为空，提醒用户先放入照片
- 如果 `fonts/` 目录有自定义字体会自动使用，否则回退到系统字体
