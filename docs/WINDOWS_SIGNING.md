# Windows 代码签名配置指南

## 前提条件

1. 获取 Windows 代码签名证书（.pfx 或 .p12 格式）
   - 可从 DigiCert、Sectigo、GlobalSign 等 CA 机构购买
   - 证书类型：Code Signing Certificate 或 EV Code Signing Certificate

## 配置步骤

### 1. 导出证书为 Base64

运行导出脚本：

```bash
chmod +x scripts/export-windows-cert.sh
./scripts/export-windows-cert.sh
```

或手动操作：

```bash
# 将证书文件转换为 base64
base64 -i /path/to/your-cert.pfx | tr -d '\n'
```

### 2. 配置 GitHub Secrets

在 GitHub 仓库的 Settings > Secrets and variables > Actions 中添加：

| Secret 名称 | 说明 | 示例 |
|------------|------|------|
| `WINDOWS_CERTIFICATE` | 证书的 base64 编码 | (base64 字符串) |
| `WINDOWS_CERTIFICATE_PASSWORD` | 证书密码 | your_password |

### 3. 本地测试签名

在 Windows 环境下测试签名：

```powershell
# 设置环境变量
$env:WINDOWS_CERTIFICATE="<base64_string>"
$env:WINDOWS_CERTIFICATE_PASSWORD="<password>"

# 构建并签名
npm run tauri build
```

### 4. 验证签名

构建完成后，右键点击生成的 .exe 或 .msi 文件，选择"属性" > "数字签名"标签，应该能看到签名信息。

## 时间戳服务器

配置文件中使用的时间戳服务器：`http://timestamp.digicert.com`

其他可用的时间戳服务器：
- `http://timestamp.sectigo.com`
- `http://timestamp.globalsign.com`
- `http://timestamp.comodoca.com`

## 故障排查

### 签名失败

1. 检查证书是否过期
2. 确认证书密码正确
3. 验证证书格式（必须是 .pfx 或 .p12）
4. 检查时间戳服务器是否可访问

### GitHub Actions 构建失败

1. 确认 Secrets 已正确配置
2. 检查 base64 编码是否完整（无换行符）
3. 查看 Actions 日志中的详细错误信息

## 注意事项

1. **证书安全**：不要将证书文件提交到代码仓库
2. **密码保护**：使用强密码保护证书
3. **证书有效期**：定期检查证书有效期，提前续费
4. **EV 证书**：如果使用 EV 证书，可能需要硬件令牌，不适合 CI/CD 环境

## 相关文件

- `scripts/export-windows-cert.sh` - Windows 证书导出脚本
- `.github/workflows/release.yml` - GitHub Actions 配置
- `src-tauri/tauri.conf.json` - Tauri 签名配置
