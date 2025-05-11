import tseslint from '@typescript-eslint/eslint-plugin';
import tsparser from '@typescript-eslint/parser';

export default [
  {
    ignores: ['node_modules/**', 'dist/**'],
  },
  {
    files: ['**/*.ts'],
    languageOptions: {
      parser: tsparser,
      parserOptions: {
        project: './tsconfig.json',
        ecmaVersion: 'latest',
        sourceType: 'module',
      },
    },
    plugins: {
      '@typescript-eslint': tseslint,
    },
    rules: {
      // ESLint core rules
      'semi': ['error', 'never'],
      'prefer-const': 'error',
      'no-unused-vars': 'off',
      'indent': ['error', 4],
      'quotes': ['error', 'single'],
      'comma-dangle': ['error', 'only-multiline'],
      
      // TypeScript rules
      '@typescript-eslint/no-explicit-any': 'off',
      "@typescript-eslint/no-unused-vars": ["error", {
        varsIgnorePattern: '^_',
        ignoreRestSiblings: true,
      }]
    },
  },
];