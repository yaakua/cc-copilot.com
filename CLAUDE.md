# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

cc-copilot is a cross-platform desktop application that provides a GUI wrapper for `@anthropic-ai/claude-code`. This project aims to enhance the claude-code experience with features like project-based organization, multi-provider API support, dynamic model switching, and usage analytics.

## Architecture

This repository currently contains:

### Documentation & Prototypes
- `docs/index.html` - V2 prototype HTML mockup of the desktop application UI
- `docs/req.md` - Detailed technical specification document (in Chinese) outlining the complete development plan
- `README.md` - Project description and feature overview

### Planned Architecture (from technical specification)
The application will be built as an Electron app with:

**Main Process (Node.js):**
- Manages claude-code child processes
- Runs local proxy server (Express.js) for API routing
- Handles data persistence (electron-store)
- Manages IPC communication with renderer

**Renderer Process (Chromium):**
- React + TypeScript UI
- Tailwind CSS for styling
- xterm.js for terminal integration
- Zustand for state management

**Key Features:**
- Project-based session organization
- Dynamic model switching between API providers
- Local proxy for API adaptation and routing
- Token usage statistics (session/project/global scopes)
- Integrated terminal experience
- Cross-platform support (macOS/Windows)

## Current State

This is currently a planning/documentation repository. The actual implementation has not yet begun. The repository contains:

1. **UI Prototype** (`docs/index.html`) - Complete HTML/CSS/JS mockup of the intended user interface
2. **Technical Specification** (`docs/req.md`) - Comprehensive development roadmap with:
   - Technology stack (Electron, React, TypeScript, Tailwind CSS, xterm.js)
   - Detailed architecture design
   - Phase-by-phase implementation plan
   - Data models and API integration strategy

## Development Notes

When implementation begins, the project will likely:
- Use Electron + Vite + React + TypeScript as the foundation
- Implement a 5-phase development approach as outlined in `docs/req.md`
- Focus on claude-code integration through child process management
- Build a local proxy server for multi-provider API support

## Files to Reference

- `docs/req.md` - Complete technical specification and implementation roadmap
- `docs/index.html` - UI/UX reference prototype
- `README.md` - Project goals and feature overview