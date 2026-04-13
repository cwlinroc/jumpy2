# Jumpy2 Fork

This is for personal use, which is a fork of the excellent [Jumpy2](https://github.com/DavidLGoldberg/jumpy2) VS Code extension created by [David L. Goldberg](https://github.com/DavidLGoldberg).
If you find this extension useful, please consider supporting David.

**For the complete documentation, installation instructions, and features, please visit the original repository:**

## Fork-Specific Notes

- The status bar (emoji jumper, "Jumpy: Jump Mode!" text, achievements) has been removed as a personal preference.
- `StateModel.status` in `src/state-machine.ts` is retained intentionally — removing it would require a large refactor of the state machine and tests with no functional benefit. It still tracks internal state (`'Jump Mode!'`, `'No Match!'`, key-entered) and is asserted on in tests.

## License

This fork maintains the original MIT License. See [LICENSE.md](LICENSE.md) for details.
