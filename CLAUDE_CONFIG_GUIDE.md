# Claude 配置指南

## Claude 官方认证集成

cc-copilot 现在支持自动检测和集成 Claude 官方认证信息。系统会在多个位置搜索 Claude 的配置文件：

### 搜索路径

#### Windows 系统
- `%USERPROFILE%\.claude\settings.json`
- `%APPDATA%\.claude\settings.json`
- `%LOCALAPPDATA%\.claude\settings.json`
- `C:\Program Files\Claude\.claude\settings.json`
- `C:\Program Files (x86)\Claude\.claude\settings.json`

#### macOS/Linux 系统
- `~/.claude/settings.json`
- `~/.config/claude/settings.json`
- `$XDG_CONFIG_HOME/claude/settings.json`
- `/usr/local/lib/claude/.claude/settings.json`
- `/opt/claude/.claude/settings.json`

#### 本地安装检测
- 当前应用目录: `./claude/settings.json`
- 父目录: `../claude/settings.json`
- Node modules: `./node_modules/@anthropic-ai/claude-code/.claude/settings.json`

### 环境变量配置

如果 Claude 配置文件在非标准位置，可以通过环境变量指定：

```bash
# macOS/Linux
export CLAUDE_CONFIG_PATH="/path/to/your/claude/settings.json"

# Windows
set CLAUDE_CONFIG_PATH="C:\path\to\your\claude\settings.json"
```

### 自动设置脚本

#### Windows
运行 `setup-claude-config.bat` 脚本：
```cmd
setup-claude-config.bat
```

#### macOS/Linux
运行 `setup-claude-config.sh` 脚本：
```bash
./setup-claude-config.sh
```

## 功能特性

### 1. 自动登录
- 启用后，应用启动时会自动检测 Claude 官方认证
- 如果找到有效的认证信息，会自动切换到官方渠道

### 2. 渠道切换
- 在状态栏可以看到当前使用的 API 渠道
- 支持官方和第三方渠道的动态切换
- 实时显示连接状态

### 3. 配置调试
- 在设置界面可以查看配置文件搜索状态
- 显示找到的配置文件和有效的认证信息
- 便于排查配置问题

## 使用方法

1. **启动应用**：应用会自动搜索 Claude 配置文件
2. **查看状态**：在状态栏查看当前使用的渠道
3. **切换渠道**：点击渠道名称选择不同的 API 提供商
4. **配置设置**：在设置界面启用自动登录和查看配置状态

## 故障排除

### 认证未找到
1. 确保已经使用 `claude-code` CLI 登录过
2. 检查配置文件是否存在于标准位置
3. 使用环境变量指定配置文件路径
4. 在设置界面查看配置检测详情

### 连接失败
1. 检查网络连接
2. 验证 API 密钥是否有效
3. 确认 API 服务器可访问
4. 查看控制台日志了解详细错误信息

## 支持的 Claude 安装方式

- **全局安装**：`npm install -g @anthropic-ai/claude-code`
- **本地安装**：在项目目录中安装
- **便携安装**：与 cc-copilot 同目录
- **系统安装**：通过包管理器安装

系统会自动检测所有这些安装方式并找到相应的配置文件。