import path from 'path';
import assert from 'assert';
import { after, afterEach, before, beforeEach } from 'mocha';

import { commands, ConfigurationTarget, Selection, Position, Uri, window, workspace } from 'vscode';
import { getWordLabels } from '../../labelers/words';
import { getKeySet } from '../../keys';
import { LabelEnvironment } from '../../label-interface';

const ONE_MIN = 60000;
const QUARTER_SECOND = 250;

async function wait(timeout = QUARTER_SECOND): Promise<void> {
    await new Promise((res) => setTimeout(res, timeout));
}

const fixtureFile = path.resolve(
    __dirname,
    '../../../src/test/fixtures/test_text.md'
);

suite('Multiple editor test Suite', function () {
    this.timeout(ONE_MIN);
    before(async function () {
        window.showInformationMessage('Start multiple editor tests.');

        await commands.executeCommand('workbench.action.zoomReset');
        await commands.executeCommand('workbench.action.zoomOut');
        await commands.executeCommand('workbench.action.zoomOut');
        await commands.executeCommand('workbench.action.zoomOut');

        const uri = Uri.file(fixtureFile);
        await commands.executeCommand('vscode.open', uri);

        // NOTE: ******************** split editor right for these tests!
        await commands.executeCommand('workbench.action.splitEditorRight');

        await wait();
    });

    after(async () => {
        await commands.executeCommand('editor.unfoldAll');
        await commands.executeCommand('workbench.action.closeAllEditors');

        await commands.executeCommand('workbench.action.zoomIn');
        await commands.executeCommand('workbench.action.zoomIn');
        await commands.executeCommand('workbench.action.zoomIn');
    });

    beforeEach(async function () {
        await commands.executeCommand('jumpy2.exit');
        await commands.executeCommand('editor.unfoldAll');
        await wait();

        // Reset cursor position to 0,0?
        window.visibleTextEditors.forEach((editor) => {
            editor.selection = new Selection(0, 0, 0, 0);
        });

        await wait();
    });

    afterEach(async function () {
        await commands.executeCommand('jumpy2.exit');
    });

    test('First labels start in whichever split editor is focused', async function () {
        const editors = [...window.visibleTextEditors];
        assert.strictEqual(editors.length, 2);
        for (const editor of editors) {
            await window.showTextDocument(editor.document, { viewColumn: editor.viewColumn, preview: false });
            editor.selection = new Selection(1, 1, 1, 1);
            await wait();

            await commands.executeCommand('jumpy2.toggle');
            await commands.executeCommand('jumpy2.a');
            await commands.executeCommand('jumpy2.a');
            await wait();

            assert.strictEqual(window.activeTextEditor, editor);
            assert.deepStrictEqual(editor.selection.active, new Position(0, 0));
        }
    });

    test('Toggle and jump across editors', async function () {
        const startingEditor = window.activeTextEditor;
        const targetEditor = window.visibleTextEditors.find((editor) => editor !== startingEditor);
        assert.ok(startingEditor);
        assert.ok(targetEditor);

        await commands.executeCommand('jumpy2.toggle');
        await commands.executeCommand('jumpy2.a');
        await commands.executeCommand('jumpy2.z');

        await wait();

        assert.strictEqual(window.activeTextEditor, startingEditor);
        assert.deepStrictEqual(startingEditor.selection.active, new Position(4, 15));

        // Derive a target label from the real viewport rather than assuming a fixed pane size.
        const config = workspace.getConfiguration('jumpy2');
        const customKeys = Array.from(config.get<string>('customKeys')!);
        const environment: LabelEnvironment = {
            keys: [...getKeySet(customKeys)],
            activeEditor: startingEditor,
            settings: {
                customKeys,
                wordsPattern: new RegExp(config.get<string>('wordPattern')!, 'g'),
                lineNumberJump: config.get<boolean>('lineNumberJump')!,
                optimizeEnd: config.get<boolean>('optimizeEnd')!,
            },
        };
        getWordLabels(environment, startingEditor);
        const targetLabel = getWordLabels(environment, targetEditor)[0];
        assert.ok(targetLabel);
        const targetPosition = targetLabel.getDecoration().range.start;

        await commands.executeCommand('jumpy2.toggle');
        for (const key of targetLabel.keyLabel) {
            await commands.executeCommand(`jumpy2.${key}`);
        }

        await wait();

        assert.strictEqual(window.activeTextEditor, targetEditor);
        assert.deepStrictEqual(targetEditor.selection.active, targetPosition);
    });

    test('Switching panes cancels a partial label before restarting', async function () {
        const startingEditor = window.activeTextEditor;
        const targetEditor = window.visibleTextEditors.find((editor) => editor !== startingEditor);
        assert.ok(startingEditor);
        assert.ok(targetEditor);
        targetEditor.selection = new Selection(1, 1, 1, 1);
        await wait();

        await commands.executeCommand('jumpy2.toggle');
        await commands.executeCommand('jumpy2.a');
        await window.showTextDocument(targetEditor.document, { viewColumn: targetEditor.viewColumn, preview: false });
        await wait();

        // Direct key commands must be ignored after cancellation, not complete the old prefix.
        await commands.executeCommand('jumpy2.a');
        await wait();
        assert.strictEqual(window.activeTextEditor, targetEditor);
        assert.deepStrictEqual(targetEditor.selection.active, new Position(1, 1));

        await commands.executeCommand('jumpy2.toggle');
        await commands.executeCommand('jumpy2.a');
        await commands.executeCommand('jumpy2.a');
        await wait();
        assert.strictEqual(window.activeTextEditor, targetEditor);
        assert.deepStrictEqual(targetEditor.selection.active, new Position(0, 0));
    });

    test('Selection mode preserves the focused editor selection anchor', async function () {
        const editor = window.activeTextEditor;
        assert.ok(editor);
        editor.selection = new Selection(1, 1, 1, 1);
        await wait();

        await commands.executeCommand('jumpy2.toggleSelection');
        await commands.executeCommand('jumpy2.a');
        await commands.executeCommand('jumpy2.a');
        await wait();
        assert.strictEqual(window.activeTextEditor, editor);
        assert.deepStrictEqual(editor.selection.anchor, new Position(1, 1));
        assert.deepStrictEqual(editor.selection.active, new Position(0, 0));
    });

    test('Line-number jumps stay in the focused split editor', async function () {
        const config = workspace.getConfiguration('jumpy2');
        const previousValue = config.inspect<boolean>('lineNumberJump')?.globalValue;
        try {
            await config.update('lineNumberJump', true, ConfigurationTarget.Global);
            for (const editor of [...window.visibleTextEditors]) {
                await window.showTextDocument(editor.document, { viewColumn: editor.viewColumn, preview: false });
                await wait();
                await commands.executeCommand('jumpy2.toggle');
                await commands.executeCommand('jumpy2.0');
                await commands.executeCommand('jumpy2.5');
                await wait();
                assert.strictEqual(window.activeTextEditor, editor);
                assert.deepStrictEqual(editor.selection.active, new Position(4, 0));
            }
        } finally {
            await commands.executeCommand('jumpy2.exit');
            await config.update('lineNumberJump', previousValue, ConfigurationTarget.Global);
        }
    });
});
