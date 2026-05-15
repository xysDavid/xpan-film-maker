import fs from 'node:fs';
import path from 'node:path';
import { loadConfig, getSubtitleForImage } from './config.js';
import { loadFonts } from './fonts.js';
import { processImage } from './process.js';

const SUPPORTED_EXTS = new Set(['.jpg', '.jpeg', '.png', '.tiff', '.tif']);
const CONCURRENCY = 3;

/**
 * 受控并发处理
 */
async function processWithConcurrency(items, concurrency, handler) {
  const results = [];
  let index = 0;

  async function next() {
    while (index < items.length) {
      const i = index++;
      results[i] = await handler(items[i], i);
    }
  }

  await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, () => next()));
  return results;
}

/**
 * 单文件处理模式
 */
async function runSingleFile(config, fonts) {
  const inputFile = path.resolve(config.inputFile);

  // 验证输入文件
  if (!fs.existsSync(inputFile)) {
    console.error(`[错误] 输入文件不存在: ${inputFile}`);
    process.exit(1);
  }

  const ext = path.extname(inputFile).toLowerCase();
  if (!SUPPORTED_EXTS.has(ext)) {
    console.error(`[错误] 不支持的文件格式: ${ext}`);
    console.error(`支持的格式: ${[...SUPPORTED_EXTS].join(', ')}`);
    process.exit(1);
  }

  // 确定输出路径
  const baseName = path.parse(inputFile).name;
  let outputFile;
  if (config.outputFile) {
    outputFile = path.resolve(config.outputFile);
    // 如果输出路径没有扩展名，当作目录处理，自动补文件名
    if (!path.extname(outputFile)) {
      fs.mkdirSync(outputFile, { recursive: true });
      outputFile = path.join(outputFile, `${baseName}.jpg`);
    } else {
      // 确保输出文件的父目录存在
      fs.mkdirSync(path.dirname(outputFile), { recursive: true });
    }
  } else {
    // 未指定输出路径，默认输出到 output 目录
    const outputDir = path.resolve('output');
    fs.mkdirSync(outputDir, { recursive: true });
    outputFile = path.join(outputDir, `${baseName}.jpg`);
  }

  // 检查覆盖保护
  if (config.noOverwrite && fs.existsSync(outputFile)) {
    console.log(`跳过（输出文件已存在）: ${outputFile}`);
    return;
  }

  // 获取字幕
  const subtitle = getSubtitleForImage(config, baseName);

  console.log(`正在处理 ${path.basename(inputFile)}...`);

  try {
    await processImage(inputFile, outputFile, subtitle, fonts);
    console.log(`完成 → ${outputFile}`);
  } catch (err) {
    console.error(`失败: ${err.message}`);
    process.exit(1);
  }
}

/**
 * 批量目录处理模式
 */
async function runBatchDir(config, fonts) {
  const INPUT_DIR = path.resolve('input');
  const OUTPUT_DIR = path.resolve('output');

  // 扫描 input 目录
  if (!fs.existsSync(INPUT_DIR)) {
    console.error(`[错误] input 目录不存在: ${INPUT_DIR}`);
    console.error('请创建 input 目录并放入图片文件');
    process.exit(1);
  }

  const allFiles = fs.readdirSync(INPUT_DIR);
  const imageFiles = allFiles.filter((f) => {
    const ext = path.extname(f).toLowerCase();
    return SUPPORTED_EXTS.has(ext) && !f.startsWith('.');
  });

  if (imageFiles.length === 0) {
    console.log('[信息] input 目录中没有找到支持的图片文件');
    console.log(`支持的格式: ${[...SUPPORTED_EXTS].join(', ')}`);
    process.exit(0);
  }

  console.log(`[信息] 找到 ${imageFiles.length} 张图片待处理\n`);

  // 确保 output 目录存在
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });

  // 批量处理
  let successCount = 0;
  let skipCount = 0;
  let failCount = 0;

  await processWithConcurrency(imageFiles, CONCURRENCY, async (filename, i) => {
    const inputPath = path.join(INPUT_DIR, filename);
    const baseName = path.parse(filename).name;
    const outputPath = path.join(OUTPUT_DIR, `${baseName}.jpg`);

    // 检查覆盖保护
    if (config.noOverwrite && fs.existsSync(outputPath)) {
      console.log(`[${i + 1}/${imageFiles.length}] 跳过 ${filename}（输出文件已存在）`);
      skipCount++;
      return;
    }

    // 获取字幕
    const subtitle = getSubtitleForImage(config, baseName);

    console.log(`[${i + 1}/${imageFiles.length}] 正在处理 ${filename}...`);

    try {
      await processImage(inputPath, outputPath, subtitle, fonts);
      successCount++;
      console.log(`[${i + 1}/${imageFiles.length}] 完成 ${filename} → ${baseName}.jpg`);
    } catch (err) {
      failCount++;
      console.error(`[${i + 1}/${imageFiles.length}] 失败 ${filename}: ${err.message}`);
    }
  });

  // 打印汇总
  console.log('\n========================================');
  console.log(`  处理完成！`);
  console.log(`  成功: ${successCount}  跳过: ${skipCount}  失败: ${failCount}`);
  console.log(`  输出目录: ${OUTPUT_DIR}`);
  console.log('========================================');
}

async function main() {
  console.log('========================================');
  console.log('  XPan Film Maker - 电影画幅照片生成器');
  console.log('========================================\n');

  // 加载配置
  const config = loadConfig();

  // 加载字体
  console.log('');
  const fonts = loadFonts();
  console.log('');

  // 根据是否指定了 --input 选择模式
  if (config.inputFile) {
    await runSingleFile(config, fonts);
  } else {
    await runBatchDir(config, fonts);
  }
}

main().catch((err) => {
  console.error('[致命错误]', err);
  process.exit(1);
});
