#!/bin/bash
set -e

# macOS 构建脚本 - 带签名的 Universal Binary

echo "🚀 开始构建 macOS Universal Binary..."

# 检查签名证书
SIGNING_IDENTITY="Developer ID Application: Guangzhou Youyidian Intelligence Technology Co.,Ltd (YGTQGCDN2W)"

if ! security find-identity -v -p codesigning | grep -q "$SIGNING_IDENTITY"; then
    echo "❌ 错误: 未找到签名证书"
    echo "请确保证书已安装: $SIGNING_IDENTITY"
    exit 1
fi

echo "✅ 找到签名证书"

# 检查 Rust targets
if ! rustup target list --installed | grep -q "x86_64-apple-darwin"; then
    echo "📦 安装 x86_64-apple-darwin target..."
    rustup target add x86_64-apple-darwin
fi

if ! rustup target list --installed | grep -q "aarch64-apple-darwin"; then
    echo "📦 安装 aarch64-apple-darwin target..."
    rustup target add aarch64-apple-darwin
fi

echo "✅ Rust targets 已就绪"

# 构建
echo "🔨 开始构建..."
APPLE_SIGNING_IDENTITY="$SIGNING_IDENTITY" npm run tauri build -- --target universal-apple-darwin

# 检查构建结果
APP_PATH="src-tauri/target/universal-apple-darwin/release/bundle/macos/cc-copilot-next.app"

if [ -d "$APP_PATH" ]; then
    echo ""
    echo "✅ 构建成功！"
    echo ""
    echo "📦 应用位置:"
    echo "   $APP_PATH"
    echo ""

    # 验证签名
    echo "🔍 验证签名..."
    codesign -dv --verbose=4 "$APP_PATH" 2>&1 | grep "Authority"

    echo ""
    echo "💡 测试应用:"
    echo "   open $APP_PATH"
    echo ""
else
    echo "❌ 构建失败: 未找到 .app 文件"
    exit 1
fi
