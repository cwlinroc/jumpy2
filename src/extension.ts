import {
    commands,
    DecorationOptions,
    ExtensionContext,
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
let isSelectionMode: boolean = false;

// Subscribe to state machine events:
stateMachine.onValidKeyEntered((keyLabel: string) => {
    // This also broadcasts some empty strings in some cases.  Fine to ignore them.
    if (keyLabel) {
        _clearLabels();
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
        _exitDebounced();
    }
});

function _renderLabels(enteredKey?: string) {
    // TODO: another refactor to handle any "labeler" would be necessary this func ^ is too word centric atm.  As opposed to the last iteration of the Atom architecture
    if (!getSettings().wordsPattern) {
        return;
    }

    const environment: LabelEnvironment = {
        keys: [...getKeySet(getSettings().customKeys)],
        settings: getSettings(),
    };

    allLabels.length = 0; // Clear the array from previous runs.

    window.visibleTextEditors.forEach((editor) => {
        // Atom architecture (copied here) allows for other label providers:
        const editorLabels = getWordLabels(environment, editor);
        allLabels = [...allLabels, ...editorLabels];

        const baseDecorations: DecorationOptions[] = [];
        const checkeredDecorations: DecorationOptions[] = [];

        editorLabels
            .filter((label) =>
                enteredKey ? label.keyLabel.startsWith(enteredKey) : true
            )
            .forEach((label, index) => {
                const decoration = label.getDecoration();
                if (index % 2 === 0) {
                    baseDecorations.push(decoration);
                } else {
                    if (workspace.getConfiguration('jumpy2').get('checkered.active')) {
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
    commands.executeCommand('setContext', 'jumpy2.jump-mode', true);

    _renderLabels();
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
    _clearLabels();
    _renderLabels();
}

function _clearLabels() {
    window.visibleTextEditors.forEach((editor) => {
        editor.setDecorations(wordLabelBaseDecorationType, []);
        editor.setDecorations(wordLabelCheckeredDecorationType, []);
    });
}

function _exit() {
    commands.executeCommand('setContext', 'jumpy2.jump-mode', false);
    _clearLabels();
}
const _exitDebounced = (() => {
    let blocked = false;
    return () => {
        if (blocked) { return; }
        blocked = true;
        _exit();
        setTimeout(() => { blocked = false; }, 350);
    };
})();

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

    /* NOTE: Effectively I want "all" events.  I don't think such an event exists,
    and even if it did it wouldn't be future proof. Luckily, things like command pallette,
    finds, etc...work nicely with jumpy atm, despite not clearing them.
    Instead, upon exit of these you can resume where Jumpy left off! */
    const events = [
        window.onDidChangeActiveTerminal,
        window.onDidChangeActiveTextEditor,
        window.onDidChangeTextEditorOptions,
        window.onDidChangeTextEditorViewColumn,
        window.onDidChangeVisibleTextEditors,
        window.onDidChangeWindowState,
        window.onDidCloseTerminal,
        window.onDidOpenTerminal,
        workspace.onDidOpenTextDocument,
        // The following are too aggressive, they make the keymapping troubleshooting feature useless as jumpy clears.
        // They also probably are responsible for some of the occasional "loading" clearing/exiting I was experiencing.  I think they would conflict with for example a job being streamed on terminal
        window.onDidChangeTextEditorSelection, // need these for now unfortunately.  Comment them out if keymap troubleshooting is required
        window.onDidChangeTextEditorVisibleRanges,
        // workspace.onDidChangeTextDocument,
    ];

    subscriptions.push(...events.map((event) => event(() => _exitDebounced())));
}

export function deactivate() {
    _exit();
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
