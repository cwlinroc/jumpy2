/**
 * TypeScript replacement for the Elm state machine
 * Manages jump mode state, key input, and label matching
 */

export type Labels = string[];

export interface StateModel {
    active: boolean;
    keysEntered: string;
    lastJumped: string;
    labels: Labels;
    status: string;
}

export type StateChangeCallback = (model: StateModel) => void;
export type LabelJumpCallback = (keyLabel: string) => void;
export type ValidKeyCallback = (keyLabel: string) => void;

export class JumpStateMachine {
    private model: StateModel;
    private onStateChange: StateChangeCallback | null = null;
    private onLabelJump: LabelJumpCallback | null = null;
    private onValidKey: ValidKeyCallback | null = null;

    constructor() {
        this.model = {
            active: false,
            keysEntered: '',
            lastJumped: '',
            labels: [],
            status: ''
        };
    }

    // Event subscription methods (replacing Elm ports)
    onActiveChanged(callback: StateChangeCallback): void {
        this.onStateChange = callback;
    }

    onLabelJumped(callback: LabelJumpCallback): void {
        this.onLabelJump = callback;
    }

    onValidKeyEntered(callback: ValidKeyCallback): void {
        this.onValidKey = callback;
    }

    // Status message functions (replacing VSCStatusFunctions)
    private clearStatus(): string {
        return '';
    }

    private resetStatus(): string {
        return 'Jump Mode!';
    }

    private setNoMatchStatus(): string {
        return 'No Match! 😞';
    }

    private addKeyToStatus(keyEntered: string): string {
        return keyEntered;
    }

    // State manipulation methods
    private resetKeys(): void {
        this.model.keysEntered = '';
    }

    private turnOff(): void {
        this.model.active = false;
        this.resetKeys();
        this.model.status = this.clearStatus();
    }

    private turnOn(): void {
        this.model.active = true;
        this.model.status = this.resetStatus();
    }

    private emitStateChange(): void {
        if (this.onStateChange) {
            this.onStateChange({ ...this.model });
        }
        if (this.onValidKey) {
            this.onValidKey(this.model.keysEntered);
        }
    }

    private emitLabelJump(): void {
        if (this.onStateChange) {
            this.onStateChange({ ...this.model });
        }
        if (this.onLabelJump) {
            this.onLabelJump(this.model.lastJumped);
        }
    }

    // Public methods (replacing Elm message handling)
    loadLabels(labels: Labels): void {
        this.model.labels = labels;
        this.turnOn();
        this.emitStateChange();
    }

    keyEntered(keyCode: number): void {
        if (!this.model.active) {
            return;
        }

        const keyEntered = String.fromCharCode(keyCode);
        const newKeysEntered = this.model.keysEntered + keyEntered;

        // Check if any labels start with the new key combination
        const keysEnteredMatch = this.model.labels.some(label => 
            label.startsWith(newKeysEntered)
        );

        if (!keysEnteredMatch) {
            this.model.status = this.setNoMatchStatus();
            this.emitStateChange();
            return;
        }

        const currentKeysLength = this.model.keysEntered.length;

        if (currentKeysLength === 0) {
            // FIRST LETTER
            this.model.keysEntered = newKeysEntered;
            this.model.status = this.addKeyToStatus(keyEntered);
            this.emitStateChange();
        } else if (currentKeysLength === 1) {
            // SECOND LETTER - complete the jump
            this.model.lastJumped = newKeysEntered;
            this.turnOff();
            this.emitLabelJump();
        }
        // Ignore additional keys (should not happen in normal flow)
    }

    reset(): void {
        if (!this.model.active) {
            return;
        }

        this.resetKeys();
        this.model.status = this.resetStatus();
        this.emitStateChange();
    }

    exit(): void {
        this.turnOff();
        this.emitStateChange();
    }

    // Getter for current state (for debugging/testing)
    getState(): StateModel {
        return { ...this.model };
    }

    isActive(): boolean {
        return this.model.active;
    }
}