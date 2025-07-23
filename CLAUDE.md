# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

cc-copilot is a cross-platform desktop application that provides a GUI wrapper for `@anthropic-ai/claude-code`. This project aims to enhance the claude-code experience with features like project-based organization, multi-provider API support, dynamic model switching, and usage analytics.

## Architecture

The application is built using Electron, with a main process and a renderer process.

**Main Process (Node.js - `src/main/`)**
- `main.ts`: Entry point for the main process. Initializes the application, creates the main window, and sets up IPC handlers.
- `session-manager.ts`: Manages project and session data. Handles loading, creating, deleting, and activating sessions. It is responsible for reading and writing to `.claude/sessions.jsonl` and individual session log files.
- `claude-path-manager.ts`: Manages Claude CLI path detection and caching. Detects the installation and version of the Claude CLI tool using multiple methods including direct file system checks and PATH expansion.
- `pty-manager.ts`: Manages pseudoterminals (pty) for running the Claude CLI in sessions.
- `proxy.ts`: (Future implementation) Will handle API requests and responses.
- `logger.ts`: Configures the application's logging system (using `electron-log`).
- `settings.ts`: Manages application settings.

**Preload Script (`src/preload/`)**
- `preload.ts`: A script that runs in a privileged context and exposes a controlled set of APIs from the main process to the renderer process via the `contextBridge`.
- `index.d.ts`: TypeScript declaration file defining the types for the exposed APIs (`window.api`).

**Renderer Process (React - `src/renderer/`)**
- `App.tsx`: The main React component that orchestrates the entire UI.
- `components/`: Contains various React components for different parts of the UI (e.g., `SessionList`, `TabManager`, `StatusBar`).
- `utils/logger.ts`: A wrapper for the logger API exposed from the preload script.

**Shared Code (`src/shared/`)**
- `types.ts`: Contains shared TypeScript types (like `Project`, `Session`) used across the main, preload, and renderer processes to ensure type safety and consistency.

## Data Flow and State Management

1.  **Initialization**: On startup, `SessionManager` in the main process reads the `.claude/` directory to discover projects and sessions.
2.  **Data Loading**: `SessionManager` reads `sessions.jsonl` to get the metadata for all sessions. It then constructs the `Project` and `Session` objects.
3.  **IPC Communication**: The renderer process (`App.tsx`) requests all projects from the main process using `window.api.getAllProjects()`.
4.  **UI Rendering**: The renderer process receives the project and session data and renders the UI.
5.  **Real-time Updates**: The main process uses `webContents.send()` to push real-time updates to the renderer for events like:
    *   `session:created`
    *   `session:updated`
    *   `session:deleted`
    *   `project:created`
    *   `terminal:closed`
    *   `claude:detection-result`
6.  **State Management in Renderer**: The `App.tsx` component manages the application's state using React's `useState` and `useEffect` hooks. It listens for IPC events to keep its state synchronized with the main process.

## Session and Project Loading Logic

A key aspect of the current architecture is how historical session data is loaded and displayed.

-   **Project Discovery**: Projects are implicitly defined by the `cwd` (current working directory) property within each session's entry in `.claude/sessions.jsonl`. The `SessionManager` groups sessions by their `cwd` to form projects.
-   **Session Information**: To provide more meaningful information in the UI, the loading process involves:
    1.  Reading the main `sessions.jsonl` file to get the list of all sessions and their `cwd`.
    2.  For each session, the main process needs to read the corresponding session log file (e.g., `~/.claude/sessions/1720496375853.jsonl`).
    3.  From the session log, we can extract:
        *   The initial prompt or command, which can be used as the session's display name.
        *   The timestamp of the last message, to show when the session was last active.
-   **New Session Creation**: When a new session is created, it is always associated with a project's directory (`cwd`). This ensures that all work is organized.

This approach allows the UI to present a rich, organized view of the user's history without requiring a formal database, by leveraging the data already stored by the Claude CLI tool.