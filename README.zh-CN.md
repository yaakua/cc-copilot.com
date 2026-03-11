# CC Copilot Next

[English](./README.md) | [中文](./README.zh-CN.md)

CC Copilot Next 是一个面向 CLI Coding Agent 的 Tauri 桌面工作台。它为 `Codex CLI` 和 `Claude Code` 提供图形化、多会话的工作界面，让你可以在项目、会话和多窗格之间切换与对比，而不是把终端作为主要交互入口。

## 核心功能

- 多项目工作区：通过侧边栏统一管理项目和会话
- 最多 4 个窗格：支持并行运行、结果对比和分屏会话工作流
- 统一输入区：围绕当前工作区发送提示词，保持对话体验集中
- 双 Provider 支持：原生面向 `Codex CLI` 和 `Claude Code`
- 按窗格绑定 Provider Profile：支持官方登录态、system runtime 或基于 API Key 的网关配置
- 流式会话时间线：可展示状态事件、工具输出，并支持重试与取消运行
- 本地持久化：保存项目、会话、窗格、消息与草稿状态
- 安全密钥存储：API Key 通过系统 keychain 管理，而不是直接写入应用状态文件

## 主要面向人群

CC Copilot Next 主要适合以下用户：

- 已经高频使用 `Codex CLI` 或 `Claude Code` 的开发者
- 需要并行比较多个 Agent 结果、多个账号或多个会话输出的高级用户
- 希望从 terminal-first 工作流切换到桌面工作台体验的个人或团队
- 需要基于项目管理历史会话，并在多个编码线程之间快速切换的使用者

## 工作方式

- 先按项目组织工作，再在项目下创建会话
- 可以将会话在主窗格中打开，或分屏到更多窗格中并行处理
- 每个窗格都可以单独绑定 provider 和 provider profile
- 通过底部统一输入区发起请求，在时间线中查看流式返回
- 工作区状态会保存在本地，应用重启后可以恢复上下文

## 当前产品范围

当前仓库重点聚焦于本地桌面体验：

- 使用 Tauri 2 负责系统集成与状态持久化
- 使用 React + TypeScript 构建图形化工作区前端
- 通过真实 CLI 执行 `Codex CLI` 与 `Claude Code`
- 提供官方账号与第三方网关两类 profile 管理能力

代码中已经出现远程访问 / 移动端相关能力，但目前更适合作为未来方向，而不是当前 README 中的主要承诺能力。

## 技术栈

- `Tauri 2`
- `React 19`
- `TypeScript`
- `Vite`
- `Tailwind CSS`

## 开发

```bash
npm install
npm run dev
```

仅启动前端开发服务器：

```bash
npm run dev:web
```

## 构建

仅构建前端：

```bash
npm run build:web
```

构建 macOS 桌面应用：

```bash
npm run build:mac
```

在 Windows 主机上构建 Windows 桌面应用：

```bash
npm run build:win
```

## 平台支持

- macOS：当前仓库已支持并验证
- Windows：已提供构建脚本，预期在 Windows 主机上使用
- Linux：当前明确不支持

## 推荐 IDE 环境

- [VS Code](https://code.visualstudio.com/)
- [Tauri VS Code 插件](https://marketplace.visualstudio.com/items?itemName=tauri-apps.tauri-vscode)
- [rust-analyzer](https://marketplace.visualstudio.com/items?itemName=rust-lang.rust-analyzer)

## 未来方向

后续可能继续增强：

- 更完整的远程 / 移动访问工作流
- 更深入的 provider 账号检测与管理能力
- 超出当前对话主视图之外的更多工作区视图能力
