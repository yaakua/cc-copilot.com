
### **cc-copilot 桌面应用 - 详细技术方案**

#### 1. 项目概述

本项目旨在开发一个跨平台的桌面应用程序，作为 `claude-code` npm 包的图形用户界面（GUI）封装。它旨在为非技术用户和高级用户提供一个直观、易用的环境，以利用 `claude-code` 的核心功能，并扩展其能力，如连接第三方 LLM API、动态模型切换、会话管理和使用情况统计。

**核心功能:**
-   **项目与会话管理:** 以项目为单位组织聊天会话。
-   **本地代理服务:** 拦截 `claude-code` 的请求，实现 API 适配和动态路由。
-   **动态模型切换:** 在会话中无缝切换不同的后端 LLM API。
-   **精细化统计:** 提供会话、项目、全局三个维度的 Token 使用统计。
-   **集成终端体验:** 使用 `xterm.js` 提供真实的终端交互界面。
-   **跨平台支持:** 可在 macOS 和 Windows 上运行。
-   **一键式安装:** 自动处理 `claude-code` 的安装和环境配置。

---

#### 2. 技术栈与核心依赖

| 类别 | 技术/库 | 用途与说明 |
| :--- | :--- | :--- |
| **应用框架** | **Electron** | 跨平台桌面应用外壳，提供主进程（Node.js）和渲染进程（Chromium）。 |
| **UI 框架** | **React** (+ Vite) | 用于构建用户界面。Vite 提供极速的开发服务器和构建体验。 |
| **UI 样式** | **Tailwind CSS** | 用于快速构建现代化的、一致的 UI 界面，实现我们的原型设计。 |
| **终端模拟** | **Xterm.js** | 在 UI 中渲染一个功能齐全的终端，用于与 `claude-code` 子进程交互。 |
| **状态管理** | **Zustand** (推荐) | 轻量级的全局状态管理库，用于管理跨组件的状态，如当前项目、会话、API设置、统计数据等。比 Redux 简单得多。 |
| **数据持久化**| **electron-store** | 简单、安全地在本地存储用户数据，如项目、会话历史、API配置、统计数据等。 |
| **本地代理** | **Express.js** + **http-proxy-middleware** | 在主进程中快速搭建一个本地 HTTP 代理服务器，用于拦截和转发 API 请求。 |
| **打包工具** | **Electron Builder** | 将应用打包成可分发的安装包（`.dmg`, `.exe`）。 |
| **语言** | **TypeScript** | 为整个项目提供类型安全，提高代码质量和可维护性。 |

---

#### 3. 架构设计

应用分为两个主要进程，这是 Electron 的核心模型：

1.  **主进程 (Main Process):**
    *   **环境:** Node.js。
    *   **职责:**
        *   创建和管理应用窗口 (`BrowserWindow`)。
        *   **启动和管理 `claude-code` 子进程 (`child_process.spawn`)。**
        *   **运行本地代理服务器 (Express.js)。**
        *   处理所有文件系统操作和数据持久化 (`electron-store`)。
        *   处理应用生命周期事件（启动、关闭等）。
        *   通过 IPC (Inter-Process Communication) 与渲染进程通信。
        *   **首次启动时，检查并静默安装 `claude-code`。**

2.  **渲染进程 (Renderer Process):**
    *   **环境:** Chromium 浏览器。
    *   **职责:**
        *   渲染所有用户界面（使用 React 和 Tailwind CSS）。
        *   管理 `xterm.js` 终端实例。
        *   处理用户输入和交互事件。
        *   通过 IPC 将用户操作（如发送消息、切换模型）通知主进程。
        *   通过 IPC 从主进程接收数据（如 `claude-code` 的输出、统计更新）并更新 UI。

**数据流示意图:**

```
[用户交互] -> [UI (React)] -> [IPC] -> [主进程]
                                          |
   +--------------------------------------+----------------------------------+
   |                                      |                                  |
   V                                      V                                  V
[子进程管理] <--- stdin/stdout ---> [claude-code]   [本地代理 (Express)]   [数据存储 (electron-store)]
                                          |                |
                                          |                V
                                          +-----> [第三方 LLM API]
```

---

#### 4. 开发顺序与步骤

**Phase 1: 项目搭建与核心通信**

1.  **环境搭建:**
    *   使用 `Vite + Electron + React + TypeScript` 模板快速启动项目（例如 `electron-vite` 模板）。
    *   集成 Tailwind CSS 到项目中。
    *   安装核心依赖: `electron-store`, `xterm`, `express`, `zustand`。

2.  **主进程基础:**
    *   在主进程中，编写一个函数用于启动 `claude-code` 子进程。暂时将 `ANTHROPIC_BASE_URL` 硬编码为本地代理地址（如 `http://127.0.0.1:31299`）。
    *   编写一个函数用于启动一个最简单的 Express 本地代理服务器，它只做一件事：接收请求并打印到控制台。

3.  **UI 核心 - 终端集成:**
    *   在 React 中创建一个 `Terminal` 组件。
    *   使用 `xterm.js` 在该组件中渲染一个终端。
    *   **建立双向 IPC 通信:**
        *   `main -> renderer`: 主进程捕获 `claude-code` 的 `stdout`，通过 IPC (`webContents.send`) 发送给 `Terminal` 组件，组件调用 `term.write()` 显示输出。
        *   `renderer -> main`: `Terminal` 组件监听 `term.onData()` 事件（用户输入），通过 IPC (`ipcRenderer.invoke/send`) 发送给主进程，主进程将其写入 `claude-code` 的 `stdin`。
    *   **目标:** 在这个阶段，你应该能在一个基础的 UI 窗口里和 `claude-code` 进行基本的交互。

