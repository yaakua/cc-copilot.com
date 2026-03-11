# CC Copilot Next

[English](./README.md) | [中文](./README.zh-CN.md)

CC Copilot Next is a Tauri desktop workspace for CLI coding agents. It gives `Codex CLI` and `Claude Code` a visual, multi-session interface so you can manage projects, compare runs, and work across multiple panes without treating the terminal as the primary UI.

## Core Features

- Multi-project workspace with a sidebar for project and session management
- Up to 4 panes for parallel agent runs, side-by-side comparison, and split-session workflows
- Unified composer for sending prompts into the active pane while keeping the workspace centered on conversations
- Dual provider support for `Codex CLI` and `Claude Code`
- Per-pane provider profiles for official login, system runtime, or API-key based gateway setups
- Streaming conversation timeline with status events, tool output rendering, retry, and cancel controls
- Local persistence for projects, sessions, panes, messages, and drafts
- Secure secret handling through the system keychain instead of storing API keys in app state

## Who It's For

CC Copilot Next is primarily built for:

- Developers who already use `Codex CLI` or `Claude Code` heavily
- Power users who want to compare multiple agent runs or accounts in parallel
- Individuals or teams that prefer a desktop workspace over a terminal-first agent workflow
- Users who need project-scoped session history and quick switching between active coding threads

## How It Works

- Organize work by project, then create sessions under each project
- Open a session in the main pane or split it into additional panes
- Bind each pane to a provider and provider profile
- Send prompts through the shared composer and watch streamed output in the timeline
- Persist workspace state locally so the app can restore context across launches

## Current Product Scope

Today the repository is focused on the local desktop experience:

- Tauri 2 host for system integration and persistence
- React + TypeScript frontend for the visual workspace
- Real CLI-backed execution for `Codex CLI` and `Claude Code`
- Profile management for official and third-party gateway configurations

Remote/mobile access appears in the codebase, but it should currently be treated as future-facing work rather than a primary supported workflow.

## Tech Stack

- `Tauri 2`
- `React 19`
- `TypeScript`
- `Vite`
- `Tailwind CSS`

## Development

```bash
npm install
npm run dev
```

Run the web-only frontend dev server:

```bash
npm run dev:web
```

## Build

Build the frontend only:

```bash
npm run build:web
```

Build the macOS desktop app:

```bash
npm run build:mac
```

Build the Windows desktop app on Windows hosts:

```bash
npm run build:win
```

## Platform Support

- macOS: supported and verified in this repository
- Windows: build script is present and intended to work on Windows hosts
- Linux: intentionally unsupported

## Recommended IDE Setup

- [VS Code](https://code.visualstudio.com/)
- [Tauri VS Code extension](https://marketplace.visualstudio.com/items?itemName=tauri-apps.tauri-vscode)
- [rust-analyzer](https://marketplace.visualstudio.com/items?itemName=rust-lang.rust-analyzer)

## Roadmap

Potential next product directions include:

- Better remote/mobile access workflows
- Deeper provider account inspection and management
- Richer workspace views beyond the current conversation-focused panes
