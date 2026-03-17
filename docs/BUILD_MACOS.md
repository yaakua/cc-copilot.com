# macOS 构建指南

## 快速开始

构建带签名的 macOS Universal Binary（支持 Intel 和 Apple Silicon）：

```bash
npm run build:mac:signed
```

## 构建产物

构建成功后，应用位于：

```
src-tauri/target/universal-apple-darwin/release/bundle/macos/cc-copilot-next.app
```

## 测试应用

```bash
open src-tauri/target/universal-apple-darwin/release/bundle/macos/cc-copilot-next.app
```

## 验证签名

```bash
codesign -dv --verbose=4 src-tauri/target/universal-apple-darwin/release/bundle/macos/cc-copilot-next.app
```

## 前置要求

1. **签名证书**: 需要安装 Developer ID Application 证书
2. **Rust targets**: 脚本会自动安装所需的 targets（x86_64 和 aarch64）

## 手动构建

如果需要手动控制构建过程：

```bash
# 1. 安装 Rust targets（首次需要）
rustup target add x86_64-apple-darwin
rustup target add aarch64-apple-darwin

# 2. 构建
APPLE_SIGNING_IDENTITY="Developer ID Application: Guangzhou Youyidian Intelligence Technology Co.,Ltd (YGTQGCDN2W)" \
  npm run tauri build -- --target universal-apple-darwin
```

## 注意事项

- 构建时间约 3-5 分钟（取决于机器性能）
- Universal Binary 会同时编译 x86_64 和 aarch64 两个架构
- 应用会自动使用配置的签名证书进行签名
- 如需公证（notarization），需要配置 APPLE_ID 等环境变量

## 首次启动 Onboarding 功能

本次构建包含了新的首次启动体验优化：

- 自动检测系统中的 codex 和 claude CLI 配置
- 首次启动时显示欢迎页面
- 引导用户创建第一个 profile
- 如果未检测到 CLI 工具，提供安装指引

测试首次启动体验：
1. 删除应用数据目录（如果存在）
2. 启动应用
3. 应该会看到 Welcome 页面
