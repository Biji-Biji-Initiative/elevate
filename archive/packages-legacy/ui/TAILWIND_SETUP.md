# Tailwind CSS Setup for @elevate/ui

This guide explains how to configure Tailwind CSS in consuming applications to properly include styles from the `@elevate/ui` package.

## Option 1: Source Scanning (Recommended)

Include the UI package source in your Tailwind content configuration:

```js
// tailwind.config.js
module.exports = {
  content: [
    // Your app's content
    './src/**/*.{js,ts,jsx,tsx}',
    './app/**/*.{js,ts,jsx,tsx}',
    
    // Include @elevate/ui source files
    './node_modules/@elevate/ui/src/**/*.{js,ts,jsx,tsx}',
  ],
  // ... rest of config
}
```

## Option 2: Distribution Scanning

If you prefer to scan the built files:

```js
// tailwind.config.js
module.exports = {
  content: [
    // Your app's content
    './src/**/*.{js,ts,jsx,tsx}',
    './app/**/*.{js,ts,jsx,tsx}',
    
    // Include @elevate/ui distribution files
    './node_modules/@elevate/ui/dist/**/*.{js,jsx}',
  ],
  // ... rest of config
}
```

## Option 3: Using the Tailwind Preset (Optional)

You can also use the provided Tailwind preset for consistent configuration:

```js
// tailwind.config.js
const elevatePreset = require('@elevate/ui/tailwind-preset')

module.exports = {
  presets: [elevatePreset],
  content: [
    // Your app's content
    './src/**/*.{js,ts,jsx,tsx}',
    './app/**/*.{js,ts,jsx,tsx}',
    
    // UI package content (still required)
    './node_modules/@elevate/ui/src/**/*.{js,ts,jsx,tsx}',
  ],
  // ... additional config
}
```

## Global Styles

Don't forget to import the global styles in your application:

```js
// In your main CSS file or layout component
import '@elevate/ui/styles/globals.css'
```

## Troubleshooting

### Classes Not Applied
- Verify the `content` paths include the UI package
- Check that your build process is picking up the Tailwind config
- Ensure the global CSS is imported

### Build Errors
- Make sure all peer dependencies are installed (`tailwindcss`, `react`, `react-dom`)
- Verify Node.js version compatibility (>=20.11)

### Performance Optimization
- Use source scanning (Option 1) for better tree-shaking
- The UI package marks CSS as a side effect for proper bundling

## Next Steps

After setup, you can import and use UI components:

```tsx
import { Button } from '@elevate/ui'
import { FileUpload } from '@elevate/ui/blocks'
import { HeroSection } from '@elevate/ui/blocks/sections'
```

For more information, see the main README.md file.