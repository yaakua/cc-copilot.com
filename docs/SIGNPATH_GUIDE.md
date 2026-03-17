# SignPath.io 开源项目免费签名服务

## 简介

SignPath.io 是专门为开源项目提供的免费代码签名服务，特别适合 CI/CD 自动化。

## 优势

- ✅ 完全免费（开源项目）
- ✅ 原生支持 GitHub Actions
- ✅ 自动化签名流程
- ✅ 证书由 SignPath 管理（无需自己购买）
- ✅ 支持 Windows、macOS、Android 等多平台
- ✅ 提供 EV 级别的证书

## 申请步骤

### 1. 注册账号

访问：https://about.signpath.io/product/open-source

点击 "Apply for free code signing"

### 2. 填写申请表

**Project Information:**
- Project Name: `CC Copilot Next`
- Project URL: `https://github.com/[你的用户名]/cc-copilot-next`
- License: MIT/Apache/GPL
- Description: AI-powered coding assistant

**Contact Information:**
- Name: [你的姓名]
- Email: [你的邮箱]
- Role: Project Maintainer

### 3. 等待审核

- 审核时间：1-2 周
- 会有专人联系你
- 可能需要视频会议确认项目

### 4. 配置 GitHub Actions

审核通过后，SignPath 会提供：
- Organization ID
- Project Slug
- API Token

## GitHub Actions 集成示例

创建 `.github/workflows/release-signpath.yml`：

```yaml
name: Release with SignPath

on:
  push:
    tags:
      - 'v*'

jobs:
  build-and-sign:
    runs-on: windows-latest
    steps:
      - uses: actions/checkout@v4

      - name: Setup Node
        uses: actions/setup-node@v4
        with:
          node-version: 20

      - name: Install Rust
        uses: dtolnay/rust-toolchain@stable

      - name: Install dependencies
        run: npm install

      - name: Build (unsigned)
        run: npm run tauri build

      - name: Sign with SignPath
        uses: signpath/github-action-submit-signing-request@v0.3
        with:
          api-token: ${{ secrets.SIGNPATH_API_TOKEN }}
          organization-id: ${{ secrets.SIGNPATH_ORGANIZATION_ID }}
          project-slug: 'cc-copilot-next'
          signing-policy-slug: 'release-signing'
          artifact-configuration-slug: 'windows-exe'
          input-artifact-path: 'src-tauri/target/release/bundle/msi/*.msi'
          output-artifact-path: 'signed-installer.msi'
          wait-for-completion: true

      - name: Create Release
        uses: softprops/action-gh-release@v1
        with:
          files: signed-installer.msi
          draft: true
```

## 配置 GitHub Secrets

在仓库设置中添加：
- `SIGNPATH_API_TOKEN`
- `SIGNPATH_ORGANIZATION_ID`

## 优缺点对比

### SignPath 优点
- 提供 EV 级别证书（立即信任）
- 完全托管，无需管理证书
- 专业的签名基础设施
- 审计日志和合规性

### SignPath 缺点
- 申请流程较长（1-2 周）
- 需要视频会议验证
- 签名速度较慢（需要上传到 SignPath）
- 依赖第三方服务

## 推荐选择

### 选择 Certum 如果：
- 想快速开始（3-5 天）
- 需要完全控制证书
- 构建速度要求高
- 可以接受初期的 SmartScreen 警告

### 选择 SignPath 如果：
- 需要 EV 级别证书（立即信任）
- 不想管理证书
- 重视安全审计
- 可以等待较长审核时间

