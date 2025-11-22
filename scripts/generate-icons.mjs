/**
 * 图标生成脚本
 * 从 SVG 生成多种尺寸的 PNG 图标（包括不同状态）
 */

import sharp from 'sharp';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';
import { existsSync, mkdirSync } from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const ICON_SIZES = [16, 32, 48, 128];
const OUTPUT_DIR = resolve(__dirname, '../public/icons');

// 不同状态的图标
const ICON_STATES = [
  { name: 'icon', label: '默认' },
  { name: 'icon-full', label: '2次可用' },
  { name: 'icon-half', label: '1次可用' },
  { name: 'icon-cooldown', label: 'CD中' }
];

async function generateIcons() {
  console.log('🎨 开始生成图标...\n');

  // 确保输出目录存在
  if (!existsSync(OUTPUT_DIR)) {
    mkdirSync(OUTPUT_DIR, { recursive: true });
  }

  // 为每种状态生成图标
  for (const state of ICON_STATES) {
    const svgPath = resolve(__dirname, `../public/icons/${state.name}.svg`);

    // 检查 SVG 是否存在
    if (!existsSync(svgPath)) {
      console.log(`⚠️  跳过 ${state.label}: SVG 文件不存在`);
      continue;
    }

    console.log(`📦 生成 ${state.label} 图标...`);

    // 生成各种尺寸的 PNG
    for (const size of ICON_SIZES) {
      const outputPath = resolve(OUTPUT_DIR, `${state.name}-${size}.png`);

      try {
        await sharp(svgPath)
          .resize(size, size, {
            fit: 'contain',
            background: { r: 0, g: 0, b: 0, alpha: 0 }, // 透明背景
          })
          .png({
            compressionLevel: 9, // 最高压缩
            quality: 100,
          })
          .toFile(outputPath);

        console.log(`   ✅ ${state.name}-${size}.png`);
      } catch (error) {
        console.error(`   ❌ 生成 ${size}x${size} 失败:`, error.message);
      }
    }
    console.log('');
  }

  console.log('🎉 所有图标生成完成！');
  console.log(`📁 输出目录: ${OUTPUT_DIR}`);
}

// 执行
generateIcons().catch((error) => {
  console.error('❌ 生成失败:', error);
  process.exit(1);
});