**Phase 2: 数据模型与持久化**

1.  **设计数据结构:**
    *   定义你的数据模型（用 TypeScript Interfaces）。
        *   `Project { id, name, createdAt }`
        *   `Session { id, projectId, name, createdAt, history: Message[], tokenUsage: { prompt, completion } }`
        *   `Message { role: 'user'|'assistant', content: string }`
        *   `ApiProvider { id, name, baseUrl, apiKey, adapter: string }`
        *   `Stats { global: TokenUsage, projects: { [projectId]: TokenUsage } }`

2.  **数据存储:**
    *   在主进程中初始化 `electron-store`。创建用于存储项目、会话、API 设置和统计数据的 key。
    *   编写一系列主进程的 IPC handlers，用于对这些数据进行增删改查（CRUD）。例如 `get-projects`, `create-session`, `update-stats` 等。

3.  **全局状态管理:**
    *   在 React 应用中设置 Zustand store。
    *   应用启动时，通过 IPC 从主进程获取所有初始数据（项目列表、会话等）并填充到 Zustand store 中。
    *   UI 组件从 Zustand store 中读取数据进行渲染，而不是直接请求主进程。

**Phase 3: UI 实现与原型还原**

1.  **构建组件:**
    *   根据 V2 原型，逐一创建 React 组件：`ProjectBar`, `SessionList`, `StatusBar`, `SettingsModal` 等。
    *   使用 Tailwind CSS 精确还原样式。
    *   所有组件都从 Zustand store 获取数据，并通过调用 action 来更新状态（这些 action 内部会通过 IPC 通知主进程持久化数据）。

2.  **实现核心交互逻辑:**
    *   **项目/会话切换:** 点击 `ProjectBar` 或 `SessionList` 中的项，更新 Zustand 中的 `activeProjectId` 和 `activeSessionId`。UI 会自动响应并重新渲染。
    *   **设置页面:** 实现 `SettingsModal`，允许用户 CRUD `ApiProvider` 数据。保存时，通过 IPC 将更新后的数据发送到主进程。

**Phase 4: 本地代理与动态切换**

1.  **增强本地代理:**
    *   让 Express 代理不再只是打印日志。
    *   当请求到达时，从请求头或请求体中获取必要信息。
    *   读取主进程内存中的当前激活的 `ApiProvider` 配置（或从会话中指定的模型）。
    *   **实现适配器 (Adapter) 逻辑:** 创建一个 `adapters` 目录。每个适配器是一个函数，接收原始请求，返回适配后（如修改 model name）的请求对象。
    *   使用 `http-proxy-middleware` 将经过适配的请求转发到真正的第三方 API 地址。

2.  **模型切换 UI:**
    *   在终端顶部的下拉菜单中，列出所有已配置的 `ApiProvider`。
    *   当用户选择一个新模型时，更新当前会话在 Zustand store 中的 `activeModelId`。
    *   这个变化需要通知主进程，以便本地代理在处理下一个请求时使用新的目标 API。

3.  **统计实现:**
    *   在代理的 `onProxyRes` (响应) 事件中，拦截来自第三方 API 的响应。
    *   解析响应体，提取 `usage` 字段中的 `prompt_tokens` 和 `completion_tokens`。
    *   将这些 token 累加到主进程维护的统计数据中（当前会话、所属项目、全局）。
    *   主进程定期或在更新后，通过 IPC 将最新的统计数据推送给渲染进程，更新 Zustand store 和 UI。

**Phase 5: 打包与分发**

1.  **自动安装脚本:**
    *   在主进程的启动逻辑中，加入检查 `claude-code` 是否存在的代码。
    *   如果不存在，使用 `child_process.exec` 在应用的一个私有目录中静默执行 `npm install @anthropic-ai/claude-code`。
    *   确保 `spawn` `claude-code` 时，使用的是这个私有目录中的可执行文件。

2.  **配置 `electron-builder`:**
    *   在 `package.json` 或 `electron-builder.json` 中配置打包选项。
    *   设置应用图标 (`icon`)。
    *   配置 macOS (`.dmg`) 和 Windows (`.exe`) 的目标。
    *   运行打包命令 (`npm run build` 或类似命令)。

---

#### 5. 关键细节与注意事项

*   **安全性:** 永远不要将主进程的 Node.js 模块直接暴露给渲染进程。严格使用 `contextBridge` 在 `preload.js` 中定义安全的 IPC 接口。
*   **性能:** 对于长会话，避免在 `xterm.js` 中保留无限的回滚历史，可以设置一个合理的回滚行数 (`scrollback`)。
*   **错误处理:** 为所有异步操作（IPC 调用、文件读写、API 请求）添加 robust 的 `try...catch` 块。在 UI 上清晰地向用户展示错误信息。
*   **用户体验:** 在执行耗时操作（如安装依赖）时，在 UI 上提供明确的加载指示。

这份文档为你提供了一个从 0 到 1 的完整路线图。按照这个顺序和架构进行开发，你将能够系统地、高效地构建出这个功能强大的桌面应用。祝你开发顺利！