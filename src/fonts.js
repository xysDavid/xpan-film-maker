import fs from 'node:fs';
import path from 'node:path';

const FONTS_DIR = path.resolve('fonts');

// 常见系统字体回退路径（macOS）
const SYSTEM_FONT_PATHS = [
  '/System/Library/Fonts/STHeiti Light.ttc',
  '/System/Library/Fonts/PingFang.ttc',
  '/Library/Fonts/Arial Unicode.ttf',
];

/**
 * 根据文件名判断是否为中文字体
 * 简单启发式：文件名包含 CJK/SC/CN/Chinese/Noto.*SC/SourceHan/PingFang/Hei/Song 等关键词
 */
function isCJKFont(filename) {
  const lower = filename.toLowerCase();
  return /(?:sc|cn|cjk|chinese|noto.*sc|sourcehan|pingfang|hei|song|fang)/.test(lower);
}

/**
 * 获取字体的 MIME 类型
 */
function getFontMime(ext) {
  const mimes = {
    '.ttf': 'font/ttf',
    '.otf': 'font/otf',
    '.woff': 'font/woff',
    '.woff2': 'font/woff2',
  };
  return mimes[ext] || 'font/ttf';
}

/**
 * 读取字体文件并生成 SVG @font-face 声明
 */
function createFontFace(fontPath, familyName) {
  const ext = path.extname(fontPath).toLowerCase();
  const mime = getFontMime(ext);
  const fontData = fs.readFileSync(fontPath);
  const base64 = fontData.toString('base64');

  return `@font-face {
    font-family: '${familyName}';
    src: url('data:${mime};base64,${base64}');
    font-weight: normal;
    font-style: normal;
  }`;
}

/**
 * 加载字体
 * 优先从 ./fonts 目录加载，如无则回退到系统字体
 *
 * @returns {{ cnFontFace: string, enFontFace: string, cnFontFamily: string, enFontFamily: string }}
 */
export function loadFonts() {
  let cnFontPath = null;
  let enFontPath = null;

  // 扫描 ./fonts 目录
  if (fs.existsSync(FONTS_DIR)) {
    const files = fs.readdirSync(FONTS_DIR).filter((f) => {
      const ext = path.extname(f).toLowerCase();
      return ['.ttf', '.otf', '.woff', '.woff2'].includes(ext);
    });

    for (const file of files) {
      const fullPath = path.join(FONTS_DIR, file);
      if (isCJKFont(file)) {
        if (!cnFontPath) cnFontPath = fullPath;
      } else {
        if (!enFontPath) enFontPath = fullPath;
      }
    }

    // 如果只找到一个字体文件，中英文都用它
    if (files.length === 1) {
      const only = path.join(FONTS_DIR, files[0]);
      cnFontPath = cnFontPath || only;
      enFontPath = enFontPath || only;
    }

    // 如果找到多个但没有区分出英文字体，用中文字体兼做英文
    if (cnFontPath && !enFontPath) enFontPath = cnFontPath;
    if (enFontPath && !cnFontPath) cnFontPath = enFontPath;
  }

  // 如果 ./fonts 没有字体，尝试系统字体
  if (!cnFontPath) {
    for (const sysPath of SYSTEM_FONT_PATHS) {
      if (fs.existsSync(sysPath)) {
        cnFontPath = sysPath;
        break;
      }
    }
  }

  // 构建结果
  const cnFontFamily = 'SubtitleCN';
  const enFontFamily = cnFontPath === enFontPath ? 'SubtitleCN' : 'SubtitleEN';

  let cnFontFace = '';
  let enFontFace = '';

  if (cnFontPath) {
    console.log(`[字体] 中文字体: ${path.basename(cnFontPath)}`);
    cnFontFace = createFontFace(cnFontPath, cnFontFamily);
  } else {
    console.warn('[警告] 未找到中文字体，将使用 SVG 默认字体（中文可能无法正确显示）');
  }

  if (enFontPath && enFontPath !== cnFontPath) {
    console.log(`[字体] 英文字体: ${path.basename(enFontPath)}`);
    enFontFace = createFontFace(enFontPath, 'SubtitleEN');
  }

  return {
    cnFontFace,
    enFontFace,
    cnFontFamily: cnFontPath ? cnFontFamily : 'sans-serif',
    enFontFamily: enFontPath ? enFontFamily : 'sans-serif',
  };
}
