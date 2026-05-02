import path from 'path';
import assert from 'assert';
import { after, afterEach, before, beforeEach } from 'mocha';

import { commands, Selection, Uri, window } from 'vscode';
import { getWordLabels } from '../../labelers/words';
import { LabelEnvironment, Settings } from '../../label-interface';

// TODO: this test does not do much , consider to write another test by hand to cover more scenarios

// WordLabel interface for testing
interface WordLabel {
    keyLabel: string;
    lineNumber: number;
    column: number;
}

const ONE_MIN = 60000;
const QUARTER_SECOND = 250;

async function wait(timeout = QUARTER_SECOND): Promise<void> {
    await new Promise((res) => setTimeout(res, timeout));
}

const fixtureFile = path.resolve(
    __dirname,
    '../../../src/test/fixtures/test_text.md'
);

suite('New Features Test Suite', function () {
    this.timeout(ONE_MIN);

    before(async function () {
        window.showInformationMessage('Start new features tests.');

        await commands.executeCommand('workbench.action.zoomReset');
        await commands.executeCommand('workbench.action.zoomOut');
        await commands.executeCommand('workbench.action.zoomOut');
        await commands.executeCommand('workbench.action.zoomOut');

        const uri = Uri.file(fixtureFile);
        await commands.executeCommand('vscode.open', uri);
        await wait();
    });

    after(async () => {
        await commands.executeCommand('editor.unfoldAll');
        await commands.executeCommand('workbench.action.closeAllEditors');
    });

    beforeEach(async function () {
        await commands.executeCommand('editor.unfoldAll');
        await wait();

        if (window.activeTextEditor) {
            window.activeTextEditor.selection = new Selection(0, 0, 0, 0);
        }

        await wait();
    });

    afterEach(async function () { });

    suite('LineNumberJump Feature - Unit Tests', function () {
        test('LineNumberJump enabled - should create line number labels', function () {
            if (!window.activeTextEditor) {
                throw new Error('No active editor');
            }

            const settings: Settings = {
                wordsPattern: /([A-Z]+([0-9a-z])*)|[a-z0-9]{2,}/g,
                customKeys: ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'j', 'k', 'l', 'm'],
                lineNumberJump: true,
                optimizeEnd: false
            };

            const environment: LabelEnvironment = {
                keys: [...settings.customKeys],
                settings
            };

            const labels = getWordLabels(environment, window.activeTextEditor) as unknown as WordLabel[];

            // Should have line number labels (two-digit format like "01", "02", etc.)
            const lineNumberLabels = labels.filter(label => /^\d{2}$/.test(label.keyLabel));
            assert.ok(lineNumberLabels.length > 0, 'Should create line number labels');

            // Line number labels should be at column 0
            lineNumberLabels.forEach(label => {
                assert.strictEqual(label.column, 0, 'Line number labels should be at column 0');
            });
        });

        test('LineNumberJump disabled - should not create line number labels', function () {
            if (!window.activeTextEditor) {
                throw new Error('No active editor');
            }

            const settings: Settings = {
                wordsPattern: /([A-Z]+([0-9a-z])*)|[a-z0-9]{2,}/g,
                customKeys: ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'j', 'k', 'l', 'm'],
                lineNumberJump: false,
                optimizeEnd: false
            };

            const environment: LabelEnvironment = {
                keys: [...settings.customKeys],
                settings
            };

            const labels = getWordLabels(environment, window.activeTextEditor) as unknown as WordLabel[];

            // Should not have line number labels
            const lineNumberLabels = labels.filter(label => /^\d{2}$/.test(label.keyLabel));
            assert.strictEqual(lineNumberLabels.length, 0, 'Should not create line number labels when disabled');
        });

        test('LineNumberJump should skip positions < 2', function () {
            if (!window.activeTextEditor) {
                throw new Error('No active editor');
            }

            const settings: Settings = {
                wordsPattern: /([A-Z]+([0-9a-z])*)|[a-z0-9]{2,}/g,
                customKeys: ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'j', 'k', 'l', 'm', 'n', 'o', 'p'],
                lineNumberJump: true,
                optimizeEnd: false
            };

            const environment: LabelEnvironment = {
                keys: [...settings.customKeys],
                settings
            };

            const labels = getWordLabels(environment, window.activeTextEditor) as unknown as WordLabel[];

            // Filter out line number labels to focus on word labels
            const wordLabels = labels.filter(label => !/^\d{2}$/.test(label.keyLabel));

            // All word labels should be at column >= 2 when lineNumberJump is enabled
            wordLabels.forEach(label => {
                assert.ok(label.column >= 2, `Word label at line ${label.lineNumber}, column ${label.column} should be at column >= 2`);
            });
        });
    });

    suite('OptimizeEnd Feature - Unit Tests', function () {
        test('OptimizeEnd enabled - should skip words within 3 characters of line end', function () {
            if (!window.activeTextEditor) {
                throw new Error('No active editor');
            }

            const settings: Settings = {
                wordsPattern: /([A-Z]+([0-9a-z])*)|[a-z0-9]{2,}/g,
                customKeys: ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'j', 'k', 'l', 'm', 'n', 'o', 'p'],
                lineNumberJump: false,
                optimizeEnd: true
            };

            const environment: LabelEnvironment = {
                keys: [...settings.customKeys],
                settings
            };

            const labels = getWordLabels(environment, window.activeTextEditor) as unknown as WordLabel[];

            // Check that no word labels are within 3 characters of line end
            const document = window.activeTextEditor.document;

            labels.forEach(label => {
                const line = document.lineAt(label.lineNumber);
                const lineLength = line.text.length;

                // If this is not an end-of-line label (column !== lineLength)
                if (label.column !== lineLength) {
                    const distanceFromEnd = lineLength - label.column;
                    assert.ok(distanceFromEnd >= 3,
                        `Word label at line ${label.lineNumber}, column ${label.column} should not be within 3 characters of line end (line length: ${lineLength})`);
                }
            });
        });

        test('OptimizeEnd enabled - should add end-of-line labels for non-empty lines', function () {
            if (!window.activeTextEditor) {
                throw new Error('No active editor');
            }

            const settings: Settings = {
                wordsPattern: /([A-Z]+([0-9a-z])*)|[a-z0-9]{2,}/g,
                customKeys: ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'j', 'k', 'l', 'm', 'n', 'o', 'p', 'q', 'r', 's', 't'],
                lineNumberJump: false,
                optimizeEnd: true
            };

            const environment: LabelEnvironment = {
                keys: [...settings.customKeys],
                settings
            };

            const labels = getWordLabels(environment, window.activeTextEditor) as unknown as WordLabel[];

            const document = window.activeTextEditor.document;
            const visibleRanges = window.activeTextEditor.visibleRanges;

            // Count end-of-line labels (labels at the end of non-empty lines)
            let endOfLineLabels = 0;

            visibleRanges.forEach(range => {
                for (let lineNum = range.start.line; lineNum <= range.end.line; lineNum++) {
                    const line = document.lineAt(lineNum);
                    if (line.text.trim().length > 0) {
                        // Check if there's a label at the end of this line
                        const labelAtEndOfLine = labels.find(label =>
                            label.lineNumber === lineNum && label.column === line.text.length
                        );
                        if (labelAtEndOfLine) {
                            endOfLineLabels++;
                        }
                    }
                }
            });

            assert.ok(endOfLineLabels > 0, 'Should create end-of-line labels for non-empty lines');
        });

        test('OptimizeEnd disabled - should include words near line end', function () {
            if (!window.activeTextEditor) {
                throw new Error('No active editor');
            }

            const settings: Settings = {
                wordsPattern: /([A-Z]+([0-9a-z])*)|[a-z0-9]{2,}/g,
                customKeys: ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'j', 'k', 'l', 'm', 'n', 'o', 'p'],
                lineNumberJump: false,
                optimizeEnd: false
            };

            const environment: LabelEnvironment = {
                keys: [...settings.customKeys],
                settings
            };

            const labelsWithOptimize = getWordLabels({
                keys: [...settings.customKeys],
                settings: { ...settings, optimizeEnd: true }
            }, window.activeTextEditor) as unknown as WordLabel[];

            const labelsWithoutOptimize = getWordLabels(environment, window.activeTextEditor) as unknown as WordLabel[];

            // Should have more labels without optimize since words near end are not skipped
            assert.ok(labelsWithoutOptimize.length >= labelsWithOptimize.length,
                'Should have same or more labels when optimizeEnd is disabled');
        });
    });

    suite('Combined Features - Unit Tests', function () {
        test('Both features enabled - should work together', function () {
            if (!window.activeTextEditor) {
                throw new Error('No active editor');
            }

            const settings: Settings = {
                wordsPattern: /([A-Z]+([0-9a-z])*)|[a-z0-9]{2,}/g,
                customKeys: ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'j', 'k', 'l', 'm', 'n', 'o', 'p'],
                lineNumberJump: true,
                optimizeEnd: true
            };

            const environment: LabelEnvironment = {
                keys: [...settings.customKeys],
                settings
            };

            const labels = getWordLabels(environment, window.activeTextEditor) as unknown as WordLabel[];

            // Should have line number labels
            const lineNumberLabels = labels.filter(label => /^\d{2}$/.test(label.keyLabel));
            assert.ok(lineNumberLabels.length > 0, 'Should create line number labels');

            // Should have end-of-line labels
            const document = window.activeTextEditor.document;
            const endOfLineLabels = labels.filter(label => {
                const line = document.lineAt(label.lineNumber);
                return label.column === line.text.length && line.text.trim().length > 0;
            });
            assert.ok(endOfLineLabels.length > 0, 'Should create end-of-line labels');

            // Word labels should skip positions < 2 (lineNumberJump) and positions near line end (optimizeEnd)
            const wordLabels = labels.filter(label =>
                !/^\d{2}$/.test(label.keyLabel) &&
                label.column !== document.lineAt(label.lineNumber).text.length
            );

            wordLabels.forEach(label => {
                assert.ok(label.column >= 2, `Word label should be at column >= 2, got ${label.column}`);

                const line = document.lineAt(label.lineNumber);
                const distanceFromEnd = line.text.length - label.column;
                assert.ok(distanceFromEnd >= 3,
                    `Word label should not be within 3 characters of line end, distance: ${distanceFromEnd}`);
            });
        });
    });
});