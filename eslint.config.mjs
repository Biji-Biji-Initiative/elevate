import js from '@eslint/js'
import nextPlugin from '@next/eslint-plugin-next/dist/index.js'
import prettier from 'eslint-config-prettier'
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
      '**/.react-email/**',
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
      '**/vitest.config.*',
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
      'archive/**',
      'fixtures/**',
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
      '**/tsup.config.ts',
      '**/storybook-static/**',
      '**/__tests__/**',
      'packages/**/scripts/**',
      'packages/**/seed.ts',
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
        project: './tsconfig.eslint.json',
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
      'import/ignore': ['\\.css$'],
      'import/resolver': {
        typescript: {
          alwaysTryTypes: true,
          project: [
            './tsconfig.base.json',
            './apps/*/tsconfig.json',
            './packages/*/tsconfig.json',
          ],
        },
        node: {
          extensions: [
            '.js',
            '.jsx',
            '.ts',
            '.tsx',
            '.mjs',
            '.cjs',
            '.json',
            '.css',
          ],
        },
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

  // Fixtures: treat as separate consumers with Node globals, disable typed project
  {
    files: ['fixtures/**/*.{js,jsx,ts,tsx}'],
    languageOptions: {
      parserOptions: {
        project: false,
      },
      globals: {
        process: 'readonly',
        module: 'readonly',
        require: 'readonly',
        console: 'readonly',
      },
    },
    rules: {
      'no-undef': 'off',
      '@typescript-eslint/no-var-requires': 'off',
      '@typescript-eslint/no-unsafe-assignment': 'off',
      '@typescript-eslint/no-unsafe-member-access': 'off',
      '@typescript-eslint/no-unsafe-return': 'off',
      '@typescript-eslint/no-unsafe-call': 'off',
      '@typescript-eslint/no-unsafe-argument': 'off',
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
        ['apps/web/app/', 'apps/admin/app/'],
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
      'import/no-unresolved': [
        'error',
        {
          ignore: ['^@elevate/ui/styles/', '^@elevate/openapi($|/.*)'],
        },
      ],
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
          patterns: ['@elevate/*/src/*', '@elevate/*/dist/*'],
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

      // TYPE SAFETY RULES - PRAGMATIC STRICTNESS
      '@typescript-eslint/no-explicit-any': 'warn',
      '@typescript-eslint/no-unsafe-assignment': 'warn',
      '@typescript-eslint/no-unsafe-member-access': 'warn',
      '@typescript-eslint/no-unsafe-return': 'warn',
      '@typescript-eslint/no-unsafe-call': 'warn',
      '@typescript-eslint/no-unsafe-argument': 'warn',

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
      // TYPE SAFETY RULES - STRICT FOR PACKAGES BUT PRAGMATIC FOR ERROR HANDLING
      '@typescript-eslint/no-explicit-any': 'warn',
      '@typescript-eslint/no-unsafe-assignment': 'warn',
      '@typescript-eslint/no-unsafe-member-access': 'warn',
      '@typescript-eslint/no-unsafe-return': 'warn',
      '@typescript-eslint/no-unsafe-call': 'warn',
      '@typescript-eslint/no-unsafe-argument': 'warn',
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
      // Strict rules for apps too
      '@typescript-eslint/no-floating-promises': 'error',
      '@typescript-eslint/no-explicit-any': 'warn',
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
      // Disallow prisma.$queryRawUnsafe to prevent SQL injection; use Prisma.sql + $queryRaw
      'no-restricted-syntax': [
        'error',
        {
          selector: 'CallExpression[callee.property.name="$queryRawUnsafe"]',
          message:
            'Use prisma.$queryRaw with Prisma.sql to avoid SQL injection risks.',
        },
        {
          selector: 'CallExpression[callee.property.name="$executeRawUnsafe"]',
          message:
            'Use prisma.$executeRaw with Prisma.sql to avoid SQL injection risks.',
        },
      ],
      // Code quality
      'prefer-const': 'error',
      'no-var': 'error',
      // Keep console allowed to avoid noisy warnings in tooling and examples
      'no-console': 'off',
      'no-debugger': process.env.NODE_ENV === 'production' ? 'error' : 'warn',
      'no-alert': 'warn',
      'no-eval': 'error',
      'no-implied-eval': 'error',

      // Error handling
      'no-empty': 'warn',
      'no-empty-function': 'warn',
      'prefer-promise-reject-errors': 'error',

      // Best practices
      eqeqeq: ['error', 'smart'],
      curly: ['error', 'multi-line'],
      'no-case-declarations': 'off',
      'no-constant-condition': 'warn',
      'no-unreachable': 'error',
      'no-duplicate-imports': 'error',

      // Formatting (handled by Prettier)
      'max-len': 'off',
      indent: 'off',
      quotes: 'off',
      semi: 'off',
    },
  },

  // Test files configuration
  {
    files: [
      '**/*.{test,spec}.{js,jsx,ts,tsx}',
      '**/__tests__/**/*.{js,jsx,ts,tsx}',
      '**/tests/**/*.{js,jsx,ts,tsx}',
    ],
    languageOptions: {
      parserOptions: {
        project: false,
      },
      globals: {
        // Node.js globals commonly used in tests and helpers
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
      // Allow more lenient rules in tests
      '@typescript-eslint/no-non-null-assertion': 'off',
      'no-console': 'off',
      'turbo/no-undeclared-env-vars': 'off',
      '@typescript-eslint/no-var-requires': 'off',
      // Relax unsafe rules to reduce false positives around test helpers/expect
      '@typescript-eslint/no-unsafe-assignment': 'off',
      '@typescript-eslint/no-unsafe-member-access': 'off',
      '@typescript-eslint/no-unsafe-return': 'off',
      '@typescript-eslint/no-unsafe-call': 'off',
      '@typescript-eslint/no-unsafe-argument': 'off',
      // Relax import ordering in tests
      'import/order': 'off',
      'import/extensions': 'off',
      '@typescript-eslint/consistent-type-imports': 'off',
      '@typescript-eslint/consistent-type-exports': 'off',
      '@typescript-eslint/no-misused-promises': 'off',
      '@typescript-eslint/no-floating-promises': 'off',
      '@typescript-eslint/no-unused-vars': 'off',
      '@typescript-eslint/require-await': 'off',
      'no-empty-function': 'off',
    },
  },

  // Generated OpenAPI files: relax strict typing rules
  {
    files: [
      'packages/openapi/src/sdk.ts',
      'packages/openapi/src/spec.ts',
      'packages/openapi/src/examples.ts',
    ],
    rules: {
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-unsafe-assignment': 'off',
      '@typescript-eslint/no-unsafe-member-access': 'off',
      '@typescript-eslint/no-unsafe-return': 'off',
      '@typescript-eslint/no-unsafe-call': 'off',
      '@typescript-eslint/no-unsafe-argument': 'off',
      // Allow demo logging and import styles in generated/examples
      'no-console': 'off',
      'import/order': 'off',
      'import/first': 'off',
      'import/no-duplicates': 'off',
      '@typescript-eslint/no-unused-vars': 'off',
    },
  },

  // Error handling utilities: pragmatic type safety for unknown error handling
  {
    files: [
      '**/errors.ts',
      '**/error.ts',
      '**/error-boundary.tsx',
      '**/error.tsx',
      '**/*-error.tsx',
      '**/utils/errors.ts',
      '**/lib/errors.ts',
      '**/api/*/route.ts',
      '**/api/**/route.ts',
    ],
    rules: {
      // Error handling requires working with unknown types
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-unsafe-assignment': 'off',
      '@typescript-eslint/no-unsafe-member-access': 'off',
      '@typescript-eslint/no-unsafe-return': 'off',
      '@typescript-eslint/no-unsafe-call': 'off',
      '@typescript-eslint/no-unsafe-argument': 'off',
      // Allow console.error for error logging
      'no-console': 'off',
    },
  },

  // Configuration files (Node.js environment)
  {
    files: [
      '**/*.config.{js,mjs,cjs,ts}',
      '**/*.config.*.{js,mjs,cjs,ts}',
      '**/vitest.config.{js,mjs,cjs,ts}',
      '**/tailwind.config.{js,ts,mjs,cjs}',
      '**/tailwind-preset.{js,ts,mjs,cjs}',
      '**/next.config.{js,mjs,ts,cjs}',
      '**/postcss.config.{js,mjs,ts,cjs}',
      '**/.eslintrc.{js,mjs,cjs}',
      '**/.eslintrc.*.{js,mjs,cjs}',
      'tsup.base.mjs',
      'turbo.json',
      'package.json',
      '**/scripts/**/*.{js,mjs,ts,cjs}',
      'packages/**/seed.ts',
    ],
    languageOptions: {
      parserOptions: {
        project: false,
      },
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
      'import/no-unresolved': 'off',
      'import/extensions': 'off',
      'turbo/no-undeclared-env-vars': 'off',
      'no-useless-escape': 'off',
      '@typescript-eslint/ban-ts-comment': 'off',
      // Disable typed rules and unsafe checks for config files
      '@typescript-eslint/no-misused-promises': 'off',
      '@typescript-eslint/no-unsafe-assignment': 'off',
      '@typescript-eslint/no-unsafe-member-access': 'off',
      '@typescript-eslint/no-unsafe-return': 'off',
      '@typescript-eslint/no-unsafe-call': 'off',
      '@typescript-eslint/no-unsafe-argument': 'off',
      '@typescript-eslint/no-floating-promises': 'off',
      '@typescript-eslint/require-await': 'off',
      '@typescript-eslint/consistent-type-imports': 'off',
      '@typescript-eslint/consistent-type-exports': 'off',
      '@typescript-eslint/no-var-requires': 'off',
      '@typescript-eslint/no-require-imports': 'off',
      'import/no-anonymous-default-export': 'off',
      'no-undef': 'off', // TypeScript handles this
      'no-console': 'off',
      '@typescript-eslint/no-unused-vars': 'off',
    },
  },

  // Targeted override: allow env access declarations in rate limiter source
  {
    files: ['packages/security/src/rate-limiter.ts'],
    rules: {
      'turbo/no-undeclared-env-vars': 'off',
    },
  },

  // Disable type-checked rules for JS files
  {
    files: ['**/*.{js,jsx,mjs,cjs}'],
    ...tseslint.configs.disableTypeChecked,
  },

  // Strict rules for packages (libraries) - source files only
  {
    files: ['packages/**/src/**/*.{ts,tsx}'],
    rules: {
      // Enforce type safety in libraries with pragmatic exceptions
      '@typescript-eslint/no-explicit-any': 'warn',
      '@typescript-eslint/no-unsafe-assignment': 'warn',
      '@typescript-eslint/no-unsafe-member-access': 'warn',
      '@typescript-eslint/no-unsafe-return': 'warn',
      '@typescript-eslint/no-unsafe-call': 'warn',
      '@typescript-eslint/no-unsafe-argument': 'warn',
      '@typescript-eslint/consistent-type-imports': 'warn',
      '@typescript-eslint/consistent-type-exports': 'warn',
      '@typescript-eslint/no-floating-promises': 'error',
      '@typescript-eslint/require-await': 'warn',
      '@typescript-eslint/no-unused-vars': 'warn',

      // Import hygiene for libraries
      'import/no-duplicates': 'error',
      'import/extensions': [
        'error',
        'never',
        {
          js: 'never',
          ts: 'never',
          tsx: 'never',
          json: 'always',
        },
      ],

      // Block deep internal imports
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['@elevate/*/src/*', '@elevate/*/dist/*'],
              message:
                'Import from published package subpaths only, not internal paths.',
            },
          ],
        },
      ],
    },
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

  // Guardrail: discourage direct NextResponse.json in API routes; prefer envelope helpers
  {
    files: ['apps/**/app/api/**/*.ts', 'apps/**/app/api/**/*.tsx'],
    rules: {
      'no-restricted-syntax': [
        'warn',
        {
          selector:
            'CallExpression[callee.object.name="NextResponse"][callee.property.name="json"]',
          message:
            'Use createSuccessResponse/createErrorResponse from @elevate/http for standardized envelopes.',
        },
      ],
    },
  },

  // Guardrail: forbid direct server logger in Next.js route handlers
  {
    files: ['apps/**/app/api/**/*.ts', 'apps/**/app/api/**/*.tsx'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          paths: [
            {
              name: '@elevate/logging/server',
              message:
                'Do not import @elevate/logging/server in route handlers. Use @elevate/logging/safe-server instead.',
            },
          ],
        },
      ],
    },
  },

  // Tests inside packages: relax type-aware rules to avoid requiring parserServices
  {
    files: [
      'packages/**/*.{test,spec}.{ts,tsx}',
      'packages/**/__tests__/**/*.{ts,tsx}',
      'packages/**/tests/**/*.{ts,tsx}',
    ],
    languageOptions: {
      parserOptions: {
        project: false,
      },
    },
    rules: {
      '@typescript-eslint/no-unsafe-assignment': 'off',
      '@typescript-eslint/no-unsafe-member-access': 'off',
      '@typescript-eslint/no-unsafe-return': 'off',
      '@typescript-eslint/no-unsafe-call': 'off',
      '@typescript-eslint/no-unsafe-argument': 'off',
      '@typescript-eslint/no-floating-promises': 'off',
      '@typescript-eslint/no-misused-promises': 'off',
      '@typescript-eslint/consistent-type-imports': 'off',
      '@typescript-eslint/consistent-type-exports': 'off',
      '@typescript-eslint/no-unused-vars': 'off',
      'import/order': 'off',
      'import/extensions': 'off',
    },
  },

  // Prettier configuration (must be last)
  prettier,

  // UI package: Restrict direct Next/Sentry imports to designated folders only
  {
    files: ['packages/ui/src/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['next', 'next/*', '@sentry/*'],
              message:
                'Next/Sentry imports are only allowed under packages/ui/src/next or packages/ui/src/feedback. Use public subpaths in consumers.',
            },
          ],
        },
      ],
    },
  },
  {
    files: [
      'packages/ui/src/next/**/*.{ts,tsx}',
      'packages/ui/src/feedback/**/*.{ts,tsx}',
    ],
    rules: {
      'no-restricted-imports': 'off',
    },
  },
]
