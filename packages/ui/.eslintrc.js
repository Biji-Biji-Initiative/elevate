module.exports = {
  root: true,
  extends: ['../../.eslintrc.js'],
  rules: {
    // Prevent importing from incorrect paths
    'no-restricted-imports': [
      'error',
      {
        patterns: [
          // Don't import Next or Sentry from non-designated dirs
          { group: ['next', 'next/*', '@sentry/*'], message: 'Next/Sentry only allowed under src/next or src/feedback.' },
          // Prevent deep src imports from consumers
          { group: ['@elevate/ui/src/*'], message: 'Use public exports only.' },
          // Prevent importing from non-ui directories in components
          '../components/*',
          '../*/*/ui/*',
          // Prevent duplicate component imports
          '../badge',
          '../button',
          '../card',
          '../form',
          '../input',
          '../label',
          '../table',
        ],
      },
    ],
    
    // Ensure consistent type imports
    '@typescript-eslint/consistent-type-imports': [
      'error',
      {
        prefer: 'type-imports',
        fixStyle: 'inline-type-imports',
      },
    ],
    
    // No explicit any
    '@typescript-eslint/no-explicit-any': 'error',
    
    // No unsafe operations
    '@typescript-eslint/no-unsafe-assignment': 'error',
    '@typescript-eslint/no-unsafe-member-access': 'error',
    '@typescript-eslint/no-unsafe-call': 'error',
    '@typescript-eslint/no-unsafe-return': 'error',
    
    // Ensure proper component exports
    'import/no-internal-modules': [
      'warn',
      {
        forbid: [
          'src/components/*/*',
          'src/blocks/*/*',
          'src/next/*/*',
          'src/feedback/*/*',
        ],
      },
    ],
    
    // No useless path segments
    'import/no-useless-path-segments': 'error',
  },
  overrides: [
    // Enforce .js extensions for all source files
    {
      files: ['src/**/*.{ts,tsx}'],
      rules: {
        'import/extensions': [
          'error',
          'ignorePackages',
          {
            ts: 'never',
            tsx: 'never',
            js: 'always',
          },
        ],
      },
    },
    // Allow Next/Sentry only in designated folders
    {
      files: ['src/next/**/*', 'src/feedback/**/*'],
      rules: {
        'no-restricted-imports': [
          'error',
          {
            patterns: [
              // Still prevent deep package imports
              { group: ['@elevate/ui/src/*'], message: 'Use public exports only.' },
            ],
          },
        ],
      },
    },
    // Config files can skip extensions
    {
      files: ['*.config.ts', '*.config.js'],
      rules: {
        'import/extensions': 'off',
        '@typescript-eslint/no-var-requires': 'off',
      },
    },
  ],
}