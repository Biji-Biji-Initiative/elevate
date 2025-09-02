# Turbo Remote Cache Configuration

This document explains how to set up and use Turbo Remote Cache for the MS Elevate LEAPS Tracker project to speed up builds across CI and local development.

## Overview

Turbo Remote Cache allows teams to share build artifacts across machines, reducing build times by reusing previously computed results. This is especially beneficial for:

- **CI/CD Pipelines**: Faster builds by sharing cache between workflow runs
- **Team Development**: Share cache between team members' local machines
- **Consistent Performance**: Avoid rebuilding unchanged code

## Quick Setup

### 1. Automatic Setup (Recommended)

Run the setup script from the project root:

```bash
# Setup with local cache only (no token required)
pnpm setup:cache

# Or setup with remote cache (requires TURBO_TOKEN)
TURBO_TOKEN='your-token-here' pnpm setup:cache
```

### 2. Manual Setup

If you prefer to set up manually:

1. **Get a Turbo Token** (optional, for remote cache):
   - Visit [Vercel Account Tokens](https://vercel.com/account/tokens)
   - Create a new token with scope "Turborepo Remote Cache"
   - Copy the token

2. **Configure Environment**:
   ```bash
   # Add to your shell profile (.bashrc, .zshrc, etc.)
   export TURBO_TOKEN='your-token-here'
   
   # Or add to .env.local (not committed)
   echo "TURBO_TOKEN=your-token-here" >> .env.local
   ```

3. **Link to Remote Cache** (if using remote cache):
   ```bash
   turbo login --token="$TURBO_TOKEN"
   turbo link
   ```

## Configuration Details

### turbo.json Configuration

The project's `turbo.json` has been configured with:

```json
{
  "remoteCache": {
    "signature": true
  },
  "ui": "tui",
  "tasks": {
    "build": {
      "outputLogs": "new-only"
    },
    "lint": {
      "outputLogs": "new-only"
    },
    "type-check": {
      "outputLogs": "new-only"
    },
    "test": {
      "outputLogs": "new-only"
    }
  }
}
```

Key features:
- **Remote Cache Enabled**: `"signature": true` enables remote cache with signing
- **Output Optimization**: `"outputLogs": "new-only"` only shows new output, not cached
- **TUI Interface**: Better terminal interface for cache status

### Cached Tasks

The following tasks are cached:

| Task | Description | Cache Benefits |
|------|-------------|----------------|
| `build` | Next.js builds, TypeScript compilation | Skip rebuild of unchanged apps |
| `lint` | ESLint checks across all packages | Skip linting unchanged code |
| `type-check` | TypeScript type checking | Skip type checking unchanged code |
| `test` | Jest/Vitest test runs | Skip tests for unchanged code |

### Non-Cached Tasks

These tasks are intentionally not cached:
- `dev` - Development servers (persistent)
- `db:generate` - Database client generation
- `db:push` - Database schema changes
- `clean` - Cleanup operations

## Usage

### Local Development

Once configured, Turbo will automatically use the cache:

```bash
# First run - builds everything
pnpm build

# Second run - uses cache, much faster!
pnpm build

# Run specific task with cache info
turbo run build --summarize

# Force bypass cache (if needed)
turbo run build --force
```

### CI/CD

The GitHub Actions workflows are configured to use remote cache automatically when `TURBO_TOKEN` is set in repository secrets.

Required GitHub secrets:
- `TURBO_TOKEN` - Your Vercel Turbo token

Optional GitHub variables:
- `TURBO_TEAM` - Your team slug (if using team accounts)

### Cache Status

Check your cache configuration:

```bash
# Check current config
pnpm setup:cache --check

# View cache statistics
turbo run build --dry-run

# View detailed cache analysis
turbo run build --summarize
```

## Troubleshooting

### Common Issues

#### 1. "Failed to authenticate with remote cache"

```bash
# Verify your token is valid
turbo login --token="$TURBO_TOKEN"

# Re-link if needed
turbo unlink && turbo link
```

#### 2. "No cache hits"

This is normal for:
- First runs
- When code changes affect many packages
- When environment variables change

#### 3. "Cache misses despite no changes"

Check if these changed:
- Environment variables in `turbo.json` task config
- Files in `globalDependencies` (`.env.*local`, `pnpm-lock.yaml`, `turbo.json`)
- Input files for the specific task

#### 4. Permission Issues with Script

```bash
# Make script executable
chmod +x scripts/setup-remote-cache.sh
```

### Cache Performance

Monitor cache effectiveness:

```bash
# View cache hit rates
turbo run build --summarize

# Expected results:
# - First run: 0% cache hits (normal)
# - Subsequent runs with no changes: ~100% cache hits
# - Partial changes: Variable hit rates depending on what changed
```

### Environment Variables

The cache considers these environment variables:

- `NODE_ENV`
- `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `NEXT_PUBLIC_SITE_URL`

Changes to these will invalidate relevant caches.

## Best Practices

### For Team Members

1. **Set up remote cache**: Share build artifacts with the team
2. **Keep tokens secure**: Never commit `TURBO_TOKEN` to git
3. **Use consistent Node versions**: Avoid cache misses from version differences
4. **Update dependencies together**: Coordinate `pnpm-lock.yaml` changes

### For CI/CD

1. **Use GitHub secrets**: Store `TURBO_TOKEN` securely
2. **Enable for all relevant jobs**: Both test and build jobs should use cache
3. **Monitor cache metrics**: Track cache hit rates in CI logs

### For Development

1. **Clean when needed**: Use `turbo run clean` to clear local cache if issues arise
2. **Force rebuilds**: Use `--force` flag when debugging build issues
3. **Check cache status**: Use `--dry-run` to see what would be cached

## Security Considerations

### Cache Signing

The configuration enables cache signing (`"signature": true`), which:
- Ensures cache integrity
- Prevents tampering with cached artifacts
- Provides audit trails for cache usage

### Token Management

- **Never commit tokens**: Always use environment variables or secrets
- **Use team tokens**: For organizational projects, prefer team-scoped tokens
- **Regular rotation**: Consider rotating tokens periodically
- **Minimal permissions**: Use tokens with minimal required scopes

## Performance Metrics

### Expected Improvements

With remote cache enabled, expect:

- **CI builds**: 30-70% faster (depending on changes)
- **Local builds**: 50-90% faster (after first run)
- **Cold starts**: Same speed (first runs always build everything)
- **Incremental builds**: Dramatically faster

### Monitoring

Track cache performance using:

```bash
# Detailed summary
turbo run build --summarize

# Example output:
# Tasks:    4 successful, 4 total
# Cached:   3 cached, 4 total
# Time:     2.1s >>> FULL TURBO
```

## Advanced Configuration

### Custom Cache Behavior

For specific needs, you can:

1. **Exclude files from cache keys**:
   ```json
   {
     "tasks": {
       "build": {
         "inputs": ["src/**", "!src/**/*.test.ts"]
       }
     }
   }
   ```

2. **Add task dependencies**:
   ```json
   {
     "tasks": {
       "build": {
         "dependsOn": ["^build", "type-check"]
       }
     }
   }
   ```

3. **Customize outputs**:
   ```json
   {
     "tasks": {
       "build": {
         "outputs": [".next/**", "!.next/cache/**"]
       }
     }
   }
   ```

### Team Configuration

For teams, consider:

1. **Shared team account**: Use a team Vercel account for shared cache
2. **Scoped access**: Use team-scoped tokens for security
3. **Cache policies**: Establish team policies for cache management

## Support

### Getting Help

1. **Script help**: `pnpm setup:cache --help`
2. **Turbo docs**: [Turborepo Documentation](https://turbo.build/repo/docs)
3. **Project issues**: Check project documentation or team chat

### Reporting Issues

If you encounter issues:

1. Run diagnostics: `pnpm setup:cache --check`
2. Check logs for error messages
3. Verify environment variable configuration
4. Test with a fresh cache: `turbo run clean && turbo run build`

---

*Last updated: December 2024*
*For the MS Elevate LEAPS Tracker project*