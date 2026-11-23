import tseslint from 'typescript-eslint';
export default [
  { ignores: ['dist/**', 'reference/**', 'node_modules/**'] },
  ...tseslint.configs.recommended,
  { files: ['**/*.ts'], rules: {
    '@typescript-eslint/no-explicit-any': 'error',
    '@typescript-eslint/no-unused-vars': ['error', {argsIgnorePattern:'^_'}],
    '@typescript-eslint/no-non-null-assertion': 'error'
  }}
];
