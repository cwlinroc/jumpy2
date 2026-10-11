import {
    commands,
    DecorationOptions,
    ExtensionContext,
    TextEditor,
    window,
    workspace,
} from 'vscode';
// import TelemetryReporter from '@vscode/extension-telemetry';

import { JumpStateMachine } from './state-machine';
import { LabelEnvironment, Label, Settings } from './label-interface';
import { getWordLabels } from './labelers/words';
import {
    wordLabelBaseDecorationType,
    wordLabelCheckeredDecorationType,
} from './labelers/wordDecorations';
import { getKeySet, getAllKeys } from './keys';
// import { achievements, achievementsWebview } from './achievements';
// import { updatesWebview } from './updated';

// let reporter: TelemetryReporter; // Instantiated on activation
const previousVersionKey = 'previousVersion';

const stateMachine = new JumpStateMachine();

const getSettings = (): Settings => {
    return {
        // Intentionally not using "pattern" type although it does exist.
        // It didn't facilitate adding in a regex when I tried,
        // and forced the user to leave the settings UI.kw
        wordsPattern: new RegExp(
            <string | undefined>(
                workspace.getConfiguration('jumpy2').get('wordPattern')
            ) || '',
            'g'
        ),
        customKeys: Array.from(
            <string>workspace.getConfiguration('jumpy2').get('customKeys')
        ),
        lineNumberJump: <boolean>(
            <boolean | undefined>(workspace.getConfiguration('jumpy2').get('lineNumberJump')) || false
        ),
        optimizeEnd: <boolean>(
            <boolean | undefined>(workspace.getConfiguration('jumpy2').get('optimizeEnd')) || false
        ),
    };
};

let allLabels: Array<Label> = new Array<Label>();
let sessionEditors: TextEditor[] = [];
let checkeredActive = false;
let isSelectionMode: boolean = false;

// Subscribe to state machine events:
stateMachine.onValidKeyEntered((keyLabel: string) => {
    if (stateMachine.isActive()) {
        _renderLabels(keyLabel);
    }
});

stateMachine.onLabelJumped((keyLabel: string) => {
    const foundLabel = allLabels.find((label) => label.keyLabel === keyLabel);
    if (foundLabel) {
        foundLabel.jump(isSelectionMode);
        foundLabel.animateBeacon();
    }
});

stateMachine.onActiveChanged((model) => {
    if (!model.active) {
        _exit();
    }
});

function _renderLabels(enteredKey?: string) {
    sessionEditors.forEach((editor) => {
        const baseDecorations: DecorationOptions[] = [];
        const checkeredDecorations: DecorationOptions[] = [];

        allLabels
            .filter((label) => label.textEditor === editor)
            .filter((label) =>
                enteredKey ? label.keyLabel.startsWith(enteredKey) : true
            )
            .forEach((label, index) => {
                const decoration = label.getDecoration();
                if (index % 2 === 0) {
                    baseDecorations.push(decoration);
                } else {
                    if (checkeredActive) {
                        checkeredDecorations.push(decoration);
                    } else {
                        baseDecorations.push(decoration);
                    }
                }
            });

        editor.setDecorations(wordLabelBaseDecorationType, baseDecorations);
        editor.setDecorations(
            wordLabelCheckeredDecorationType,
            checkeredDecorations
        );
    });
}

function enterJumpMode() {
    const activeEditor = window.activeTextEditor;
    if (!activeEditor) {
        exit();
        return;
    }

    _clearLabels();
    const settings = getSettings();
    const environment: LabelEnvironment = {
        keys: [...getKeySet(settings.customKeys)],
        settings,
        activeEditor,
    };
    // VS Code does not guarantee that visibleTextEditors starts with the focused editor.
    sessionEditors = [activeEditor, ...window.visibleTextEditors.filter((editor) => editor !== activeEditor)];
    // Keep this mapping stable while filtering/resetting a session's labels.
    allLabels = sessionEditors.flatMap((editor) => getWordLabels(environment, editor));
    checkeredActive = workspace.getConfiguration('jumpy2').get<boolean>('checkered.active') ?? false;
    if (allLabels.length === 0) {
        exit();
        return;
    }
    commands.executeCommand('setContext', 'jumpy2.jump-mode', true);
    stateMachine.loadLabels(allLabels.map((label) => label.keyLabel));
}

function toggle() {
    // reporter.sendTelemetryEvent('toggle-normal');
    isSelectionMode = false;
    enterJumpMode();
}

function toggleSelection() {
    // reporter.sendTelemetryEvent('toggle-selection');
    isSelectionMode = true;
    enterJumpMode();
}

function sendKey(key: string) {
    // reporter.sendTelemetryEvent('key-pressed', { 'jumpy.keypressed': key });
    stateMachine.keyEntered(key.charCodeAt(0));
}

function reset() {
    // reporter.sendTelemetryEvent('reset');
    stateMachine.reset();
}

