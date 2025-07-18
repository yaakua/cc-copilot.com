# CC-Copilot

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://opensource.org/licenses/MIT)
[![Platform](https://img.shields.io/badge/platform-macOS%20%7C%20Windows%20%7C%20Linux-lightgrey)](https://github.com/yangkui/cc-copilot)
[![Built with](https://img.shields.io/badge/built%20with-Electron%20%7C%20React%20%7C%20TypeScript-blue)](https://github.com/yangkui/cc-copilot)

**The ultimate desktop GUI for `@anthropic-ai/claude-code`. Break free from the terminal and unlock the full potential of AI-assisted coding.**

`claude-code` is a fantastic tool, but its command-line interface and single-provider nature can be limiting. **CC-Copilot** is here to change that. It's an open-source, cross-platform desktop app that wraps `claude-code` in a powerful and intuitive interface, designed for a modern developer workflow.

![CC-Copilot Screenshot](docs/index.html)
*Professional desktop interface with project management, terminal integration, and multi-provider support*

## ✨ Features

### 🎯 **Core Capabilities**
- **Intuitive GUI**: Complete graphical interface for all `claude-code` interactions
- **Project Management**: Organize your coding sessions into projects with color-coded icons
- **Session Organization**: Create and manage multiple chat sessions within each project
- **Integrated Terminal**: Real terminal with `xterm.js` for seamless `claude-code` interaction

### 🔄 **Multi-Provider Support**
- **Universal API Support**: Connect to Anthropic, OpenAI, Groq, Moonshot, and more
- **Dynamic Model Switching**: Switch between AI models on-the-fly within the same session
- **Built-in Adapters**: Automatic API format conversion for different providers
- **Custom Providers**: Add your own API endpoints with custom configurations

### 📊 **Advanced Analytics**
- **Token Tracking**: Monitor usage across session, project, and global scopes
- **Real-time Statistics**: Live token consumption display with smart formatting
- **Usage Insights**: Detailed analytics to optimize your AI coding workflow

### 🛠️ **Developer Experience**
- **Auto-installation**: Automatically manages `claude-code` installation and updates
- **Keyboard Shortcuts**: Efficient workflow with customizable hotkeys
- **Error Handling**: Robust error boundaries with user-friendly messages
- **Dark Theme**: Professional dark interface optimized for long coding sessions

## 🚀 Quick Start

### Option 1: Download Pre-built App (Recommended)

1. Go to the [**Releases**](https://github.com/yangkui/cc-copilot/releases) page
2. Download the latest version for your platform:
   - **macOS**: Download `.dmg` file
   - **Windows**: Download `.exe` installer
   - **Linux**: Download `.AppImage` or `.deb` package
3. Install and launch the app

### Option 2: Try Browser Demo

Experience the full interface without installation:

```bash
# Clone the repository
git clone https://github.com/yangkui/cc-copilot.git
cd cc-copilot

# Install dependencies
npm install

# Start development server
npm run dev

# Open http://localhost:5173 in your browser
```

The browser demo includes a fully interactive terminal simulator to test all features.

## 🔧 Development & Compilation

### Prerequisites

- **Node.js**: v20.15.0 or higher
- **npm**: v10.8.2 or higher
- **Git**: For cloning the repository

### 🛠️ Build from Source

#### 1. Clone and Setup
```bash
# Clone the repository
git clone https://github.com/yangkui/cc-copilot.git
cd cc-copilot

# Install all dependencies
npm install
```

#### 2. Development
```bash
# Start development server (browser mode)
npm run dev

# Start development server (Electron mode)
npm run dev:electron  # Note: May require Electron fixes

# Build for development
npm run build
```

#### 3. Production Build
```bash
# Build the application
npm run build

# Build for specific platforms
npm run build:mac     # Build macOS .dmg
npm run build:win     # Build Windows .exe  
npm run build:linux   # Build Linux packages

# Build for all platforms
npm run build:all
```

#### 4. Testing
```bash
# Preview built application
npm run preview

# Run in browser mode (recommended for testing)
npm run dev
# Then open http://localhost:5173
```

### 📦 Build Outputs

After building, you'll find the distributable files in:

```
dist/
├── main/           # Electron main process
├── preload/        # Electron preload scripts  
├── renderer/       # React application
└── packages/       # Final installers
    ├── cc-copilot-1.0.0.dmg        # macOS
    ├── cc-copilot-1.0.0.exe        # Windows
    └── cc-copilot-1.0.0.AppImage   # Linux
```

### 🔧 Build Configuration

The application uses:
- **Electron**: v32.x for desktop app framework
- **Vite**: For fast build and development
- **Electron Builder**: For creating installers
- **TypeScript**: For type safety
- **React**: For the user interface
- **Tailwind CSS**: For styling

Configuration files:
- `electron.vite.config.ts` - Vite configuration
- `package.json` - Build scripts and dependencies
- `tailwind.config.js` - Styling configuration

## 📖 Usage Guide

### 🚀 **First Launch**

1. **Launch the Application**
   - The app will automatically check for `claude-code` installation
   - If not found, it will guide you through the setup process

2. **Configure API Providers**
   - Click the settings gear icon (⚙️) in the bottom left
   - Add your API providers (Anthropic, OpenAI, Groq, etc.)
   - Set API keys and base URLs
   - Choose your default provider

### 🎯 **Basic Workflow**

#### Create a Project
1. Click the **+** button in the project bar (left side)
2. Enter a project name (e.g., "Web Development")
3. The project icon will appear with auto-generated initials

#### Start a Session
1. Select a project from the left sidebar
2. Click **"New Chat"** in the session list
3. Enter a session name (e.g., "API Integration")
4. The terminal will initialize and connect to `claude-code`

#### Code with AI
1. Type your questions or requests in the terminal
2. Switch AI models using the dropdown in the top bar
3. View real-time token usage in the bottom status bar
4. Use the clear button or `Ctrl/Cmd+K` to clear the terminal

### ⌨️ **Keyboard Shortcuts**

| Shortcut | Action |
|----------|--------|
| `Ctrl/Cmd + K` | Clear terminal |
| `Ctrl/Cmd + N` | New session |
| `Ctrl/Cmd + ,` | Open settings |
| `Ctrl/Cmd + W` | Close current session |
| `F5` | Refresh/reconnect |

### 📊 **Statistics & Monitoring**

The bottom status bar shows:
- **Connection Status**: Running/Stopped/Error
- **Token Usage**: Prompt/Completion/Total tokens
- **Scope Selector**: Switch between Session/Project/Global stats
- **Controls**: Start/Stop/Clear buttons

Click the scope dropdown to view different statistics:
- **Current Session**: Tokens used in active session
- **Project**: Total tokens across all project sessions  
- **Global**: Lifetime token usage across all projects

### ⚙️ **Advanced Configuration**

#### API Provider Setup
1. Open Settings (⚙️ icon)
2. Add Provider with:
   - **Name**: Display name (e.g., "My OpenAI")
   - **Base URL**: API endpoint
   - **API Key**: Your authentication key
   - **Adapter**: Provider type (Anthropic/OpenAI/Groq/Moonshot)

#### Proxy Configuration
For corporate networks:
1. Open Settings → General
2. Set HTTP(S) Proxy URL
3. Format: `http://proxy.company.com:8080`

#### Model Switching
- Use the dropdown in the main header to switch models
- Changes apply immediately to new requests
- Previous conversation history is preserved

## 🔍 **Troubleshooting**

### Common Issues

#### "Electron uninstall" Error
If you see this error when running `yarn dev`:
```bash
# Clean and rebuild
rm -rf node_modules package-lock.json
yarn config set registry https://registry.npmmirror.com/   
yarn 
yarn rebuild electron
```

#### Terminal Not Connecting
1. Check if `claude-code` is properly installed
2. Verify API keys in Settings
3. Check network connectivity
4. Try the browser demo mode for UI testing

#### Build Failures
```bash
# Clean build cache
yarn clean
yarn config set registry https://registry.npmmirror.com/   
ELECTRON_MIRROR=https://npmmirror.com/mirrors/electron/ yarn install
yarn build
```

### Browser Demo Mode

If Electron issues persist, use browser mode:
```bash
yarn dev
# Open http://localhost:5173
```

The browser demo provides:
- Full UI functionality
- Interactive terminal simulator
- All project/session management features
- Settings configuration (stored in localStorage)

### Getting Help

1. **Check Issues**: [GitHub Issues](https://github.com/yangkui/cc-copilot/issues)
2. **Documentation**: See `DEVELOPMENT_README.md` for technical details
3. **Create Issue**: Report bugs or request features

## 🤝 Contributing

We welcome contributions! Please see our [Contributing Guidelines](CONTRIBUTING.md) for details.

### Development Setup
```bash
git clone https://github.com/yangkui/cc-copilot.git
cd cc-copilot
ELECTRON_MIRROR=https://npmmirror.com/mirrors/electron/ yarn
yarn dev
```

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- **Anthropic** for the amazing `claude-code` tool
- **Electron** community for the desktop framework
- **xterm.js** for terminal emulation
- All contributors and testers

---

**Built with ❤️ for the developer community**
