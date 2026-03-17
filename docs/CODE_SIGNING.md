# 代码签名配置总览

本项目支持 macOS 和 Windows 平台的代码签名，确保用户下载的应用程序来源可信。

## 平台支持

| 平台 | 状态 | 配置文档 |
|------|------|----------|
| macOS | ✅ 已配置 | [查看说明](#macos-签名) |
| Windows | ✅ 已配置 | [查看说明](./WINDOWS_SIGNING.md) |

## macOS 签名

### 已配置的 Secrets

- `APPLE_CERTIFICATE` - Apple Distribution 证书（base64）
- `APPLE_CERTIFICATE_PASSWORD` - 证书密码
- `APPLE_SIGNING_IDENTITY` - 签名身份
- `APPLE_TEAM_ID` - Team ID: `YGTQGCDN2W`
- `APPLE_ID` - Apple ID（用于公证）
- `APPLE_PASSWORD` - App-specific password（用于公证）

### 导出证书

```bash
./scripts/export-signing-cert.sh
```

### 签名信息

- **证书类型**: Apple Distribution
- **组织**: Guangzhou Youyidian Intelligence Technology Co.,Ltd
- **Team ID**: YGTQGCDN2W

## Windows 签名

### 需要配置的 Secrets

- `WINDOWS_CERTIFICATE` - Windows 代码签名证书（base64）
- `WINDOWS_CERTIFICATE_PASSWORD` - 证书密码

### 导出证书

```bash
./scripts/export-windows-cert.sh
```

详细配置步骤请参考：[Windows 签名配置指南](./WINDOWS_SIGNING.md)

## GitHub Actions 工作流

签名配置已集成到 `.github/workflows/release.yml` 中：

```yaml
- uses: tauri-apps/tauri-action@v0
  env:
    # macOS 签名
    APPLE_CERTIFICATE: ${{ secrets.APPLE_CERTIFICATE }}
    APPLE_CERTIFICATE_PASSWORD: ${{ secrets.APPLE_CERTIFICATE_PASSWORD }}
    # ... 其他 macOS 配置

    # Windows 签名
    WINDOWS_CERTIFICATE: ${{ secrets.WINDOWS_CERTIFICATE }}
    WINDOWS_CERTIFICATE_PASSWORD: ${{ secrets.WINDOWS_CERTIFICATE_PASSWORD }}
```

## 发布流程

1. 确保所有 Secrets 已在 GitHub 仓库中配置
2. 创建并推送版本标签：
   ```bash
   git tag v1.0.0
   git push origin v1.0.0
   ```
3. GitHub Actions 自动构建并签名
4. 检查 Release 页面的草稿版本
5. 验证签名后发布

## 本地测试

### macOS

```bash
# 设置环境变量
export APPLE_CERTIFICATE="<base64>"
export APPLE_CERTIFICATE_PASSWORD="<password>"
export APPLE_SIGNING_IDENTITY="Apple Distribution: ..."
export APPLE_TEAM_ID="YGTQGCDN2W"

# 构建
npm run tauri build
```

### Windows

```powershell
# 设置环境变量
$env:WINDOWS_CERTIFICATE="<base64>"
$env:WINDOWS_CERTIFICATE_PASSWORD="<password>"

# 构建
npm run tauri build
```

## 验证签名

### macOS

```bash
# 验证签名
codesign -dv --verbose=4 /path/to/app.app

# 验证公证
spctl -a -vv /path/to/app.app
```

### Windows

右键点击 .exe 或 .msi 文件 > 属性 > 数字签名

## 证书管理

### 证书有效期

- 定期检查证书有效期
- 提前 30 天续费证书
- 更新 GitHub Secrets 中的证书

### 安全注意事项

1. ⚠️ 不要将证书文件提交到代码仓库
2. ⚠️ 不要在日志中打印证书内容
3. ⚠️ 定期轮换证书密码
4. ⚠️ 限制 GitHub Secrets 的访问权限

## 故障排查

### 常见问题

1. **签名失败**: 检查证书是否过期、密码是否正确
2. **公证失败**: 检查 Apple ID 和 App-specific password
3. **时间戳失败**: 检查网络连接和时间戳服务器状态

### 获取帮助

- 查看 GitHub Actions 日志
- 检查 Tauri 文档：https://tauri.app/v1/guides/distribution/sign-macos
- 提交 Issue
