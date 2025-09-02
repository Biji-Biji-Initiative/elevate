import js from '@eslint/js'
import nextPlugin from '@next/eslint-plugin-next'
import reactPlugin from 'eslint-plugin-react'
import reactHooksPlugin from 'eslint-plugin-react-hooks'
import jsxA11yPlugin from 'eslint-plugin-jsx-a11y'
import importPlugin from 'eslint-plugin-import'
import turboPlugin from 'eslint-plugin-turbo'
import tseslint from 'typescript-eslint'
import prettier from 'eslint-config-prettier'

/** @type {import('eslint').Linter.Config[]} */
export default [
  // Base ESLint recommended rules
  js.configs.recommended,

  // TypeScript ESLint configuration
  ...tseslint.configs.recommended,
  ...tseslint.configs.recommendedTypeChecked,
  
  // Global configuration
  {
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
      parserOptions: {
        ecmaFeatures: {
          jsx: true,
        },
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
    settings: {
      react: {
        version: 'detect',
      },
      'import/resolver': {
        typescript: {
          alwaysTryTypes: true,
        },
        node: true,
      },
    },
  },

  // Files to process
  {
    files: ['**/*.{js,jsx,ts,tsx,mjs,cjs}'],
    ignores: [
      'node_modules/**',
      '.next/**',
      'dist/**',
      'build/**',
      '**/.turbo/**',
      '**/coverage/**',
      '**/*.d.ts',
      '**/.env*',
      '**/prisma/migrations/**',
      '**/public/**',
      '**/.pnpm-store/**',
      '**/.vscode/**',
      '**/logs/**',
      '**/*.log',
      '**/temp/**',
      '**/tmp/**',
      '**/*.tmp',
      '**/Thumbs.db',
      '**/.DS_Store',
      '**/*.tsbuildinfo',
      '**/generated/**',
      '**/*.generated.*',
    ],
  },

  // React configuration
  {
    files: ['**/*.{jsx,tsx}'],
    plugins: {
      react: reactPlugin,
      'react-hooks': reactHooksPlugin,
      'jsx-a11y': jsxA11yPlugin,
    },
    rules: {
      ...reactPlugin.configs.recommended.rules,
      ...reactHooksPlugin.configs.recommended.rules,
      ...jsxA11yPlugin.configs.recommended.rules,
      
      // React specific rules
      'react/react-in-jsx-scope': 'off', // Not needed in Next.js
      'react/prop-types': 'off', // Using TypeScript for prop validation
      'react/no-unescaped-entities': 'off',
      'react/display-name': 'warn',
      'react/jsx-no-target-blank': 'error',
      'react/jsx-key': 'error',
      'react/no-children-prop': 'error',
      'react/no-array-index-key': 'warn',
      
      // React Hooks rules
      'react-hooks/rules-of-hooks': 'error',
      'react-hooks/exhaustive-deps': 'warn',
    },
  },

  // Next.js configuration
  {
    files: ['apps/web/**/*.{js,jsx,ts,tsx}', 'apps/admin/**/*.{js,jsx,ts,tsx}'],
    plugins: {
      '@next/next': nextPlugin,
    },
    rules: {
      ...nextPlugin.configs.recommended.rules,
      ...nextPlugin.configs['core-web-vitals'].rules,
      
      // Next.js specific rules
      '@next/next/no-img-element': 'error',
      '@next/next/no-page-custom-font': 'error',
      '@next/next/no-unwanted-polyfillio': 'error',
      '@next/next/no-before-interactive-script-outside-document': 'error',
      '@next/next/no-css-tags': 'error',
      '@next/next/no-head-element': 'error',
      '@next/next/no-html-link-for-pages': [
        'error',
        ['apps/web/app/', 'apps/admin/app/']
      ],
      '@next/next/no-sync-scripts': 'error',
      '@next/next/no-title-in-document-head': 'error',
      '@next/next/no-typos': 'error',
      
      // Server Components and Client Boundary rules
      '@next/next/no-async-client-component': 'error',
      '@next/next/no-document-import-in-page': 'error',
      '@next/next/no-head-import-in-document': 'error',
      '@next/next/no-script-component-in-head': 'error',
    },
  },

  // Import rules configuration
  {
    plugins: {
      import: importPlugin,
    },
    rules: {
      // Import organization
      'import/order': [
        'error',
        {
          groups: [
            'builtin',
            'external',
            'internal',
            'parent',
            'sibling',
            'index',
            'object',
            'type',
          ],
          'newlines-between': 'always',
          alphabetize: {
            order: 'asc',
            caseInsensitive: true,
          },
          pathGroups: [
            {
              pattern: 'react',
              group: 'external',
              position: 'before',
            },
            {
              pattern: 'next/**',
              group: 'external',
              position: 'before',
            },
            {
              pattern: '@/**',
              group: 'internal',
            },
            {
              pattern: '@elevate/**',
              group: 'internal',
            },
          ],
          pathGroupsExcludedImportTypes: ['react'],
        },
      ],
      'import/no-unresolved': 'error',
      'import/no-cycle': 'error',
      'import/no-self-import': 'error',
      'import/no-duplicates': 'error',
      'import/first': 'error',
      'import/newline-after-import': 'error',
      'import/no-anonymous-default-export': 'warn',
    },
  },

  // Turbo rules for monorepo
  {
    plugins: {
      turbo: turboPlugin,
    },
    rules: {
      'turbo/no-undeclared-env-vars': 'error',
    },
  },

  // TypeScript rules
  {
    files: ['**/*.{ts,tsx}'],
    rules: {
      // TypeScript specific rules
      '@typescript-eslint/no-unused-vars': [
        'warn',
        {
          argsIgnorePattern: '^_',
          varsIgnorePattern: '^_',
          caughtErrorsIgnorePattern: '^_',
        },
      ],
      '@typescript-eslint/no-explicit-any': 'warn',
      '@typescript-eslint/no-var-requires': 'error',
      '@typescript-eslint/no-non-null-assertion': 'warn',
      '@typescript-eslint/prefer-as-const': 'error',
      '@typescript-eslint/no-inferrable-types': 'warn',
      '@typescript-eslint/consistent-type-imports': [
        'error',
        {
          prefer: 'type-imports',
          fixStyle: 'separate-type-imports',
        },
      ],
      '@typescript-eslint/consistent-type-exports': 'error',
      
      // Disable rules that conflict with TypeScript
      'no-unused-vars': 'off',
      'no-undef': 'off',
    },
  },

  // General JavaScript/TypeScript rules
  {
    rules: {
      // Code quality
      'prefer-const': 'error',
      'no-var': 'error',
      'no-console': process.env.NODE_ENV === 'production' ? 'error' : 'warn',
      'no-debugger': process.env.NODE_ENV === 'production' ? 'error' : 'warn',
      'no-alert': 'warn',
      'no-eval': 'error',
      'no-implied-eval': 'error',
      
      // Error handling
      'no-empty': 'warn',
      'no-empty-function': 'warn',
      'prefer-promise-reject-errors': 'error',
      
      // Best practices
      'eqeqeq': ['error', 'smart'],
      'curly': ['error', 'multi-line'],
      'no-case-declarations': 'off',
      'no-constant-condition': 'warn',
      'no-unreachable': 'error',
      'no-duplicate-imports': 'error',
      
      // Formatting (handled by Prettier)
      'max-len': 'off',
      'indent': 'off',
      'quotes': 'off',
      'semi': 'off',
    },
  },

  // Test files configuration
  {
    files: ['**/*.{test,spec}.{js,jsx,ts,tsx}', '**/__tests__/**/*.{js,jsx,ts,tsx}'],
    rules: {
      // Allow more lenient rules in tests
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-non-null-assertion': 'off',
      'no-console': 'off',
    },
  },

  // Configuration files
  {
    files: [
      '*.config.{js,mjs,cjs,ts}',
      '*.config.*.{js,mjs,cjs,ts}',
      'tailwind.config.js',
      'next.config.js',
      'next.config.mjs',
      'postcss.config.js',
    ],
    rules: {
      '@typescript-eslint/no-var-requires': 'off',
      'import/no-anonymous-default-export': 'off',
    },
  },

  // Disable type-checked rules for JS files
  {
    files: ['**/*.{js,jsx,mjs,cjs}'],
    ...tseslint.configs.disableTypeChecked,
  },

  // Prettier configuration (must be last)
  prettier,
]