import prettier from 'eslint-config-prettier'
import js from '@eslint/js'
import nextPlugin from '@next/eslint-plugin-next/dist/index.js'
import importPlugin from 'eslint-plugin-import'
import jsxA11yPlugin from 'eslint-plugin-jsx-a11y'
import reactPlugin from 'eslint-plugin-react/index.js'
import reactHooksPlugin from 'eslint-plugin-react-hooks'
import turboPlugin from 'eslint-plugin-turbo'
import tseslint from 'typescript-eslint'

/** @type {import('eslint').Linter.Config[]} */
export default [
  // Global ignores (applies to all configs)
  {
    ignores: [
      'node_modules/**',
      '**/.next/**',
      '**/next/**',
      'apps/web/.next/**',
      'apps/admin/.next/**',
      '**/dist/**',
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
      // Documentation and content files
      '**/*.md',
      '**/*.mdx',
      'docs/**',
      'BUILDING.md',
      '**/BUILDING.md',
      // Package build outputs
      'packages/*/dist/**',
      'packages/auth/dist/**',
      'packages/ui/dist/**',
      'packages/types/dist/**',
      'packages/db/dist/**',
      // Additional build artifacts
      '**/.tsup/**',
      '**/storybook-static/**',
    ],
  },

  // Base ESLint recommended rules
  js.configs.recommended,

  // TypeScript ESLint configuration
  ...tseslint.configs.recommended,
  
  // Global configuration
  {
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
      parserOptions: {
        ecmaFeatures: {
          jsx: true,
        },
        project: true,
        tsconfigRootDir: import.meta.dirname,
      },
      // Browser globals for React/Next.js files
      globals: {
        console: 'readonly',
        window: 'readonly',
        document: 'readonly',
        localStorage: 'readonly',
        sessionStorage: 'readonly',
        fetch: 'readonly',
        FormData: 'readonly',
        URLSearchParams: 'readonly',
        URL: 'readonly',
        Headers: 'readonly',
        Request: 'readonly',
        Response: 'readonly',
        AbortController: 'readonly',
        crypto: 'readonly',
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
      
      // Accessibility rules - applied here where plugin is available
      'jsx-a11y/html-has-lang': 'warn',
      'jsx-a11y/alt-text': 'error',
      'jsx-a11y/anchor-has-content': 'error',
      'jsx-a11y/anchor-is-valid': 'error',
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
        'warn',
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
      
      // ESM Import Hygiene (BUILDING.md Section 6)
      'import/extensions': [
        'error',
        'ignorePackages',
        {
          js: 'always',
          jsx: 'never',
          ts: 'never',
          tsx: 'never',
        },
      ],
      
      // Prevent deep internal imports (BUILDING.md Section 11)
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            '@elevate/*/src/*',
            '@elevate/*/dist/*',
          ],
        },
      ],
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
      
      // STRICT TYPE SAFETY RULES - ZERO TOLERANCE FOR UNSAFE PATTERNS
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/no-unsafe-assignment': 'error', 
      '@typescript-eslint/no-unsafe-member-access': 'error',
      '@typescript-eslint/no-unsafe-return': 'error',
      '@typescript-eslint/no-unsafe-call': 'error',
      '@typescript-eslint/no-unsafe-argument': 'error',
      
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

  // Package code: strict rules enforced as errors
  {
    files: ['packages/**/*.{ts,tsx}'],
    rules: {
      // STRICT TYPE SAFETY RULES - ZERO TOLERANCE FOR UNSAFE PATTERNS
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/no-unsafe-assignment': 'error', 
      '@typescript-eslint/no-unsafe-member-access': 'error',
      '@typescript-eslint/no-unsafe-return': 'error',
      '@typescript-eslint/no-unsafe-call': 'error',
      '@typescript-eslint/no-unsafe-argument': 'error',
      '@typescript-eslint/no-floating-promises': 'error',
      '@typescript-eslint/consistent-type-imports': 'error',
      'import/order': 'error',
      'import/no-duplicates': 'error',
      'no-duplicate-imports': 'error',
      '@typescript-eslint/require-await': 'error',
    },
  },
  
  // Application code: progressive hardening with warnings
  {
    files: ['apps/**/*.{ts,tsx}'],
    rules: {
      'import/order': 'warn',
      'no-duplicate-imports': 'warn',
      'import/no-duplicates': 'warn',
      '@typescript-eslint/consistent-type-imports': 'warn',
      '@typescript-eslint/require-await': 'off',
      '@typescript-eslint/no-misused-promises': [
        'warn',
        {
          checksVoidReturn: {
            attributes: false,
          },
        },
      ],
      // Critical rules remain errors even in apps
      '@typescript-eslint/no-floating-promises': 'error',
      '@typescript-eslint/no-explicit-any': 'error',
      
      // Unsafe rules as warnings for apps (remain errors in packages)
      '@typescript-eslint/no-unsafe-assignment': 'warn',
      '@typescript-eslint/no-unsafe-member-access': 'warn',
      '@typescript-eslint/no-unsafe-return': 'warn',
      '@typescript-eslint/no-unsafe-call': 'warn',
      '@typescript-eslint/no-unsafe-argument': 'warn',
      '@next/next/no-img-element': 'warn',
      '@next/next/next-script-for-ga': 'warn',
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
      // Allow more lenient rules in tests - but maintain type safety
      '@typescript-eslint/no-non-null-assertion': 'off',
      'no-console': 'off',
      // Note: Removed no-explicit-any exception - tests must also be type-safe
    },
  },

  // Configuration files (Node.js environment)
  {
    files: [
      '**/*.config.{js,mjs,cjs,ts}',
      '**/*.config.*.{js,mjs,cjs,ts}',
      '**/tailwind.config.{js,ts,mjs}',
      '**/next.config.{js,mjs,ts}',
      '**/postcss.config.{js,mjs,ts}',
      'turbo.json',
      'package.json',
      '**/scripts/**/*.{js,mjs,ts}',
    ],
    languageOptions: {
      globals: {
        // Node.js globals
        process: 'readonly',
        module: 'readonly',
        require: 'readonly',
        __dirname: 'readonly',
        __filename: 'readonly',
        exports: 'writable',
        Buffer: 'readonly',
        global: 'readonly',
        console: 'readonly',
      },
    },
    rules: {
      '@typescript-eslint/no-var-requires': 'off',
      '@typescript-eslint/no-require-imports': 'off',
      'import/no-anonymous-default-export': 'off',
      'no-undef': 'off', // TypeScript handles this
    },
  },

  // Disable type-checked rules for JS files
  {
    files: ['**/*.{js,jsx,mjs,cjs}'],
    ...tseslint.configs.disableTypeChecked,
  },

  // Final app-specific relaxations to keep iterations fast
  {
    files: ['apps/**/*.{js,jsx,ts,tsx}'],
    plugins: {
      'jsx-a11y': jsxA11yPlugin,
      import: importPlugin,
    },
    rules: {
      // Allow duplicate import declarations between types and values in apps
      'no-duplicate-imports': 'warn',
      'import/no-duplicates': 'warn',
      // Accessibility: treat label association as a warning in apps
      'jsx-a11y/label-has-associated-control': 'warn',
    },
  },

  // Prettier configuration (must be last)
  prettier,
]
