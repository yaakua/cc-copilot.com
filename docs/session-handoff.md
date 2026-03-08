# cc-copilot-next Session Handoff

Last updated: 2026-03-08

## Goal

Build a Tauri 2 desktop app that acts as a visual multi-project, multi-session workspace for CLI coding agents.

Target product shape:
- Left sidebar: project list and sessions.
- Main area: 1 to 4 panes.
- Default: 1 pane.
- 4 panes: `2 x 2`.
- Bottom composer: send to active pane, selected panes, or all panes.
- Providers: Claude Code and Codex CLI.
- Future: FRP-backed remote/mobile access.

The product should not expose raw terminal UI as the main interaction model.

## Current State

Repository:
- `/Users/yangkui/workspace/github/cc-copilot-next`

Stack:
- `Tauri 2`
- `React + TypeScript + Vite`
- Rust host for state, provider execution, persistence, and local system integration

Supported platforms:
- macOS: verified
- Windows: intended in project structure/scripts, not validated on this machine
- Linux: intentionally unsupported for now

## What Is Already Implemented

### 1. New standalone app

This is a separate project and does not depend on the original Electron codebase.

Main app entry points:
- `/Users/yangkui/workspace/github/cc-copilot-next/src/App.tsx`
- `/Users/yangkui/workspace/github/cc-copilot-next/src-tauri/src/lib.rs`

### 2. UI shell and workspace interaction

Implemented:
- Light desktop-client UI
- Sidebar for projects/sessions
- Pane workspace
- Main transcript/workstream area
- Bottom composer
- Default single pane
- Up to 4 panes

Pane layout behavior:
- 1 pane: single
- 2 panes: side by side
- 3 panes: top wide + bottom two
- 4 panes: `2 x 2`

Relevant frontend files:
- `/Users/yangkui/workspace/github/cc-copilot-next/src/App.tsx`
- `/Users/yangkui/workspace/github/cc-copilot-next/src/hooks/useDashboard.ts`
- `/Users/yangkui/workspace/github/cc-copilot-next/src/features/workspace/components/PaneGrid.tsx`
- `/Users/yangkui/workspace/github/cc-copilot-next/src/features/thread/components/ThreadTimeline.tsx`
- `/Users/yangkui/workspace/github/cc-copilot-next/src/styles.css`

### 3. Local persistence

App state persists to:
- `/Users/yangkui/.cc-copilot-next/dashboard-state.json`

Persisted:
- projects
- sessions
- panes
- messages
- drafts
- remote status
- provider health
- provider profile metadata

Storage code:
- `/Users/yangkui/workspace/github/cc-copilot-next/src-tauri/src/storage.rs`

### 4. Real provider execution

The app no longer uses only static frontend mocks.

Current provider execution:
- `Codex`: real CLI invocation
- `Claude`: real CLI invocation

Provider runtime code:
- `/Users/yangkui/workspace/github/cc-copilot-next/src-tauri/src/providers.rs`

Current streaming model:
- Real stdout event parsing, not fake text chunking
- `Codex` uses `codex exec --json`
- `Claude` uses `claude -p --verbose --output-format stream-json --include-partial-messages`

Important caveat:
- On this machine, `claude` is installed but currently not logged in.
- `codex` is installed and usable.

### 5. Provider health probing

At startup, the app probes local CLI availability and updates provider health.

This is used for:
- default provider choice
- readiness display in UI

Relevant code:
- `/Users/yangkui/workspace/github/cc-copilot-next/src-tauri/src/providers.rs`
- `/Users/yangkui/workspace/github/cc-copilot-next/src-tauri/src/state.rs`

### 6. Per-pane provider profiles

The app now has a profile model intended to support:
- one pane using one Codex account
- another pane using a different Codex account
- another pane using Claude official login or third-party gateway

Profile metadata fields:
- provider
- label
- base URL
- model
- api key present flag

Bound at:
- pane level
- session fallback level

Relevant backend model files:
- `/Users/yangkui/workspace/github/cc-copilot-next/src-tauri/src/models.rs`
- `/Users/yangkui/workspace/github/cc-copilot-next/src-tauri/src/store.rs`

### 7. Secret storage

Important: API keys are not supposed to be stored in JSON state.

Current design:
- profile metadata in `dashboard-state.json`
- API keys in system keychain via `keyring`

Secret store:
- `/Users/yangkui/workspace/github/cc-copilot-next/src-tauri/src/secret_store.rs`

Current keychain service name:
- `cc-copilot-next.provider-profile`

### 8. Frontend profile management UI

A frontend profile settings UI exists and shows:
- provider profiles
- pane assignment
- profile label badge on pane

Files:
- `/Users/yangkui/workspace/github/cc-copilot-next/src/features/provider/components/ProfileSettingsPanel.tsx`
- `/Users/yangkui/workspace/github/cc-copilot-next/src/features/provider/useProviderProfiles.ts`

Important caveat:
- This area was originally implemented with `localStorage`.
- It has been partially migrated to backend-backed profile persistence.
- The frontend must be finished so it uses the Tauri backend as the single source of truth.
- Do not leave both `localStorage` and backend persistence active long-term.

## Credential / Auth Behavior Design

Desired UX:

### Official provider accounts

Support these modes:
- Use existing local CLI login state directly
- Create a named profile that represents "system login"
- Offer "login/re-login" actions that launch provider-specific CLI auth flows

For official usage:
- Claude official: can use CLI login state when no custom base URL is provided
- Codex official: can use CLI login/config state when no custom profile is bound

### Third-party / gateway accounts

Support manual profile entry:
- Base URL
- API Key
- optional model
- label

