# CC Copilot

一个简化的 Claude Code 桌面GUI应用，提供项目管理和会话管理功能。

## 功能特性

### 界面布局
- **左侧会话列表**：按项目组织的会话管理
- **右侧终端界面**：基于 xterm.js 的终端，支持会话切换
- **底部状态栏**：显示当前渠道、代理状态、项目路径

### 核心功能
- 项目组织的会话管理
- 支持新建/恢复会话
- 终端会话管理
- 本地HTTP代理服务器
- 设置持久化存储

## 架构设计

### Main Process (Electron主进程)
- **main.ts**: 应用程序入口，IPC处理
- **proxy.ts**: HTTP代理服务器 (端口: 31299)
- **pty-manager.ts**: 终端进程管理
- **store.ts**: 数据存储管理
- **settings.ts**: 设置管理

### Renderer Process (渲染进程)
- **App.tsx**: 主应用组件
- **SessionList.tsx**: 会话列表组件
- **Terminal.tsx**: 终端组件
- **StatusBar.tsx**: 状态栏组件

## 使用说明

1. **启动应用程序**
   ```bash
   npm install
   npm run dev
   ```

2. **创建项目**
   - 点击左上角的 "+" 按钮
   - 选择项目目录
   - 自动创建新会话

3. **管理会话**
   - 在项目下点击绿色 "+" 创建新会话
   - 点击会话项激活终端
   - 点击红色 "×" 删除会话

4. **终端操作**
   - 激活会话后会自动启动 `claude` 命令
   - 支持所有标准终端操作
   - 自动设置代理环境变量

## 技术栈

- **Electron**: 桌面应用框架
- **React + TypeScript**: 前端界面
- **Tailwind CSS**: 样式框架
- **xterm.js**: 终端模拟器
- **node-pty**: 终端进程管理
- **express**: HTTP代理服务器
- **electron-store**: 本地数据存储

## 代理配置

应用程序会自动启动HTTP代理服务器 (http://127.0.0.1:31299)，并设置环境变量：
- `ANTHROPIC_BASE_URL=http://127.0.0.1:31299`

可在设置中配置上游代理：
- 支持HTTP代理
- 支持认证配置
- 动态切换

## 数据存储

所有数据存储在用户数据目录：
- **macOS**: `~/Library/Application Support/cc-copilot/`
- **Windows**: `%APPDATA%/cc-copilot/`
- **Linux**: `~/.config/cc-copilot/`

存储文件：
- `data.json`: 项目和会话数据
- `settings.json`: 应用设置

## 开发

```bash
# 安装依赖
npm install

# 开发模式
npm run dev

# 构建
npm run build

# 打包
npm run build:mac   # macOS
npm run build:win   # Windows
npm run build:linux # Linux
```

## 系统要求

- Node.js 16+
- Claude CLI (需单独安装)

## 许可证

MIT License

---

## 项目重构说明

此版本已经过完全重构，实现了最简化的可用版本：

### 已实现功能
✅ 基础Electron应用架构  
✅ 项目和会话管理  
✅ 终端集成 (xterm.js)  
✅ HTTP代理服务器  
✅ 设置管理  
✅ 数据持久化存储  

### 已删除复杂功能
❌ 复杂的状态管理 (zustand)  
❌ 多余的认证系统  
❌ Claude检测和安装向导  
❌ 统计和分析功能  
❌ 复杂的错误处理  

### 核心工作流程
1. 启动应用 → 启动HTTP代理服务器
2. 选择项目目录 → 创建会话
3. 激活会话 → 启动终端并执行 `claude` 命令
4. 在终端中与Claude Code交互

这是一个专注于核心功能的最小可行版本，可以作为后续功能扩展的基础。