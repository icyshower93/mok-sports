module.exports = {
  extends: ['react-app', 'plugin:import/recommended', 'plugin:import/typescript'],
  rules: {
    'import/no-relative-parent-imports': 'error',
    'import/no-useless-path-segments': ['warn', { noUselessIndex: true }],
    // Disallow the relative queryClient import specifically
    'no-restricted-imports': ['error', { patterns: ['./queryClient'] }],
  },
  settings: {
    'import/resolver': { typescript: {} },
  },
};