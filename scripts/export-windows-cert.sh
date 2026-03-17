#!/bin/bash

# 导出 Windows 签名证书用于 GitHub Actions

echo "=== 导出 Windows 代码签名证书 ==="
echo ""
echo "请按照以下步骤操作："
echo ""
echo "1. 确保你已经有 Windows 代码签名证书（.pfx 或 .p12 格式）"
echo "2. 将证书文件放到桌面，命名为: windows-signing-cert.pfx"
echo ""
read -p "完成后按回车继续..."

if [ ! -f ~/Desktop/windows-signing-cert.pfx ]; then
    echo "错误: 未找到 ~/Desktop/windows-signing-cert.pfx"
    exit 1
fi

echo ""
echo "=== 生成 GitHub Secrets ==="
echo ""

# 转换为 base64
CERT_BASE64=$(base64 -i ~/Desktop/windows-signing-cert.pfx | tr -d '\n')

echo "请在 GitHub 仓库设置中添加以下 Secrets:"
echo ""
echo "WINDOWS_CERTIFICATE:"
echo "$CERT_BASE64"
echo ""
echo "WINDOWS_CERTIFICATE_PASSWORD:"
echo "(你的 .pfx 证书密码)"
echo ""

# 清理
read -p "是否删除导出的证书文件? (y/n) " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    rm ~/Desktop/windows-signing-cert.pfx
    echo "已删除证书文件"
fi
