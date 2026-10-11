import assert from 'assert';
import { readFileSync } from 'fs';
import path from 'path';
import { runInNewContext } from 'vm';
import { ModuleKind, ScriptTarget, transpileModule } from 'typescript';
import { JumpStateMachine } from '../../state-machine';

type Handler = (...args: unknown[]) => unknown;

function createHarness() {
    const commandHandlers = new Map<string, Handler>();
    const eventHandlers = new Map<string, Handler>();
    const contexts = new Map<string, unknown>();
    const jumps: string[] = [];
    const baseDecoration = {};
    const checkeredDecoration = {};
    const editors = ['left', 'right'].map((name) => ({
        name,
        decorations: new Map<unknown, { keyLabel: string }[]>(),
        setDecorations(type: unknown, decorations: { keyLabel: string }[]) {
            this.decorations.set(type, decorations);
        },
    }));
    type Editor = typeof editors[number];
    const machines: JumpStateMachine[] = [];
    let generationCount = 0;
    let emptyLabels = false;
    class TestStateMachine extends JumpStateMachine {
        constructor() {
            super();
            machines.push(this);
        }
    }
    const window: Record<string, unknown> & { activeTextEditor: Editor | undefined; visibleTextEditors: Editor[] } = {
        activeTextEditor: editors[1],
        visibleTextEditors: editors,
    };
    for (const name of [
        'onDidChangeActiveTerminal', 'onDidChangeActiveTextEditor',
        'onDidChangeTextEditorOptions', 'onDidChangeTextEditorViewColumn',
        'onDidChangeVisibleTextEditors', 'onDidChangeWindowState',
        'onDidCloseTerminal', 'onDidOpenTerminal',
        'onDidChangeTextEditorSelection', 'onDidChangeTextEditorVisibleRanges',
    ]) {
        window[name] = (callback: Handler) => {
            eventHandlers.set(name, callback);
            return { dispose() {} };
        };
    }
    const settings: Record<string, unknown> = {
        wordPattern: '[a-z]+', customKeys: 'ab', lineNumberJump: false,
        optimizeEnd: false, 'checkered.active': false,
    };
    const workspace = {
        getConfiguration: () => ({ get: (key: string) => settings[key] }),
        onDidOpenTextDocument: (callback: Handler) => {
            eventHandlers.set('onDidOpenTextDocument', callback);
            return { dispose() {} };
        },
    };
    const commands = {
        registerCommand: (name: string, callback: Handler) => {
            commandHandlers.set(name, callback);
            return { dispose() {} };
        },
        executeCommand: async (name: string, ...args: unknown[]) => {
            if (name === 'setContext') {
                contexts.set(args[0] as string, args[1]);
                return;
            }
            return commandHandlers.get(name)?.(...args);
        },
    };
    const dependencies: Record<string, unknown> = {
        vscode: { window, workspace, commands },
        './state-machine': { JumpStateMachine: TestStateMachine },
        './labelers/words': {
            getWordLabels: (env: { keys: string[]; activeEditor?: Editor }, editor: Editor) => {
                generationCount++;
                assert.strictEqual(env.activeEditor, window.activeTextEditor);
                if (emptyLabels) { return []; }
                return [0, 1].map(() => {
                    const keyLabel = env.keys.shift()!;
                    return {
                        keyLabel, textEditor: editor,
                        getDecoration: () => ({ keyLabel }),
                        jump: () => jumps.push(editor.name),
                        animateBeacon() {},
                    };
                });
            },
        },
        './labelers/wordDecorations': {
            wordLabelBaseDecorationType: baseDecoration,
            wordLabelCheckeredDecorationType: checkeredDecoration,
        },
        './keys': {
            getKeySet: () => ['aa', 'ab', 'ba', 'bb'],
            getAllKeys: () => ({ lowerCharacters: ['a', 'b'], upperCharacters: ['A', 'B'] }),
        },
    };
    // Exercise the real wiring with deterministic events, without changing OS focus.
    const source = readFileSync(path.resolve(__dirname, '../../../src/extension.ts'), 'utf8');
    const code = transpileModule(source, {
        compilerOptions: { module: ModuleKind.CommonJS, target: ScriptTarget.ES2022 },
    }).outputText;
    const extension: { activate(context: unknown): void; deactivate(): void } = {
        activate() {}, deactivate() {},
    };
    runInNewContext(code, {
        exports: extension,
        require: (name: string) => {
            assert.ok(name in dependencies, `Unexpected import: ${name}`);
            return dependencies[name];
        },
        // Freeze any legacy throttle timer so rapid-exit tests remain deterministic.
        setTimeout: () => 0,
    });
    extension.activate({
        globalState: { setKeysForSync() {}, get: () => '0.0.1' },
        subscriptions: [], extension: { packageJSON: { version: '0.0.1' } },
    });
    return {
        window, editors, machine: machines[0], jumps,
        run: (command: string) => commands.executeCommand(`jumpy2.${command}`),
        fire: (event: string, payload?: unknown) => eventHandlers.get(event)!(payload),
        isContextActive: () => contexts.get('jumpy2.jump-mode') === true,
        labels: (editor: Editor) => editor.decorations.get(baseDecoration) ?? [],
        generationCount: () => generationCount,
        emptyLabels: () => { emptyLabels = true; },
        deactivate: () => extension.deactivate(),
    };
}

