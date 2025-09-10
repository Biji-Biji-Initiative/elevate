## Header Composition and Auth

Overview

- The shared UI header is framework-agnostic and does not import auth providers.
- Apps control auth visibility using composition (`SignedIn`/`SignedOut` wrappers) and pass React nodes to header slots.

Usage

- Use `ClientHeader` from `@elevate/ui/next` in app layouts.
- Provide the following props as needed:
  - `signInButton`: wrapped in `<SignedOut>`
  - `userButton`: wrapped in `<SignedIn>`
  - `dashboardCta`: wrapped in `<SignedIn>`
  - `languageSwitcher`: optional control
- Example (web app): see `apps/web/app/[locale]/layout.tsx`.

Locale-Aware Links

- The header derives the current locale from `usePathname()` and prefixes internal links accordingly.
- Keep links in shared UI components relative (e.g., `metrics/learn`) so locale context is preserved.

Do Nots

- Do not pass booleans like `isSignedIn` into UI library components for conditional rendering; use composition.
- Do not import `@clerk/nextjs` (or any auth provider) inside `@elevate/ui`.
