# ORM/Model Leakage Migration Guide

## Problem
The current API types in `/packages/types/src/api-types.ts` contain ORM/Model leakage:
- Prisma aggregation patterns (`_sum` fields)
- Database snake_case field names (`created_at`, `avatar_url`, `icon_url`, etc.)
- Internal database schema exposed to client code

## Solution
A two-phase migration to clean DTOs:

### Phase 1: ✅ COMPLETED
- ✅ Created `/packages/types/src/dto-mappers.ts` with clean camelCase DTOs
- ✅ Marked existing API types as DEPRECATED with ORM leakage comments
- ✅ Added helper functions to map between formats
- ✅ Maintained backward compatibility for existing frontend code

### Phase 2: TO BE IMPLEMENTED
Gradually migrate API routes and frontend components to use clean DTOs:

#### API Routes to Update
1. `/apps/web/app/api/leaderboard/route.ts` - Replace `_sum` pattern
2. `/apps/web/app/api/profile/[handle]/route.ts` - Use `UserProfileDTO`
3. `/apps/admin/app/api/admin/users/route.ts` - Clean up admin responses
4. Other routes using snake_case or Prisma patterns

#### Frontend Components to Update
1. `/packages/ui/src/components/LeaderboardTable.tsx`
2. `/packages/ui/src/components/ProfileCard.tsx`  
3. Any components accessing `user._sum.points` or snake_case fields

## Clean DTO Structure

### Before (ORM Leakage)
```typescript
interface LeaderboardEntry {
  user: {
    avatar_url?: string | null    // snake_case
    earned_badges?: Array<...>    // snake_case
    _sum?: { points: number }     // Prisma aggregation
  }
}
```

### After (Clean DTO)
```typescript
interface LeaderboardEntryDTO {
  user: {
    avatarUrl?: string | null     // camelCase
    earnedBadges?: Array<...>     // camelCase
    totalPoints: number           // Clean field name
  }
}
```

## Migration Steps

### For API Routes
```typescript
// OLD - Direct Prisma patterns
const user = await prisma.user.findUnique({
  include: { _sum: { points: true } }
});
return { user }; // Leaks _sum pattern

// NEW - Use DTO mappers
import { mapUserProfileToDTO, extractPointsFromAggregation } from '@elevate/types';

const user = await prisma.user.findUnique({...});
const pointsAgg = await prisma.pointsLedger.aggregate({...});
const totalPoints = extractPointsFromAggregation(pointsAgg);

return mapUserProfileToDTO(user, totalPoints); // Clean DTO
```

### For Frontend Components
```typescript
// OLD - Accessing ORM patterns
const totalPoints = user._sum?.points || 0;
const avatarUrl = user.avatar_url;

// NEW - Clean camelCase
const totalPoints = user.totalPoints;
const avatarUrl = user.avatarUrl;
```

## Breaking Change Strategy

To avoid breaking existing code:
1. Keep legacy types for backward compatibility
2. Add new clean DTOs alongside existing types
3. Gradually migrate one API route at a time
4. Update corresponding frontend components
5. Remove legacy types in a future major version

## Files Created/Modified

### ✅ Created
- `/packages/types/src/dto-mappers.ts` - Clean DTOs and mapper functions

### ✅ Modified  
- `/packages/types/src/api-types.ts` - Marked as deprecated, added DTO exports
- `/packages/types/src/index.ts` - Export DTO mappers

### 🚧 Next Steps
1. Update one API route to use DTOs (start with `/api/profile/[handle]`)
2. Update corresponding frontend component
3. Test thoroughly
4. Repeat for other routes
5. Remove deprecated types in next major version

## Benefits After Migration

✅ **Clean API Surface**: No database schema leakage to clients  
✅ **Consistent Naming**: All camelCase, no snake_case  
✅ **Type Safety**: Proper TypeScript types without Prisma patterns  
✅ **Future Proof**: Easy to change database schema without breaking clients  
✅ **Better DX**: Cleaner interfaces for frontend developers  