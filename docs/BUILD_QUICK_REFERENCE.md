# Build Artifact Policy - Quick Reference

## 🚨 Emergency Fix for Build Failures

If your build suddenly fails with TypeScript errors:

```bash
# 1. Clean and rebuild everything
pnpm run build:clean

# 2. If it fails, you have real TypeScript errors to fix
# 3. Fix the TypeScript errors in the failing packages
# 4. Try building again
pnpm run build:clean
```

## 📝 Daily Commands

```bash
# Normal development (hot reload)
pnpm dev

# Before committing (verify clean build works)
pnpm run build:clean

# Quick policy check
pnpm run build:check
```

## 🔧 Setup (One-time)

```bash
# Install build policy enforcement
pnpm run build:setup-policy
```

## ❌ Common Errors & Fixes

### Error: "TypeScript compilation failed"
```bash
# See detailed errors:
pnpm run typecheck:build

# Fix the TypeScript errors, then:
pnpm run build:clean
```

### Error: "tsup config should have 'clean: true'"
Update `packages/[package]/tsup.config.ts`:
```typescript
export default defineConfig({
  // ... other options
  clean: true,  // Add this line
  // ... other options
})
```

### Error: "Found tracked dist files in git"
```bash
# Remove tracked dist files:
git rm -r packages/*/dist/
git commit -m "Remove tracked build artifacts"
```

## 🎯 Key Principle

**Always build from source, never rely on stale artifacts.**

This policy prevents the dangerous scenario where:
- TypeScript has compilation errors ❌
- But stale JavaScript files make things "work" ⚠️  
- Hiding critical type safety issues 💥

## 🔗 Full Documentation

See [BUILD_ARTIFACT_POLICY.md](./BUILD_ARTIFACT_POLICY.md) for complete details.