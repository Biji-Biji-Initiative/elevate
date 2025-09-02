# UI Component Registry Documentation

## Overview

The MS Elevate project uses a centralized shadcn/ui component registry to share UI components between the web and admin applications. This setup ensures consistent styling, reduces code duplication, and simplifies component maintenance across the monorepo.

## Architecture

```
elevate/
├── components.json          # Root registry configuration
├── registry.json           # Component definitions
├── packages/ui/            # Shared UI package
│   ├── src/
│   │   ├── components/ui/  # shadcn/ui components
│   │   ├── lib/           # Utility functions
│   │   └── globals.css    # Global styles
│   ├── tailwind.config.js # Tailwind configuration
│   └── package.json       # Package configuration
├── apps/web/
│   └── components.json     # Web app configuration
└── apps/admin/
    └── components.json     # Admin app configuration
```

## Component Organization

### Core shadcn/ui Components
Located in `packages/ui/src/components/ui/`:
- **alert.tsx** - Alert notifications with variants
- **badge.tsx** - Status badges and labels  
- **button.tsx** - Buttons with multiple variants and sizes
- **card.tsx** - Content containers
- **dialog.tsx** - Modal dialogs with overlay
- **form.tsx** - Form components with React Hook Form integration
- **input.tsx** - Input fields
- **label.tsx** - Form labels
- **select.tsx** - Dropdown select components
- **table.tsx** - Data table components
- **textarea.tsx** - Multi-line text input

### Legacy Custom Components
Located in `packages/ui/` root:
- **Alert.tsx** - Legacy alert component
- **Card.tsx** - Legacy card component
- **FileUpload.tsx** - File upload with progress
- **LoadingSpinner.tsx** - Loading indicators
- **FormField.tsx** - Custom form field wrapper

## Usage

### Adding Components from Registry

#### Root Level (recommended)
```bash
# Add components to the shared registry
pnpm ui:add button card input

# Initialize shadcn in the registry
pnpm ui:init
```

#### App-specific
```bash
# Add to web app
pnpm ui:add:web button card

# Add to admin app  
pnpm ui:add:admin select dialog
```

### Importing Components

#### From Shared UI Package
```tsx
// Import shadcn/ui components
import { Button, Card, Alert } from "@elevate/ui"

// Import utilities
import { cn } from "@elevate/ui/lib/utils"

// Import legacy components
import { FileUpload, LoadingSpinner } from "@elevate/ui"
```

#### Direct Import (alternative)
```tsx
// Direct component imports
import { Button } from "@elevate/ui/components/ui/button"
import { Card } from "@elevate/ui/components/ui/card"
```

### Building and Development

```bash
# Build UI package
pnpm ui:build

# Watch mode for development
pnpm ui:dev

# Type checking
pnpm ui:type-check

# Linting
pnpm ui:lint
```

## Configuration Files

### Root components.json
```json
{
  "$schema": "https://ui.shadcn.com/schema.json",
  "style": "new-york",
  "rsc": true,
  "tsx": true,
  "tailwind": {
    "config": "./packages/ui/tailwind.config.js",
    "css": "./packages/ui/src/globals.css",
    "baseColor": "neutral",
    "cssVariables": true,
    "prefix": ""
  },
  "iconLibrary": "lucide",
  "aliases": {
    "components": "./packages/ui/src/components",
    "utils": "./packages/ui/src/lib/utils",
    "ui": "./packages/ui/src/components/ui",
    "lib": "./packages/ui/src/lib",
    "hooks": "./packages/ui/src/hooks"
  },
  "registry": {
    "url": "./registry.json",
    "style": "new-york",
    "lib": "./packages/ui/src/lib",
    "components": "./packages/ui/src/components",
    "utils": "./packages/ui/src/lib/utils"
  }
}
```

### App components.json
Both web and admin apps reference the shared registry:
```json
{
  "registry": {
    "url": "../../registry.json",
    "style": "new-york",
    "lib": "@elevate/ui/lib",
    "components": "@elevate/ui",
    "utils": "@elevate/ui/lib/utils"
  },
  "aliases": {
    "utils": "@elevate/ui/lib/utils",
    "ui": "@elevate/ui"
  }
}
```

## Theming and Customization

### CSS Variables
The registry uses CSS variables for theming, defined in `packages/ui/src/globals.css`:

