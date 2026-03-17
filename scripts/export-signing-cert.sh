#!/bin/bash

# 导出 macOS 签名证书用于 GitHub Actions
# Team ID: YGTQGCDN2W

echo "=== 导出 Apple Distribution 证书 ==="
echo ""
echo "请按照以下步骤操作："
echo ""
echo "1. 打开「钥匙串访问」应用"
echo "2. 在左侧选择「登录」钥匙串"
echo "3. 在上方选择「我的证书」分类"
echo "4. 找到「Apple Distribution: Guangzhou Youyidian Intelligence Technology Co.,Ltd」"
echo "5. 右键点击 -> 导出"
echo "6. 保存为: ~/Desktop/apple-distribution.p12"
echo "7. 设置一个密码（记住这个密码）"
echo ""
read -p "完成后按回车继续..."

if [ ! -f ~/Desktop/apple-distribution.p12 ]; then
    echo "错误: 未找到 ~/Desktop/apple-distribution.p12"
    exit 1
fi

echo ""
echo "=== 生成 GitHub Secrets ==="
echo ""

# 转换为 base64
CERT_BASE64=$(base64 -i ~/Desktop/apple-distribution.p12 | tr -d '\n')

echo "请在 GitHub 仓库设置中添加以下 Secrets:"
echo ""
echo "APPLE_CERTIFICATE:"
echo "$CERT_BASE64"
echo ""
echo "APPLE_CERTIFICATE_PASSWORD:"
echo "(你刚才设置的 .p12 密码)"
echo ""
echo "APPLE_SIGNING_IDENTITY:"
echo "Apple Distribution: Guangzhou Youyidian Intelligence Technology Co.,Ltd (YGTQGCDN2W)"
echo ""
echo "APPLE_TEAM_ID:"
echo "YGTQGCDN2W"
echo ""
echo "=== 公证所需（可选）==="
echo ""
echo "如需公证，还需要添加:"
echo "APPLE_ID: (你的 Apple ID 邮箱)"
echo "APPLE_PASSWORD: (App-specific password，在 appleid.apple.com 生成)"
echo ""
echo "生成 App-specific password:"
echo "1. 访问 https://appleid.apple.com"
echo "2. 登录后进入「安全」部分"
echo "3. 在「App 专用密码」下点击「生成密码」"
echo ""

# 清理
read -p "是否删除导出的证书文件? (y/n) " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    rm ~/Desktop/apple-distribution.p12
    echo "已删除证书文件"
fi
