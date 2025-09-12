## API Docs in Web App

Overview

- The OpenAPI spec is generated at build time into `apps/web/public/openapi.json` by `scripts/emit-openapi-json.mjs`.
- The Web app serves the Swagger UI viewer at `/docs` when `NEXT_PUBLIC_ENABLE_API_DOCS=true`.
- No runtime dependency on `@elevate/openapi` in Web; the spec is static.

How it works

- Prebuild hook (`apps/web/package.json`):

  - Runs `node ../../scripts/emit-openapi-json.mjs` to emit the OpenAPI JSON.
  - The script imports `getOpenApiSpec` from `@elevate/openapi` (workspace package) and writes the JSON to `apps/web/public/openapi.json`.

- Viewer page (`apps/web/app/docs/page.tsx`):
  - Client-only page using `swagger-ui-react` to display `/openapi.json`.
  - Guarded by `NEXT_PUBLIC_ENABLE_API_DOCS`: when not `true`, the page shows a disabled message.
  - A pure HTML viewer is also available at `/docs.html` for environments without React.

Enable docs locally

1. Set env variable in Web env: `NEXT_PUBLIC_ENABLE_API_DOCS=true`
2. Build and start:
   - `pnpm -C elevate -F web build`
   - `pnpm -C elevate -F web start`
3. Visit `/docs` to view the API.

- `/api/docs` redirects to `/openapi.json`.
- `/docs.html` is a simple static viewer alternative.

Notes

- Admin and Web server code now avoid intra-app HTTP; they call server-only services.
- Public API routes remain for CSR/external clients, and are documented by the OpenAPI spec.
- If the spec shape changes, update `@elevate/openapi` schemas and rebuild.
