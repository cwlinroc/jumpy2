# Jumpy2 Copilot Instructions

This document provides guidance for AI coding agents working on the Jumpy2 codebase.

## Project Overview

Jumpy2 is a VS Code extension that provides keyboard-first navigation by creating dynamic hotkeys to jump to words in visible editors. It's designed to work well with Vim extensions.

The core of the extension is a state machine that manages the "jump mode". When activated, it identifies all possible jump targets (words) in the visible editors, assigns them two-character labels, and displays these labels as decorations. The user types the two characters to jump to the desired location.

## Architecture

### Core Components

- **`src/extension.ts`**: The main entry point for the VS Code extension. It handles:
    - Activation and deactivation.
    - Command registration (including dynamic generation of commands for each key).
    - Event listeners for editor and window state changes to exit jump mode.
    - Integration with the state machine and labelers.

- **`src/state-machine.ts`**: A TypeScript class (`JumpStateMachine`) that manages the state of the extension (active, inactive, keys entered). It replaces a previous Elm-based implementation. It receives key presses, matches them against labels, and emits events for state changes or successful jumps.

- **Labeling System**:
    - **`src/labelers/words.ts`**: Contains the logic (`getWordLabels`) to find jump targets in an editor using a regular expression defined in the settings (`jumpy2.wordPattern`).
    - **`src/labelers/wordDecorations.ts`**: Defines the `TextEditorDecorationType` for the labels, controlling their appearance (colors, borders, etc.). It supports a "checkered" mode for alternating label styles.
    - **`src/labelers/wordBeacons.ts`**: Manages the animation effect that appears at the jump destination.
    - **`src/label-interface.ts`**: Defines the TypeScript interfaces for labels (`Label`) and the environment (`LabelEnvironment`) they are created in.

### Data Flow

1.  User triggers the `jumpy2.toggle` command (e.g., via `Shift+Enter`).
2.  `extension.ts`'s `toggle` function calls `enterJumpMode`.
3.  `enterJumpMode` calls `_renderLabels`.
4.  `_renderLabels` iterates through visible editors, calling `getWordLabels` for each.
5.  `getWordLabels` uses the configured regex to find all matching words and creates `Label` objects for them.
6.  The labels are rendered as decorations in the editor.
7.  The list of all label key strings is loaded into the `JumpStateMachine`.
8.  As the user types, `sendKey` calls `stateMachine.keyEntered`.
9.  The `stateMachine` updates its internal state. It emits `onValidKeyEntered` to filter the visible labels.
10. On a successful two-key match, it emits `onLabelJumped`.
11. The `onLabelJumped` handler in `extension.ts` finds the corresponding `Label` object and calls its `jump()` method to move the cursor.
12. The state machine becomes inactive, and `_exit` cleans up the decorations.

## Development Workflow

### Build

-   **For development**: `npm run esbuild-watch` or `npm run watch`. This provides a fast, continuous build with sourcemaps.
-   **Full build for testing**: `npm run compile` runs type checking, linting, and esbuild.
-   **Production build**: `npm run vscode:prepublish` creates a minified build.

### Testing

-   Run tests with `npm run test`. This will compile the code first.
-   Tests are located in `src/test/suite/`.
-   Fixtures are in `src/test/fixtures/`.
-   The tests use VS Code's test framework (`@vscode/test-electron`).

## Key Conventions

-   **State Management**: All state related to jump mode is managed by the `JumpStateMachine`. Avoid introducing state elsewhere. The state machine is driven by events and communicates back via callbacks.
-   **Dynamic Commands**: Commands for individual keys (`jumpy2.a`, `jumpy2.b`, etc.) are generated dynamically in `activate()` based on the configured character set.
-   **Configuration**: The extension is configured via `package.json` (`contributes.configuration`) and accessed in code using `workspace.getConfiguration('jumpy2')`.
-   **Debouncing**: The exit logic (`_exit`) is debounced (`_exitDebounced`) to prevent flickering or premature exits when multiple editor events fire in quick succession.
-   **Styling**: Label styles are controlled by themeable colors defined in `package.json` (`contributes.colors`) and applied in `src/labelers/wordDecorations.ts`.
