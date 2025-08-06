const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

// 确保build目录存在
const buildDir = path.join(__dirname, '..', 'build');
if (!fs.existsSync(buildDir)) {
  fs.mkdirSync(buildDir, { recursive: true });
}

// PNG源文件路径
const iconSourcePath = path.join(__dirname, '..', 'build', 'icon-source.png');

// 需要生成的图标尺寸
const sizes = [
  { size: 16, name: 'icon_16x16.png' },
  { size: 32, name: 'icon_32x32.png' },
  { size: 64, name: 'icon_64x64.png' },
  { size: 128, name: 'icon_128x128.png' },
  { size: 256, name: 'icon_256x256.png' },
  { size: 512, name: 'icon_512x512.png' },
  { size: 1024, name: 'icon_1024x1024.png' },
  // macOS需要的特殊尺寸
  { size: 16, name: 'icon.iconset/icon_16x16.png' },
  { size: 32, name: 'icon.iconset/icon_16x16@2x.png' },
  { size: 32, name: 'icon.iconset/icon_32x32.png' },
  { size: 64, name: 'icon.iconset/icon_32x32@2x.png' },
  { size: 128, name: 'icon.iconset/icon_128x128.png' },
  { size: 256, name: 'icon.iconset/icon_128x128@2x.png' },
  { size: 256, name: 'icon.iconset/icon_256x256.png' },
  { size: 512, name: 'icon.iconset/icon_256x256@2x.png' },
  { size: 512, name: 'icon.iconset/icon_512x512.png' },
  { size: 1024, name: 'icon.iconset/icon_512x512@2x.png' },
  // 通用图标
  { size: 256, name: 'icon.png' }
];

async function generateIcons() {
  try {
    console.log('🎨 开始生成应用图标...');
    
    // 创建iconset目录
    const iconsetDir = path.join(buildDir, 'icon.iconset');
    if (!fs.existsSync(iconsetDir)) {
      fs.mkdirSync(iconsetDir, { recursive: true });
    }

    // 读取PNG源文件
    const sourceBuffer = fs.readFileSync(iconSourcePath);
    
    // 生成各种尺寸的PNG图标
    for (const { size, name } of sizes) {
      const outputPath = path.join(buildDir, name);
      const outputDir = path.dirname(outputPath);
      
      // 确保输出目录存在
      if (!fs.existsSync(outputDir)) {
        fs.mkdirSync(outputDir, { recursive: true });
      }
      
      await sharp(sourceBuffer)
        .resize(size, size, {
          kernel: sharp.kernel.lanczos3,
          fit: 'contain',
          background: { r: 0, g: 0, b: 0, alpha: 0 }
        })
        .png()
        .toFile(outputPath);
      
      console.log(`✅ 生成 ${name} (${size}x${size})`);
    }
    
    console.log('🎉 所有图标生成完成！');
    
    // 生成macOS .icns文件（如果在macOS上）
    if (process.platform === 'darwin') {
      console.log('🍎 正在生成macOS .icns文件...');
      const { execSync } = require('child_process');
      try {
        execSync(`iconutil -c icns "${iconsetDir}" -o "${path.join(buildDir, 'icon.icns')}"`, { stdio: 'inherit' });
        console.log('✅ macOS .icns文件生成完成！');
      } catch (error) {
        console.warn('⚠️  无法生成.icns文件，但PNG图标已生成');
      }
    }
    
  } catch (error) {
    console.error('❌ 生成图标时出错:', error);
    process.exit(1);
  }
}

generateIcons();
