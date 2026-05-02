// const typescriptEslint = require('@typescript-eslint/eslint-plugin');
// const typescriptParser = require('@typescript-eslint/parser');

// module.exports = [
//     {
//         files: ['**/*.ts'],
//         languageOptions: {
//             parser: typescriptParser,
//             parserOptions: {
//                 ecmaVersion: 6,
//                 sourceType: 'module'
//             }
//         },
//         plugins: {
//             '@typescript-eslint': typescriptEslint
//         },
//         rules: {
//             '@typescript-eslint/naming-convention': [
//                 'warn',
//                 {
//                     selector: 'import',
//                     format: ['camelCase', 'PascalCase']
//                 }
//             ],
//             'curly': 'warn',
//             'eqeqeq': 'warn',
//             'no-throw-literal': 'warn',
//             'semi': 'off'
//         }
//     },
//     {
//         ignores: ['out/**', '**/*.d.ts']
//     }
// ];

import tseslint from "typescript-eslint";

export default tseslint.config({
    files: ["**/*.ts"],
    extends: tseslint.configs.recommended,
    rules: {
        "@typescript-eslint/naming-convention": ["warn", {
            selector: "import",
            format: ["camelCase", "PascalCase"],
        }],

        curly: "warn",
        eqeqeq: "warn",
        "no-throw-literal": "warn",
        semi: "off",
    },
    ignores: ["out/**", "**/*.d.ts"],
});
