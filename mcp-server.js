import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// 获取插件根目录（mcp-server.js 所在目录）
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 动态导入项目模块（使用绝对路径确保可靠）
const { processImage } = await import(path.join(__dirname, 'src', 'process.js'));
const { loadFonts: loadFontsOriginal } = await import(path.join(__dirname, 'src', 'fonts.js'));

const SUPPORTED_EXTS = new Set(['.jpg', '.jpeg', '.png', '.tiff', '.tif']);

/**
 * 加载字体（支持自定义字体目录）
 * 由于 src/fonts.js 使用 path.resolve('fonts') 硬编码路径，
 * 这里通过临时切换 cwd 来复用它
 */
function loadFontsFromDir(fontsDir) {
  const originalCwd = process.cwd();
  try {
    // 切换到字体目录的父目录，使 path.resolve('fonts') 指向正确位置
    if (fontsDir) {
      const parentDir = path.dirname(fontsDir);
      const dirName = path.basename(fontsDir);
      // 如果用户传的就叫 fonts，直接切换到父目录
      if (dirName === 'fonts') {
        process.chdir(parentDir);
      } else {
        // 否则切到插件根目录
        process.chdir(__dirname);
      }
    } else {
      process.chdir(__dirname);
    }
    return loadFontsOriginal();
  } finally {
    process.chdir(originalCwd);
  }
}

// 创建 MCP Server
const server = new McpServer({
  name: 'xpan-film-maker',
  version: '1.0.0',
});

// 注册工具：处理 XPan 照片
server.tool(
  'process_xpan_image',
  '将照片转换为 16:9 电影画幅风格图片，支持中英双语字幕叠加。适用于哈苏 XPan 全景照片或任意宽幅照片。',
  {
    inputDir: z.string().describe('输入图片目录的绝对路径'),
    outputDir: z.string().describe('输出图片目录的绝对路径'),
    cn: z.string().optional().describe('中文字幕文案（应用于所有图片）'),
    en: z.string().optional().describe('英文字幕文案（应用于所有图片）'),
    fontsDir: z.string().optional().describe('自定义字体目录的绝对路径（内含 .ttf/.otf 文件）'),
  },
  async ({ inputDir, outputDir, cn, en, fontsDir }) => {
    try {
      // 验证输入目录
      if (!fs.existsSync(inputDir)) {
        return {
          content: [{ type: 'text', text: `错误：输入目录不存在: ${inputDir}` }],
          isError: true,
        };
      }

      // 扫描图片
      const allFiles = fs.readdirSync(inputDir);
      const imageFiles = allFiles.filter((f) => {
        const ext = path.extname(f).toLowerCase();
        return SUPPORTED_EXTS.has(ext) && !f.startsWith('.');
      });

      if (imageFiles.length === 0) {
        return {
          content: [{
            type: 'text',
            text: `输入目录中没有找到支持的图片文件。支持的格式: ${[...SUPPORTED_EXTS].join(', ')}`,
          }],
          isError: true,
        };
      }

      // 确保输出目录存在
      fs.mkdirSync(outputDir, { recursive: true });

      // 加载字体
      const fonts = loadFontsFromDir(fontsDir);

      // 构建字幕
      const subtitle = (cn || en) ? { cn: cn || '', en: en || '' } : null;

      // 处理图片
      let successCount = 0;
      let failCount = 0;
      const results = [];

      for (const filename of imageFiles) {
        const inputPath = path.join(inputDir, filename);
        const baseName = path.parse(filename).name;
        const outputPath = path.join(outputDir, `${baseName}.jpg`);

        try {
          await processImage(inputPath, outputPath, subtitle, fonts);
          successCount++;
          results.push(`✓ ${filename} → ${baseName}.jpg`);
        } catch (err) {
          failCount++;
          results.push(`✗ ${filename}: ${err.message}`);
        }
      }

      const summary = [
        `处理完成！`,
        `成功: ${successCount}  失败: ${failCount}`,
        `输出目录: ${outputDir}`,
        '',
        ...results,
      ].join('\n');

      return { content: [{ type: 'text', text: summary }] };
    } catch (err) {
      return {
        content: [{ type: 'text', text: `处理失败: ${err.message}` }],
        isError: true,
      };
    }
  },
);

// 启动 stdio 传输
const transport = new StdioServerTransport();
await server.connect(transport);