suite('Extension lifecycle regression suite', () => {
    test('allocates first labels to the focused editor and still jumps across panes', async () => {
        const h = createHarness();
        await h.run('toggle');
        assert.strictEqual(h.labels(h.editors[1])[0].keyLabel, 'aa');
        assert.strictEqual(h.labels(h.editors[0])[0].keyLabel, 'ba');
        await h.run('b');
        await h.run('a');
        assert.deepStrictEqual(h.jumps, ['left']);
        assert.strictEqual(h.isContextActive(), false);
    });

    test('filtering and resetting reuse the original label mapping', async () => {
        const h = createHarness();
        await h.run('toggle');
        await h.run('a');
        assert.strictEqual(h.labels(h.editors[0]).length, 0);
        await h.run('reset');
        assert.strictEqual(h.labels(h.editors[0])[0].keyLabel, 'ba');
        assert.strictEqual(h.generationCount(), 2);
    });

    test('focus loss cancels state and re-entry discards the old prefix', async () => {
        const h = createHarness();
        await h.run('toggle');
        await h.run('a');
        h.fire('onDidChangeWindowState', { focused: false, active: true });
        assert.strictEqual(h.machine.isActive(), false);
        assert.strictEqual(h.isContextActive(), false);
        assert.ok(h.editors.every((editor) => h.labels(editor).length === 0));
        await h.run('b');
        assert.deepStrictEqual(h.jumps, []);
        await h.run('toggle');
        await h.run('b');
        assert.strictEqual(h.machine.getState().keysEntered, 'b');
        assert.deepStrictEqual(h.jumps, []);
    });

    test('focus gain and idle notifications preserve an active session', async () => {
        const h = createHarness();
        await h.run('toggle');
        await h.run('a');
        h.fire('onDidChangeWindowState', { focused: true, active: false });
        h.fire('onDidChangeWindowState', { focused: true, active: true });
        assert.strictEqual(h.machine.getState().keysEntered, 'a');
        assert.strictEqual(h.isContextActive(), true);
    });

    test('rapid successive jumps always disable jump-mode keybindings', async () => {
        const h = createHarness();
        for (let i = 0; i < 2; i++) {
            await h.run('toggle');
            await h.run('a');
            await h.run('a');
            assert.strictEqual(h.machine.isActive(), false);
            assert.strictEqual(h.isContextActive(), false);
            assert.ok(h.editors.every((editor) => h.labels(editor).length === 0));
        }
        assert.deepStrictEqual(h.jumps, ['right', 'right']);
    });

    test('changing editor or viewport cancels the entire session', async () => {
        const h = createHarness();
        for (const event of ['onDidChangeActiveTextEditor', 'onDidChangeTextEditorSelection', 'onDidChangeTextEditorVisibleRanges']) {
            await h.run('toggle');
            await h.run('a');
            h.fire(event, { textEditor: h.editors[1] });
            assert.strictEqual(h.machine.isActive(), false);
            assert.strictEqual(h.machine.getState().keysEntered, '');
            assert.strictEqual(h.isContextActive(), false);
        }
    });

    test('reset after exit does not resurrect labels', async () => {
        const h = createHarness();
        await h.run('toggle');
        await h.run('exit');
        await h.run('reset');
        assert.ok(h.editors.every((editor) => h.labels(editor).length === 0));
        assert.strictEqual(h.isContextActive(), false);
    });

    test('does not enter jump mode without an editor or labels', async () => {
        const h = createHarness();
        h.window.activeTextEditor = undefined;
        await h.run('toggle');
        assert.strictEqual(h.machine.isActive(), false);
        assert.strictEqual(h.isContextActive(), false);
        h.window.activeTextEditor = h.editors[1];
        h.emptyLabels();
        await h.run('toggle');
        assert.strictEqual(h.machine.isActive(), false);
        assert.strictEqual(h.isContextActive(), false);
    });

    test('deactivation cancels an active session', async () => {
        const h = createHarness();
        await h.run('toggle');
        h.deactivate();
        assert.strictEqual(h.machine.isActive(), false);
        assert.strictEqual(h.isContextActive(), false);
    });
});