This is the correct path for:
- OpenAI-compatible gateways
- Anthropic-compatible gateways
- proxy endpoints
- team/shared third-party accounts

## Important Implementation Notes

### 1. Pane identity matters more than session identity for streaming

This was changed intentionally.

Reason:
- multiple panes can share one session
- different panes may bind different profiles/accounts
- stream events must target the pane that initiated the run

So stream events should remain pane-scoped.

### 2. Do not put secrets into JSON

Keep this rule:
- metadata in JSON
- secrets in keychain

### 3. Codex and Claude profile handling are not identical

Codex:
- profile-specific execution should use isolated runtime config per run
- avoid mutating global `~/.codex/config.toml`
- current approach writes temporary per-profile config and injects env vars

Claude:
- official login state should be usable directly
- third-party gateway support is less universal than Codex
- when base URL is provided, current implementation uses gateway/foundry-style environment injection
- keep this as a pragmatic compatibility layer, not a claim of universal support

### 4. Avoid one giant file

Keep the code modular.

Frontend:
- state in hooks
- provider profile UI in dedicated components
- backend calls in `src/lib/backend.ts`
- normalization in `src/lib/normalize.ts`

Backend:
- models in `models.rs`
- store mutation logic in `store.rs`
- provider runtime in `providers.rs`
- secrets in `secret_store.rs`
- persistence in `storage.rs`
- state orchestration in `state.rs`

## What Was Verified

These commands passed during the current session:

- `cargo test`
- `npm run build:web`
- `npm run build:mac`

Latest verified macOS bundle:
- `/Users/yangkui/workspace/github/cc-copilot-next/src-tauri/target/release/bundle/macos/cc-copilot-next.app`

## What Is In Progress / Likely Incomplete

These areas need careful continuation:

### 1. Frontend profile UI migration

Need to complete migration away from frontend-only `localStorage` semantics.

Likely files to inspect first:
- `/Users/yangkui/workspace/github/cc-copilot-next/src/hooks/useDashboard.ts`
- `/Users/yangkui/workspace/github/cc-copilot-next/src/features/provider/useProviderProfiles.ts`
- `/Users/yangkui/workspace/github/cc-copilot-next/src/features/provider/components/ProfileSettingsPanel.tsx`
- `/Users/yangkui/workspace/github/cc-copilot-next/src/features/workspace/components/PaneGrid.tsx`
- `/Users/yangkui/workspace/github/cc-copilot-next/src/lib/backend.ts`
- `/Users/yangkui/workspace/github/cc-copilot-next/src/lib/normalize.ts`

Goal:
- use backend `providerProfiles`
- use backend profile save/delete/assign commands
- do not keep localStorage as authoritative state

### 2. Default/system-login profiles

Still needs productized handling:
- no-profile pane should use system CLI login/config
- explicit “system login” profile should be possible
- support login/re-login buttons for Codex and Claude

### 3. Connection testing

Need profile test actions:
- test current Codex profile
- test current Claude profile
- verify base URL + key before binding profile to production work

### 4. New session / new pane UX

Should allow:
- choose provider
- choose bound profile at creation time
- inherit profile from active pane/session when sensible

### 5. Remote / FRP

Still mostly placeholder:
- remote panel UI exists
- real `frpc` process management is not implemented yet
- mobile web access is not implemented yet

## Recommended Next Steps

When continuing in a new session, do this in order:

1. Finish frontend migration to backend-backed profile state.
2. Add profile connection test command in Rust and wire it to UI.
3. Add official login actions:
   - `Connect Claude`
   - `Connect Codex`
4. Add profile selection to:
   - create session
   - add pane
5. Add cancel/current-run control for each pane.
6. Then move on to real FRP integration.

## Useful File Index

Backend:
- `/Users/yangkui/workspace/github/cc-copilot-next/src-tauri/src/lib.rs`
- `/Users/yangkui/workspace/github/cc-copilot-next/src-tauri/src/models.rs`
- `/Users/yangkui/workspace/github/cc-copilot-next/src-tauri/src/store.rs`
- `/Users/yangkui/workspace/github/cc-copilot-next/src-tauri/src/state.rs`
- `/Users/yangkui/workspace/github/cc-copilot-next/src-tauri/src/providers.rs`
- `/Users/yangkui/workspace/github/cc-copilot-next/src-tauri/src/secret_store.rs`
- `/Users/yangkui/workspace/github/cc-copilot-next/src-tauri/src/storage.rs`
- `/Users/yangkui/workspace/github/cc-copilot-next/src-tauri/src/seeded.rs`

Frontend:
- `/Users/yangkui/workspace/github/cc-copilot-next/src/App.tsx`
- `/Users/yangkui/workspace/github/cc-copilot-next/src/hooks/useDashboard.ts`
- `/Users/yangkui/workspace/github/cc-copilot-next/src/lib/backend.ts`
- `/Users/yangkui/workspace/github/cc-copilot-next/src/lib/normalize.ts`
- `/Users/yangkui/workspace/github/cc-copilot-next/src/types/domain.ts`
- `/Users/yangkui/workspace/github/cc-copilot-next/src/features/provider/components/ProfileSettingsPanel.tsx`
- `/Users/yangkui/workspace/github/cc-copilot-next/src/features/provider/useProviderProfiles.ts`
- `/Users/yangkui/workspace/github/cc-copilot-next/src/features/workspace/components/PaneGrid.tsx`
- `/Users/yangkui/workspace/github/cc-copilot-next/src/features/thread/components/ThreadTimeline.tsx`
- `/Users/yangkui/workspace/github/cc-copilot-next/src/styles.css`
