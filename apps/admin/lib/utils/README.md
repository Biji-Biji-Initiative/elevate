Admin lib utils

- param-builder.ts
  - mergeOptional(obj, key, value): immutably add a key only when value is defined. Helps satisfy exactOptionalPropertyTypes without unsafe casts.
  - isOneOf(value, options): runtime guard to narrow string unions.
  - nonEmptyString(value): guard for present, non-empty strings.

- query.ts
  - buildQueryString(params): builds a URL query string from a record, skipping undefined/null values.
  - buildSearchParams(params): returns a URLSearchParams with the same skipping rules.

Usage guidelines

- Prefer mergeOptional when constructing service/action params to avoid including undefined keys.
- Prefer buildQueryString for UI URL construction instead of manual URLSearchParams; it centralizes filtering of empty values and improves readability.

