# 开源项目 Windows 签名快速开始

## 🚀 5 分钟快速配置

### 前提条件

- ✅ GitHub 仓库是公开的
- ✅ 有开源协议（LICENSE 文件）
- ✅ 项目有活跃的提交记录

### 立即开始

#### 1️⃣ 提交 Certum 申请（5 分钟）

访问：https://www.certum.eu/certum/cert,offer_en_open_source_cs.xml

填写信息：
```
Project Name: CC Copilot Next
Project URL: https://github.com/[你的用户名]/cc-copilot-next
License: MIT (或你的协议)
Email: [你的邮箱]
Description: AI-powered coding assistant for developers
```

参考完整模板：`docs/CERTUM_APPLICATION.md`

#### 2️⃣ 等待审核（3-5 天）

- 检查邮箱（包括垃圾邮件）
- 可能需要补充材料
- 保持邮箱畅通

#### 3️⃣ 下载证书（收到邮件后）

1. 点击邮件中的下载链接
2. 下载 .pfx 文件到桌面
3. 重命名为：`windows-signing-cert.pfx`
4. 记住你设置的密码

#### 4️⃣ 导出为 Base64（2 分钟）

```bash
# 运行导出脚本
cd /Users/yangkui/workspace/github/cc-copilot-next
./scripts/export-windows-cert.sh

# 脚本会自动：
# 1. 读取证书文件
# 2. 转换为 base64
# 3. 显示需要添加到 GitHub 的内容
```

#### 5️⃣ 配置 GitHub Secrets（2 分钟）

1. 打开：https://github.com/[你的用户名]/cc-copilot-next/settings/secrets/actions

2. 点击 "New repository secret"

3. 添加两个 Secrets：

   **Secret 1:**
   ```
   Name: WINDOWS_CERTIFICATE
   Value: [脚本输出的 base64 字符串]
   ```

   **Secret 2:**
   ```
   Name: WINDOWS_CERTIFICATE_PASSWORD
   Value: [你的证书密码]
   ```

#### 6️⃣ 测试构建（1 分钟）

```bash
# 创建测试标签
git tag v0.1.0-test
git push origin v0.1.0-test

# 查看构建状态
# https://github.com/[你的用户名]/cc-copilot-next/actions
```

#### 7️⃣ 验证签名

构建完成后：
1. 下载生成的 .msi 或 .exe 文件
2. 右键 → 属性 → 数字签名
3. 应该能看到 Certum 的签名信息

## ✅ 完成！

现在你的 Windows 应用已经有代码签名了！

## 📋 检查清单

- [ ] Certum 申请已提交
- [ ] 收到证书文件
- [ ] GitHub Secrets 已配置
- [ ] 测试构建成功
- [ ] 签名验证通过

## ⚠️ 常见问题

### Q: SmartScreen 还是显示警告？

A: 这是正常的。新证书需要积累信誉：
- 通常需要 1000+ 次下载
- 需要几周到几个月时间
- 用户可以点击 "More info" → "Run anyway"

### Q: 证书申请被拒绝？

A: 检查以下几点：
- 仓库必须是公开的
- 必须有明确的开源协议
- 项目要有实际的代码和提交
- 确保项目描述清晰

### Q: 构建失败？

A: 检查：
1. GitHub Secrets 是否正确配置
2. base64 字符串是否完整（无换行）
3. 证书密码是否正确
4. 查看 Actions 日志的详细错误

### Q: 证书过期了怎么办？

A: Certum 证书有效期 1 年：
- 到期前 30 天重新申请
- 流程与首次申请相同
- 更新 GitHub Secrets

## 🔗 相关文档

- [详细对比](./OPENSOURCE_SIGNING_COMPARISON.md) - 选择最适合的方案
- [Certum 申请模板](./CERTUM_APPLICATION.md) - 完整的申请信息
- [Windows 签名配置](./WINDOWS_SIGNING.md) - 详细配置说明
- [代码签名总览](./CODE_SIGNING.md) - macOS + Windows 完整指南

## 💡 提示

1. **证书安全**
   - 不要将 .pfx 文件提交到代码仓库
   - 使用强密码保护证书
   - 定期更换 GitHub Secrets

2. **用户体验**
   - 在 README 中说明 SmartScreen 警告
   - 提供签名验证方法
   - 鼓励用户反馈问题

3. **持续改进**
   - 保持定期发布
   - 收集用户反馈
   - 监控下载量和信誉积累

## 🎉 下一步

证书配置完成后，你可以：
- 发布正式版本
- 更新 README 添加下载链接
- 在社区宣传你的项目
- 收集用户反馈

祝你的开源项目成功！🚀
