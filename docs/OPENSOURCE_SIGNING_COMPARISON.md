# 开源项目 Windows 代码签名方案对比

## 快速决策

```
需要快速开始（3-5天）？ → Certum
需要立即信任（EV证书）？ → SignPath
预算有限？ → 两者都免费
```

## 详细对比

| 特性 | Certum Open Source | SignPath.io |
|------|-------------------|-------------|
| **价格** | 免费 | 免费 |
| **证书类型** | OV（标准） | EV（扩展验证） |
| **SmartScreen** | 需要积累信誉 | 立即信任 ✅ |
| **申请时间** | 3-5 天 | 1-2 周 |
| **审核流程** | 在线表单 | 表单 + 视频会议 |
| **自动化支持** | ✅ 完全支持 | ✅ 完全支持 |
| **证书管理** | 自己管理 .pfx | SignPath 托管 |
| **CI/CD 集成** | GitHub Secrets | GitHub Action |
| **签名速度** | 快（本地） | 慢（需上传） |
| **有效期** | 1 年 | 持续有效 |
| **续期** | 需要重新申请 | 自动续期 |
| **审计日志** | ❌ | ✅ |
| **多平台支持** | 仅 Windows | Windows/macOS/Android |

## 推荐方案：Certum（适合你的项目）

### 为什么选择 Certum？

1. **快速启动**
   - 3-5 天即可获得证书
   - 申请流程简单

2. **完全控制**
   - 证书文件在你手中
   - 可以离线签名
   - 构建速度快

3. **适合自动化**
   - 直接集成到现有的 GitHub Actions
   - 无需修改构建流程
   - 与 tauri-action 完美配合

4. **SmartScreen 问题可接受**
   - 开源项目通常有社区支持
   - 用户更愿意信任开源软件
   - 随着下载量增加，警告会消失

## 实施步骤（Certum）

### 第 1 步：准备项目

确保你的 GitHub 仓库满足要求：

```bash
# 检查清单
✅ 仓库是公开的
✅ 有明确的 LICENSE 文件
✅ 有 README.md 说明项目
✅ 有活跃的提交记录
✅ 有 releases 或计划发布
```

### 第 2 步：提交申请

1. 访问：https://www.certum.eu/certum/cert,offer_en_open_source_cs.xml
2. 使用 `docs/CERTUM_APPLICATION.md` 中的模板填写
3. 提交申请

### 第 3 步：等待审核

- 保持邮箱畅通
- 可能需要补充材料
- 通常 3-5 个工作日

### 第 4 步：下载证书

收到邮件后：
1. 下载 .pfx 文件
2. 设置强密码
3. 妥善保管

### 第 5 步：配置 GitHub

```bash
# 运行导出脚本
./scripts/export-windows-cert.sh

# 在 GitHub 仓库设置中添加 Secrets：
# - WINDOWS_CERTIFICATE
# - WINDOWS_CERTIFICATE_PASSWORD
```

### 第 6 步：测试构建

```bash
# 推送标签触发构建
git tag v0.1.0
git push origin v0.1.0

# 检查 GitHub Actions 日志
# 验证签名是否成功
```

## 处理 SmartScreen 警告

### 用户首次安装时会看到：

```
Windows protected your PC
Microsoft Defender SmartScreen prevented an unrecognized app from starting.
```

### 解决方案：

1. **在 README 中说明**
   ```markdown
   ## Windows 安装说明

   首次安装时，Windows 可能显示 SmartScreen 警告。
   这是因为我们的应用还在积累信誉。

   点击 "More info" → "Run anyway" 即可安装。

   我们的应用已使用 Certum 代码签名证书签名，
   可以验证软件来源和完整性。
   ```

2. **提供验证方法**
   ```markdown
   ### 验证签名

   右键点击安装文件 → 属性 → 数字签名
   应该能看到 Certum 的签名信息
   ```

3. **建立信誉**
   - 鼓励用户下载和安装
   - 通常 1000+ 下载后警告会消失
   - 保持定期更新和发布

## 成本对比

### Certum 方案
```
证书成本：$0
时间成本：3-5 天申请 + 1 小时配置
维护成本：每年续期一次
总成本：几乎为零
```

### 商业证书方案
```
OV 证书：$179-300/年
EV 证书：$300-500/年
时间成本：1-3 天申请 + 1 小时配置
总成本：$179-500/年
```

### SignPath 方案
```
证书成本：$0
时间成本：1-2 周申请 + 2 小时配置
维护成本：��需续期
总成本：时间成本较高
```

## 下一步行动

1. ✅ 已完成：配置文件和脚本准备
2. ⏳ 待完成：提交 Certum 申请
3. ⏳ 待完成：配置 GitHub Secrets
4. ⏳ 待完成：测试签名构建

## 相关文档

- [Certum 申请模板](./CERTUM_APPLICATION.md)
- [SignPath 指南](./SIGNPATH_GUIDE.md)
- [Windows 签名配置](./WINDOWS_SIGNING.md)
- [代码签名总览](./CODE_SIGNING.md)
