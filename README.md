# CC Copilot Next

Tauri 2 desktop workspace for Claude Code and Codex. The app replaces terminal-first UX with:

- project and session management in the left sidebar
- up to four panes for the active project
- a unified composer that can target the active pane, selected panes, or all open panes
- a remote panel for password-protected phone access over an `frpc` tunnel

## Development

```bash
npm install
npm run tauri:dev
```

## Build

```bash
npm run build:web
npm run build:mac
```

On Windows hosts:

```bash
npm run build:win
```

Linux is intentionally unsupported in this repository.

## Recommended IDE Setup

- [VS Code](https://code.visualstudio.com/) + [Tauri](https://marketplace.visualstudio.com/items?itemName=tauri-apps.tauri-vscode) + [rust-analyzer](https://marketplace.visualstudio.com/items?itemName=rust-lang.rust-analyzer)
