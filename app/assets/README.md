# DeeChat Assets

此文件夹包含打包应用所需的资源文件：

## 图标要求

为了完整的多端打包，需要以下图标文件：

### macOS
- `icon.icns` - macOS 应用图标 (建议尺寸: 1024x1024)

### Windows  
- `icon.ico` - Windows 应用图标 (建议包含16x16, 32x32, 48x48, 256x256等多个尺寸)

### Linux
- `icon.png` - Linux 应用图标 (建议尺寸: 512x512)

## 权限文件

- `entitlements.mac.plist` - macOS 应用权限配置，包含网络访问、文件读写等必要权限

## 图标创建建议

1. 准备一个 1024x1024 的高质量 PNG 图标
2. 使用在线工具或设计软件生成不同格式：
   - PNG → ICNS (macOS): 可使用 `sips` 命令或在线转换工具
   - PNG → ICO (Windows): 可使用在线转换工具

## 临时方案

当前配置使用占位图标路径，如果没有实际图标文件，electron-builder 会使用默认图标。
要获得专业的应用外观，建议添加自定义图标。