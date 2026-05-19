import fs from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';

const SUPPORTED_EXTS = new Set(['.jpg', '.jpeg', '.png', '.tiff', '.tif']);

/**
 * 将横向图片裁切为多张 3:4 竖向图片
 *
 * @param {string} inputPath - 输入图片的绝对路径
 * @param {string} outputDir - 输出目录的绝对路径
 * @returns {Promise<{count: number, cropWidth: number, height: number, excess: number, files: string[]}>}
 */
export async function cropImage3x4(inputPath, outputDir) {
  // 验证输入文件存在
  if (!fs.existsSync(inputPath)) {
    throw new Error(`输入文件不存在: ${inputPath}`);
  }

  // 验证文件格式
  const ext = path.extname(inputPath).toLowerCase();
  if (!SUPPORTED_EXTS.has(ext)) {
    throw new Error(`不支持的文件格式: ${ext}。支持的格式: ${[...SUPPORTED_EXTS].join(', ')}`);
  }

  // 读取图片元数据
  const metadata = await sharp(inputPath).metadata();
  const { width, height } = metadata;

  if (!width || !height) {
    throw new Error(`无法读取图片尺寸: ${inputPath}`);
  }

  // 验证是横向图片
  if (width <= height) {
    throw new Error(`图片不是横向的 (宽=${width}, 高=${height})，无法处理`);
  }

  // 计算裁切参数
  const cropWidth = Math.floor(height * 3 / 4);
  const count = Math.floor(width / cropWidth);

  if (count === 0) {
    throw new Error(`图片宽度不足以裁出一张 3:4 的图片 (宽=${width}, 需要至少 ${cropWidth})`);
  }

  const totalUsedWidth = count * cropWidth;
  const excess = width - totalUsedWidth;
  const offsetX = Math.floor(excess / 2);

  // 确保输出目录存在
  fs.mkdirSync(outputDir, { recursive: true });

  // 循环裁切
  const baseName = path.parse(inputPath).name;
  const files = [];

  for (let i = 0; i < count; i++) {
    const left = offsetX + i * cropWidth;
    const outputFileName = `${baseName}_${String(i + 1).padStart(2, '0')}.jpg`;
    const outputPath = path.join(outputDir, outputFileName);

    await sharp(inputPath)
      .extract({ left, top: 0, width: cropWidth, height })
      .jpeg({ quality: 90 })
      .toFile(outputPath);

    files.push(outputFileName);
  }

  return { count, cropWidth, height, excess, files, outputDir };
}

/**
 * CLI 入口
 */
async function main() {
  const args = process.argv.slice(2);

  if (args.length === 0) {
    console.error('用法: node src/crop-3x4.js <输入图片路径> [输出目录]');
    console.error('示例: node src/crop-3x4.js ./input/photo.jpg ./output');
    process.exit(1);
  }

  const inputPath = path.resolve(args[0]);
  const outputDir = path.resolve(args[1] || './output');

  try {
    const result = await cropImage3x4(inputPath, outputDir);

    console.log(`图片尺寸: ${result.cropWidth * result.count + result.excess} × ${result.height}`);
    console.log(`每张裁切图尺寸: ${result.cropWidth} × ${result.height} (3:4)`);
    console.log(`将裁切为 ${result.count} 张图片`);
    console.log(`左右各丢弃约 ${Math.floor(result.excess / 2)} 像素`);
    console.log('');

    result.files.forEach((file, i) => {
      console.log(`[${i + 1}/${result.count}] 已保存: ${file}`);
    });

    console.log(`\n完成！共生成 ${result.count} 张图片，输出目录: ${outputDir}`);
  } catch (err) {
    console.error(`[错误] ${err.message}`);
    process.exit(1);
  }
}

// 仅当直接运行时执行 CLI
const isMainModule = process.argv[1] && path.resolve(process.argv[1]) === path.resolve(new URL(import.meta.url).pathname);
if (isMainModule) {
  main();
}