function _clearLabels() {
    new Set([...sessionEditors, ...window.visibleTextEditors]).forEach((editor) => {
        editor.setDecorations(wordLabelBaseDecorationType, []);
        editor.setDecorations(wordLabelCheckeredDecorationType, []);
    });
}

function _exit() {
    commands.executeCommand('setContext', 'jumpy2.jump-mode', false);
    _clearLabels();
    // Do not discard allLabels here: the state machine emits inactive before the jump callback.
}

function cancelJumpMode() {
    if (stateMachine.isActive()) {
        exit();
    }
}

function exit() {
    // reporter.sendTelemetryEvent('exit-manual');
    stateMachine.exit();
}

export function activate(context: ExtensionContext) {
    context.globalState.setKeysForSync([previousVersionKey]);
    const { subscriptions } = context;
    subscriptions.push(
        wordLabelBaseDecorationType,
        wordLabelCheckeredDecorationType
    );
    const { registerCommand } = commands;
    const currentExtensionVersion = context.extension.packageJSON.version;
    // reporter = new TelemetryReporter(
    //     '618cee5c-79f0-46c5-a2ab-95f734e163ef' // app insights instrumentation key
    // );
    // subscriptions.push(reporter);

    // reporter.sendTelemetryEvent('activate', {
    //     'jumpy.settings': JSON.stringify(workspace.getConfiguration('jumpy2')),
    // });

    const previousVersion =
        context.globalState.get<string>(previousVersionKey) || '';
    if (isNotableUpdate(previousVersion, currentExtensionVersion)) {
        commands.executeCommand('jumpy2.showUpdates');
        // store latest version
        context.globalState.update(previousVersionKey, currentExtensionVersion);
        // reporter.sendTelemetryEvent('show-updates-triggered'); // implicitly has version from 'common'
    }

    subscriptions.push(
        registerCommand('jumpy2.toggle', toggle),
        registerCommand('jumpy2.toggleSelection', toggleSelection),
        registerCommand('jumpy2.reset', reset),
        registerCommand('jumpy2.exit', exit),
        registerCommand('jumpy2.showUpdates', showUpdates)
    );

    const allKeys = getAllKeys(getSettings().customKeys);
    subscriptions.push(
        ...[...allKeys.lowerCharacters, ...allKeys.upperCharacters].map((chr) =>
            registerCommand(`jumpy2.${chr}`, () => sendKey(chr))
        )
    );

    subscriptions.push(
        ...Array.from({ length: 10 }, (_, i) =>
            registerCommand(`jumpy2.${i}`, () => sendKey((i).toString()))
        ),
    );

    // Cancel both the UI and state machine when the editor layout changes.
    const events = [
        window.onDidChangeActiveTerminal,
        window.onDidChangeActiveTextEditor,
        window.onDidChangeTextEditorOptions,
        window.onDidChangeTextEditorViewColumn,
        window.onDidChangeVisibleTextEditors,
        window.onDidCloseTerminal,
        window.onDidOpenTerminal,
        workspace.onDidOpenTextDocument,
    ];

    subscriptions.push(
        ...events.map((event) => event(cancelJumpMode)),
        window.onDidChangeWindowState((state) => {
            // Activity/idle notifications and focus gain must not cancel a new session.
            if (!state.focused) {
                cancelJumpMode();
            }
        }),
        window.onDidChangeTextEditorSelection((event) => {
            if (sessionEditors.includes(event.textEditor)) {
                cancelJumpMode();
            }
        }),
        window.onDidChangeTextEditorVisibleRanges((event) => {
            if (sessionEditors.includes(event.textEditor)) {
                cancelJumpMode();
            }
        }),
    );
}

export function deactivate() {
    exit();
    // NOTE: subscriptions will automatically be disposed of
}

// Version check code and above with global accessor inspired by the following.
// https://stackoverflow.com/a/66307695/89682
// The extension's code: https://github.com/GorvGoyl/Shortcut-Menu-Bar-VSCode-Extension/blob/master/src/extension.ts.
// https://marketplace.visualstudio.com/items?itemName=jerrygoyal.shortcut-menu-bar (cool extension!)
function isNotableUpdate(previousVersion: string, currentVersion: string) {
    if (previousVersion.indexOf('.') === -1) {
        return true;
    }

    const [previousMajor, previousMinor] = previousVersion
        .split('.')
        .map(Number);
    const [currentMajor, currentMinor] = currentVersion
        .split('.')
        .map(Number);

    return currentMajor > previousMajor || currentMinor > previousMinor;
}

function showUpdates() {
    // reporter.sendTelemetryEvent('show-updates');

    // const panel = window.createWebviewPanel(
    //     'jumpy2Updates',
    //     'Jumpy2 Updates',
    //     ViewColumn.One,
    //     {
    //         enableScripts: false,
    //         retainContextWhenHidden: false, // technically probably not needed with enableScripts set to false, but leaving here in case + future proofing.
    //     }
    // );

    // panel.webview.html = updatesWebview();
}
