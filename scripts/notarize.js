// scripts/notarize.js
require('dotenv').config({ path: '.env.local' });// 确保这行在最前面
const { notarize } = require('@electron/notarize');
console.log('Attempting to notarize with the following credentials:');
console.log(`APPLE_ID: ${process.env.APPLE_ID}`);
console.log(`APPLE_TEAM_ID: ${process.env.APPLE_TEAM_ID}`);
console.log(`Has APPLE_ID_PASSWORD: ${!!process.env.APPLE_ID_PASSWORD}`); // 使用 !! 转换为布尔值，避免打印密码

exports.default = async function notarizing(context) {
    const { electronPlatformName, appOutDir } = context;
    console.log("### electronPlatformName:", electronPlatformName);
    if (electronPlatformName !== 'darwin') {
        return;
    }
    const appleId = process.env.APPLE_ID;
    const appleIdPassword = process.env.APPLE_ID_PASSWORD;
    const teamId = process.env.APPLE_TEAM_ID;
    const appName = context.packager.appInfo.productFilename;
    if (!appleId || !appleIdPassword || !teamId) {
        console.error('Missing Apple credentials in environment variables. Skipping notarization.');
        return; // 如果缺少凭证，直接返回
    }
    return await notarize({
        appBundleId: 'com.cc-copilot.cc-copilot',
        appPath: `${appOutDir}/${appName}.app`,
        appleId: process.env.APPLE_ID,
        appleIdPassword: process.env.APPLE_ID_PASSWORD,
        teamId: process.env.APPLE_TEAM_ID,
    });
};