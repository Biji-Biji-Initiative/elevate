// Custom ESLint rules to enforce error consolidation

const errorClassNames = [
  'ElevateApiError',
  'ValidationError', 
  'AuthenticationError',
  'AuthorizationError',
  'NotFoundError',
  'ConflictError',
  'RateLimitError',
  'SubmissionLimitError',
  'FileValidationError',
  'ExternalServiceError',
  'ForbiddenError',
  'APIError'
]

module.exports = {
  'no-local-error-definitions': {
    meta: {
      type: 'problem',
      docs: {
        description: 'Disallow local error class definitions - use @elevate/types/errors instead',
        category: 'Best Practices',
      },
      fixable: null,
      schema: []
    },
    create(context) {
      return {
        ClassDeclaration(node) {
          const className = node.id?.name

          // Disallow duplicate, locally-defined canonical error classes
          if (className && errorClassNames.includes(className)) {
            const filename = context.getFilename()
            if (!filename.endsWith('/packages/types/src/errors.ts')) {
              context.report({
                node,
                message: `Local error class '${className}' is not allowed. Import from '@elevate/types/errors' instead.`
              })
            }
          }

          // Disallow arbitrary Error subclasses outside allowed locations
          if (className && className.includes('Error') && node.superClass) {
            const isExtendingError =
              (node.superClass.type === 'Identifier' && node.superClass.name === 'Error') ||
              (node.superClass.type === 'MemberExpression' && node.superClass.property?.name === 'Error')

            if (isExtendingError) {
              const filename = context.getFilename()
              if (!filename.endsWith('/packages/types/src/errors.ts') &&
                  !filename.includes('/packages/storage/src/')) {
                context.report({
                  node,
                  message: `Local error class '${className}' detected. Consider using existing error classes from '@elevate/types/errors' or add to the canonical location.`
                })
              }
            }
          }
        },
      }
    }
  },

  'require-canonical-error-imports': {
    meta: {
      type: 'problem', 
      docs: {
        description: 'Require error classes to be imported from canonical source',
        category: 'Best Practices',
      },
      fixable: 'code',
      schema: []
    },
    create(context) {
      return {
        ImportDeclaration(node) {
          if (node.source.value === '@elevate/types') {
            const errorImports = node.specifiers.filter(spec => 
              spec.type === 'ImportSpecifier' && 
              errorClassNames.includes(spec.imported.name)
            )
            
            if (errorImports.length > 0) {
              const errorNames = errorImports.map(spec => spec.imported.name).join(', ')
              context.report({
                node,
                message: `Error classes (${errorNames}) should be imported from '@elevate/types/errors' instead of '@elevate/types'`,
                fix(fixer) {
                  // This is a complex fix that would need to split imports
                  // For now, just report the issue
                  return null
                }
              })
            }
          }
        }
      }
    }
  }
}
