# Agents Guide — Elevate Admin App

Purpose: Give agents precise, local rules for working in the Admin app only.

## Scope & Principles
- Prefer server-only services (`apps/admin/lib/services/*`) in server components and server actions (`apps/admin/lib/actions/*`) from client shells. Avoid importing `@elevate/admin-core` in client components.
- Typed UI: Project API types (`@elevate/types/admin-api-types`) into small, UI‑safe shapes before rendering.
- Safety by construction: Favor typed locals and small helpers over disabling rules.
- Import hygiene: Keep import groups orderly and consistent (see below).

## Do
- Use server services in server components (e.g., `lib/services/users.listUsers`) and server actions in client components (e.g., `lib/actions/users.listUsersAction`, `reviewSubmissionAction`).
- Convert results to UI-safe projections (no nullish/unknown access in JSX).
- Use a tiny error helper for `setError` to avoid propagating error-typed values:
  ```ts
  function toMsg(context: string, err: unknown): string {
    if (err instanceof Error) return `${context}: ${err.message}`
    try { return `${context}: ${JSON.stringify(err)}` } catch { return `${context}: Unknown error` }
  }
  // setError(toMsg('Fetch users', err))
  ```
- Assign action results to typed locals before calling `setState`:
  ```ts
  const { users } = await listUsersAction(params)
  setUsers(users.map(toUser))
  ```

## Don’t
- Don’t fetch directly in client pages with `fetch` — call server actions instead.
- Don’t access unknown/any in JSX (e.g., `value as any` in renderers).
- Don’t regress from alias imports (`@/*`, `@elevate/*`) to deep relative paths.

## Import Order (eslint: import/order)
1) External framework libs: `react`, `next/*`, `next-intl`, `zod`
2) Internal libs: `@/lib/*`, then core packages `@elevate/*` (auth, types, admin-core, etc.)
3) UI: `@elevate/ui`, `@elevate/ui/blocks`
- Exactly one blank line between groups; no blank lines within a group.
- Avoid duplicate imports / imports in module body.

## Common Recipes
- Review modal fetch:
  ```ts
  const { submission } = await getSubmissionByIdAction(id)
  setReviewModal((p) => ({ ...p, submission }))
  ```
- Single review:
  ```ts
  await reviewSubmissionAction({
    submissionId: id,
    action, // 'approve' | 'reject'
    ...(note ? { reviewNote: note } : {}),
    ...(adj === '' ? {} : { pointAdjustment: Number(adj) }),
  })
  ```
- Bulk review:
  ```ts
  await bulkReviewAction({
    submissionIds: Array.from(selectedRows),
    action,
    ...(note ? { reviewNote: note } : {}),
  })
  ```

## Local Commands
- Install: `pnpm -C elevate install`
- Dev (admin only): `pnpm -C elevate -F elevate-admin dev`
- Lint (admin only): `pnpm -C elevate -F elevate-admin lint`
- Type-check: `pnpm -C elevate -F elevate-admin type-check`
- Monorepo lint: `pnpm -C elevate lint`

## Notes
- Keep Admin thin: validation/typing lives in `@elevate/types`.
- When adding a page, start from a server service or server action, add a small projection, and wire `toMsg()` for errors.
