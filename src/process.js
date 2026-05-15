import sharp from 'sharp';

/**
 * XML 特殊字符转义
 */
function escapeXml(str) {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

/**
 * 生成字幕 SVG 叠加层
 *
 * @param {number} canvasW - 画布宽度
 * @param {number} canvasH - 画布高度
 * @param {number} origH - 原图高度
 * @param {number} offsetY - 原图在画布中的 Y 偏移
 * @param {{ cn: string, en: string }} subtitle - 字幕文案
 * @param {object} fonts - 字体信息
 * @returns {Buffer} SVG Buffer
 */
function createSubtitleSvg(canvasW, canvasH, origH, offsetY, subtitle, fonts) {
  const bottomBarTop = offsetY + origH;
  const bottomBarHeight = canvasH - bottomBarTop;

  const cnFontSize = Math.round(canvasW / 55);
  const enFontSize = Math.round(canvasW / 70);
  const lineGap = Math.round(cnFontSize * 0.4);

  // 字幕块总高度
  const blockHeight = cnFontSize + lineGap + enFontSize;
  // 在底部黑色区域内偏上放置（25% 位置），缩小与图片的间距
  const blockTopY = bottomBarTop + (bottomBarHeight - blockHeight) * 0.25;

  const cnY = Math.round(blockTopY + cnFontSize); // 中文基线
  const enY = Math.round(cnY + lineGap + enFontSize); // 英文基线

  // 构建 SVG 文本元素
  let textElements = '';

  if (subtitle.cn) {
    textElements += `
    <text x="50%" y="${cnY}" text-anchor="middle"
          font-family="'${fonts.cnFontFamily}', sans-serif" font-size="${cnFontSize}"
          fill="white">${escapeXml(subtitle.cn)}</text>`;
  }

  if (subtitle.en) {
    textElements += `
    <text x="50%" y="${enY}" text-anchor="middle"
          font-family="'${fonts.enFontFamily}', sans-serif" font-size="${enFontSize}"
          fill="#CCCCCC">${escapeXml(subtitle.en)}</text>`;
  }

  const svg = `<svg width="${canvasW}" height="${canvasH}" xmlns="http://www.w3.org/2000/svg">
  <style>
    ${fonts.cnFontFace}
    ${fonts.enFontFace}
  </style>
  ${textElements}
</svg>`;

  return Buffer.from(svg);
}

/**
 * 处理单张图片
 *
 * @param {string} inputPath - 输入文件路径
 * @param {string} outputPath - 输出文件路径
 * @param {{ cn: string, en: string } | null} subtitle - 字幕文案，null 表示无字幕
 * @param {object} fonts - 字体信息
 */
export async function processImage(inputPath, outputPath, subtitle, fonts) {
  // 读取原图元数据
  const metadata = await sharp(inputPath).metadata();
  const origW = metadata.width;
  const origH = metadata.height;

  if (!origW || !origH) {
    throw new Error(`无法读取图片尺寸: ${inputPath}`);
  }

  const targetRatio = 16 / 9;
  const origRatio = origW / origH;

  let canvasW, canvasH, offsetX, offsetY;

  if (origRatio > targetRatio) {
    // 原图更宽（XPan 典型情况）→ 上下补黑边
    canvasW = origW;
    canvasH = Math.round(origW / targetRatio);
    offsetX = 0;
    // 偏上放置（45%），给底部字幕留更多空间
    offsetY = Math.round((canvasH - origH) * 0.45);
  } else if (origRatio < targetRatio) {
    // 原图更窄 → 左右补黑边
    canvasH = origH;
    canvasW = Math.round(origH * targetRatio);
    offsetX = Math.round((canvasW - origW) / 2);
    offsetY = 0;
  } else {
    // 已经是 16:9
    canvasW = origW;
    canvasH = origH;
    offsetX = 0;
    offsetY = 0;
  }

  // 确保尺寸为偶数（某些编码器要求）
  canvasW = canvasW % 2 === 0 ? canvasW : canvasW + 1;
  canvasH = canvasH % 2 === 0 ? canvasH : canvasH + 1;

  // 构建合成层列表
  const composites = [
    { input: await sharp(inputPath).toBuffer(), left: offsetX, top: offsetY },
  ];

  // 如果有字幕，生成 SVG 叠加层
  if (subtitle && (subtitle.cn || subtitle.en)) {
    const svgBuffer = createSubtitleSvg(
      canvasW,
      canvasH,
      origH,
      offsetY,
      subtitle,
      fonts,
    );
    composites.push({ input: svgBuffer, left: 0, top: 0 });
  }

  // 创建黑色画布 + 合成
  await sharp({
    create: {
      width: canvasW,
      height: canvasH,
      channels: 3,
      background: { r: 0, g: 0, b: 0 },
    },
  })
    .composite(composites)
    .jpeg({ quality: 90 })
    .toFile(outputPath);
}
