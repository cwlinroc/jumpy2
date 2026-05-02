import * as assert from 'assert';
import { JumpStateMachine } from '../../state-machine';

suite('State Machine Test Suite', () => {
    let stateMachine: JumpStateMachine;

    setup(() => {
        stateMachine = new JumpStateMachine();
    });

    suite('reset functionality', () => {
        test('resets keys when active', () => {
            const labels = ['aa', 'ab', 'ac'];
            
            // Setup: Load labels and enter a key
            stateMachine.loadLabels(labels);
            stateMachine.keyEntered(97); // 'a'
            
            // Verify key was entered
            assert.strictEqual(stateMachine.getState().keysEntered, 'a');
            
            // Reset and verify keys are cleared
            stateMachine.reset();
            assert.strictEqual(stateMachine.getState().keysEntered, '');
            assert.strictEqual(stateMachine.getState().status, 'Jump Mode!');
        });

        test('reset does nothing when not active', () => {
            const initialState = stateMachine.getState();
            stateMachine.reset();
            const afterResetState = stateMachine.getState();
            
            assert.deepStrictEqual(initialState, afterResetState);
        });
    });

    suite('key entry functionality', () => {
        test('does not add non-matched keys', () => {
            const labels = ['aa', 'ab', 'ac'];
            
            stateMachine.loadLabels(labels);
            stateMachine.keyEntered(90); // 'Z' - no match
            
            const state = stateMachine.getState();
            assert.strictEqual(state.keysEntered, '');
            assert.strictEqual(state.status, 'No Match!');
            assert.strictEqual(state.active, true);
        });

        test('adds a matched key', () => {
            const labels = ['aa', 'ab', 'ac'];
            
            stateMachine.loadLabels(labels);
            stateMachine.keyEntered(97); // 'a'
            
            const state = stateMachine.getState();
            assert.strictEqual(state.keysEntered, 'a');
            assert.strictEqual(state.status, 'a');
            assert.strictEqual(state.active, true);
        });

        test('completes jump on second matching key', () => {
            const labels = ['aa', 'ab', 'ac'];
            let jumpedLabel = '';
            
            stateMachine.onLabelJumped((label) => {
                jumpedLabel = label;
            });
            
            stateMachine.loadLabels(labels);
            stateMachine.keyEntered(97); // 'a'
            stateMachine.keyEntered(97); // 'a' again -> 'aa'
            
            const state = stateMachine.getState();
            assert.strictEqual(jumpedLabel, 'aa');
            assert.strictEqual(state.active, false);
            assert.strictEqual(state.keysEntered, '');
            assert.strictEqual(state.lastJumped, 'aa');
        });

        test('ignores keys when not active', () => {
            const initialState = stateMachine.getState();
            stateMachine.keyEntered(97); // 'a'
            const afterKeyState = stateMachine.getState();
            
            assert.deepStrictEqual(initialState, afterKeyState);
        });
    });

    suite('activation/deactivation', () => {
        test('reports active true after loading labels', () => {
            const labels = ['aa', 'ab', 'ac'];
            
            stateMachine.loadLabels(labels);
            
            const state = stateMachine.getState();
            assert.strictEqual(state.active, true);
            assert.strictEqual(state.status, 'Jump Mode!');
            assert.deepStrictEqual(state.labels, labels);
        });

        test('reports active false after exit', () => {
            const labels = ['aa', 'ab', 'ac'];
            
            stateMachine.loadLabels(labels);
            assert.strictEqual(stateMachine.isActive(), true);
            
            stateMachine.exit();
            
            const state = stateMachine.getState();
            assert.strictEqual(state.active, false);
            assert.strictEqual(state.status, '');
            assert.strictEqual(state.keysEntered, '');
        });
    });

    suite('callback functionality', () => {
        test('calls onActiveChanged callback', () => {
            let callbackActive: boolean | null = null;
            
            stateMachine.onActiveChanged((model) => {
                callbackActive = model.active;
            });
            
            const labels = ['aa', 'ab', 'ac'];
            stateMachine.loadLabels(labels);
            
            assert.strictEqual(callbackActive, true);
        });

        test('calls onValidKeyEntered callback', () => {
            let validKey = '';
            
            stateMachine.onValidKeyEntered((key) => {
                validKey = key;
            });
            
            const labels = ['aa', 'ab', 'ac'];
            stateMachine.loadLabels(labels);
            stateMachine.keyEntered(97); // 'a'
            
            assert.strictEqual(validKey, 'a');
        });

        test('calls onLabelJumped callback', () => {
            let jumpedLabel = '';
            
            stateMachine.onLabelJumped((label) => {
                jumpedLabel = label;
            });
            
            const labels = ['aa', 'ab', 'ac'];
            stateMachine.loadLabels(labels);
            stateMachine.keyEntered(97); // 'a'
            stateMachine.keyEntered(98); // 'b' -> 'ab'
            
            assert.strictEqual(jumpedLabel, 'ab');
        });
    });
});