```css
:root {
  --background: 0 0% 100%;
  --foreground: 222.2 84% 4.9%;
  --primary: 221.2 83.2% 53.3%;
  /* ... more variables */
}
```

### Per-App Customization
Apps can override styles by:

1. **CSS Variable Override**
```css
/* In app/globals.css */
:root {
  --primary: 210 100% 50%; /* Custom primary color */
}
```

2. **Tailwind Config Extension**
```js
// In app tailwind.config.js
module.exports = {
  // Extend the base UI config
  extend: {
    colors: {
      'brand': '#custom-color'
    }
  }
}
```

## Adding New Components

### 1. Create Component
Add to `packages/ui/src/components/ui/new-component.tsx`:
```tsx
import * as React from "react"
import { cn } from "../../lib/utils"

interface NewComponentProps {
  className?: string
  children: React.ReactNode
}

const NewComponent = React.forwardRef<
  HTMLDivElement,
  NewComponentProps
>(({ className, children, ...props }, ref) => (
  <div
    ref={ref}
    className={cn("base-styles", className)}
    {...props}
  >
    {children}
  </div>
))
NewComponent.displayName = "NewComponent"

export { NewComponent }
```

### 2. Update Registry
Add to `registry.json`:
```json
{
  "name": "new-component",
  "type": "components:ui",
  "files": [
    {
      "path": "./packages/ui/src/components/ui/new-component.tsx",
      "content": "Description of the component",
      "type": "registry:ui"
    }
  ]
}
```

### 3. Export Component
Add to `packages/ui/src/index.ts`:
```tsx
export { NewComponent } from "./components/ui/new-component"
```

## Best Practices

### Component Development
- Use TypeScript for all components
- Follow shadcn/ui patterns and conventions
- Use `cn()` utility for conditional classes
- Include proper forwardRef and displayName
- Add comprehensive TypeScript interfaces

### Import Strategy
- Prefer importing from `@elevate/ui` package exports
- Use direct imports only for performance-critical paths
- Keep legacy component imports separate

### Styling Guidelines
- Use CSS variables for themeable properties
- Follow the established color system
- Maintain consistency with the "new-york" style
- Use Tailwind utility classes over custom CSS

### Testing Components
```bash
# Test component in isolation
pnpm -F @elevate/ui test

# Test in consuming apps
pnpm dev:web
pnpm dev:admin
```

## Troubleshooting

### Common Issues

#### 1. Import Resolution Errors
```bash
# Rebuild the UI package
pnpm ui:build

# Clear node_modules
pnpm clean && pnpm install
```

#### 2. TypeScript Errors
```bash
# Regenerate types
pnpm ui:type-check

# Check for conflicting dependencies
pnpm list --depth=0
```

#### 3. Style Conflicts
- Ensure CSS variables are properly defined
- Check Tailwind config inheritance
- Verify component class precedence

### Debugging Steps
1. Check package.json exports configuration
2. Verify TypeScript path mappings
3. Confirm Tailwind CSS inclusion
4. Test component isolation
5. Review import/export chain

## Migration Guide

### From Direct shadcn/ui
1. Move existing components to `packages/ui/src/components/ui/`
2. Update import paths to use `@elevate/ui`
3. Test component functionality in both apps
4. Remove duplicate component files

### Adding App-specific Components
1. Keep app-specific components in app directories
2. Extract shared components to the registry
3. Use composition over inheritance
4. Maintain clear boundaries

## CLI Commands Reference

```bash
# Registry Management
pnpm ui:add <component>        # Add component to registry
pnpm ui:init                   # Initialize shadcn config

# Development
pnpm ui:build                  # Build UI package
pnpm ui:dev                    # Watch mode development
pnpm ui:lint                   # Lint UI package
pnpm ui:type-check            # TypeScript validation

# App-specific
pnpm ui:add:web <component>   # Add to web app
pnpm ui:add:admin <component> # Add to admin app
```

## Contributing

1. **Adding Components**: Follow the component creation process
2. **Testing**: Ensure components work in both apps
3. **Documentation**: Update this guide for new patterns
4. **Review**: Get approval for registry changes

## Future Enhancements

- [ ] Component playground/storybook
- [ ] Automated component testing
- [ ] Theme builder interface
- [ ] Component usage analytics
- [ ] Performance monitoring

---

For questions or issues with the UI registry, consult the development team or create an issue in the project repository.