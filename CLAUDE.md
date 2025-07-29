# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Jumpy2 is a VS Code extension that creates dynamic hotkeys to jump around files across visible panes. It's a keyboard-first navigation tool that works well with vim extensions.

## Development Commands

### Build and Development

- `npm run compile` - Full build with type checking and linting
- `npm run esbuild` - Fast build with sourcemaps for development
- `npm run esbuild-watch` - Watch mode for continuous building
- `npm run watch` - Run both esbuild and TypeScript watch modes in parallel

### Testing and Quality

- `npm run test` - Run all tests (compiles first)
- `npm run test-no-compile` - Run tests without compiling
- `npm run lint` - Run ESLint on TypeScript files
- `npm run check-types` - TypeScript type checking without compilation

### Specialized Commands  

- `npm run vscode:prepublish` - Production build (minified)
- `npm run deploy` - Publish to VS Code marketplace

## Architecture

### Core Components

**State Management**: Uses a TypeScript state machine (`src/state-machine.ts`) for managing jump mode state and user input. The state machine handles key presses, label matching, and coordinates between active/inactive states.

**Label System**:

- `src/labelers/words.ts` - Core labeling logic that finds jump targets using regex patterns
- `src/labelers/wordDecorations.ts` - Visual styling for jump labels
- `src/labelers/wordBeacons.ts` - Animation effects when jumping
- `src/label-interface.ts` - TypeScript interfaces for the label system

**Extension Entry**: `src/extension.ts` is the main VS Code extension entry point that:

- Registers commands and keybindings for all alphabet characters
- Manages telemetry and user achievements
- Handles label rendering across visible editors
- Integrates with the TypeScript state machine via callback subscriptions

### Key Features

- **Dynamic keybinding generation**: Creates commands for all alphabet characters (a-z, A-Z) at runtime
- **Multi-editor support**: Works across all visible text editors simultaneously  
- **Checkered mode**: Alternates label colors to distinguish adjacent labels
- **Achievement system**: Tracks career jumps with milestone notifications
- **Regex-based targeting**: Configurable word patterns for jump target detection

### Configuration

The extension uses VS Code's configuration system with the `jumpy2` namespace. Key settings include:

- `customKeys` - Character set for labels
- `wordPattern` - Regex for finding jump targets  
- `checkered.active` - Enable alternating label colors
- `achievements.active` - Enable achievement notifications

### Testing

Tests are located in `src/test/suite/` and use VS Code's test framework. Test fixtures are in `src/test/fixtures/`.
