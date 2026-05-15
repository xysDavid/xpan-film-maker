import fs from 'node:fs';
import path from 'node:path';
import minimist from 'minimist';

const CONFIG_PATH = path.resolve('config.json');

/**
 * 加载并合并配置
 * 优先级：命令行参数 > 单张图片配置 > 全局默认配置
 */
export function loadConfig() {
  // 解析命令行参数
  const argv = minimist(process.argv.slice(2), {
    string: ['cn', 'en'],
    boolean: ['no-overwrite'],
    default: { 'no-overwrite': false },
  });

  // 读取 config.json
  let fileConfig = {};
  if (fs.existsSync(CONFIG_PATH)) {
    try {
      const raw = fs.readFileSync(CONFIG_PATH, 'utf-8');
      fileConfig = JSON.parse(raw);
    } catch (err) {
      console.warn(`[警告] config.json 解析失败，将使用空配置: ${err.message}`);
    }
  } else {
    console.log('[信息] 未找到 config.json，将使用命令行参数或无字幕模式');
  }

  // 命令行字幕覆盖
  let cliSubtitle = null;
  if (argv.cn || argv.en) {
    cliSubtitle = {
      cn: argv.cn || '',
      en: argv.en || '',
    };
  }

  return {
    defaultSubtitle: fileConfig.defaultSubtitle || null,
    images: fileConfig.images || {},
    noOverwrite: argv['no-overwrite'],
    cliSubtitle,
  };
}

/**
 * 获取某张图片的字幕配置
 * @param {object} config - loadConfig() 返回的配置
 * @param {string} filename - 图片文件名（不含扩展名）
 * @returns {{ cn: string, en: string } | null}
 */
export function getSubtitleForImage(config, filename) {
  // 优先级：命令行 > 单图配置 > 全局默认
  if (config.cliSubtitle) {
    return config.cliSubtitle;
  }

  if (config.images[filename]) {
    return config.images[filename];
  }

  if (config.defaultSubtitle) {
    return config.defaultSubtitle;
  }

  return null;
}
