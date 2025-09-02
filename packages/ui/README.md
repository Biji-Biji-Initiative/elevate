# @elevate/ui

Shared UI component library for the MS Elevate project, built on top of shadcn/ui and Tailwind CSS.

## Overview

This package provides a centralized collection of UI components used across the web and admin applications. It combines shadcn/ui components with custom components specific to the Elevate project.

## Components

### shadcn/ui Components
- **Alert** - Notification alerts with variants
- **Badge** - Status badges and labels
- **Button** - Interactive buttons with multiple variants
- **Card** - Content container components
- **Dialog** - Modal dialog components
- **Form** - Form components with React Hook Form integration
- **Input** - Text input fields
- **Label** - Form labels
- **Select** - Dropdown select components
- **Table** - Data table components
- **Textarea** - Multi-line text inputs

### Custom Components
- **FileUpload** - File upload with drag & drop and progress
- **LoadingSpinner** - Loading indicators and overlays
- **FormField** - Enhanced form field wrapper

## Installation & Usage

This package is already configured in the monorepo workspace. Import components like this:

```tsx
import { Button, Card, Alert } from "@elevate/ui"
import { FileUpload, LoadingSpinner } from "@elevate/ui"
import { cn } from "@elevate/ui/lib/utils"
```

## Development

```bash
# Build the package
pnpm build

# Watch mode for development
pnpm build --watch

# Type checking
pnpm type-check

# Linting
pnpm lint
```

## Package Structure

```
packages/ui/
├── src/
│   ├── components/ui/    # shadcn/ui components
│   ├── lib/             # Utility functions
│   ├── globals.css      # Global styles and CSS variables
│   └── index.ts         # Main export file
├── components/          # Custom component location
├── tailwind.config.js   # Tailwind configuration
├── tsconfig.json        # TypeScript configuration
└── package.json         # Package configuration
```

## Styling

Components use Tailwind CSS with CSS variables for theming. The design system follows the "new-york" style from shadcn/ui with custom color variables defined in `src/globals.css`.

### CSS Variables
```css
:root {
  --background: 0 0% 100%;
  --foreground: 222.2 84% 4.9%;
  --primary: 221.2 83.2% 53.3%;
  /* ... more variables */
}
```

## Adding New Components

1. Create the component in `src/components/ui/`
2. Export it from `src/index.ts`
3. Add it to the registry configuration
4. Update documentation

See the main UI registry documentation for detailed instructions.

## Dependencies

### Peer Dependencies
- React 18+
- React DOM 18+

### Core Dependencies
- @radix-ui/* - Primitive UI components
- class-variance-authority - Variant-based styling
- clsx - Conditional classnames
- lucide-react - Icon library
- tailwind-merge - Tailwind class merging
- tailwindcss-animate - Animation utilities

## Contributing

1. Follow the established patterns for component structure
2. Use TypeScript for all new components
3. Include proper forwardRef and displayName
4. Test components in both web and admin apps
5. Update exports and documentation

## License

Private package for MS Elevate project.