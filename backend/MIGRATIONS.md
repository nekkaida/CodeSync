# Prisma Migration Strategy

## Overview

This document outlines the strategy for managing database migrations in CodeSync using Prisma.

## Development Workflow

### Creating New Migrations

1. **Make Schema Changes**
   ```bash
   # Edit backend/prisma/schema.prisma
   vim backend/prisma/schema.prisma
   ```

2. **Generate Migration**
   ```bash
   cd backend
   npx prisma migrate dev --name descriptive_migration_name
   ```

   This command will:
   - Create a new migration file in `prisma/migrations/`
   - Apply the migration to your development database
   - Regenerate Prisma Client

3. **Test the Migration**
   ```bash
   # Reset database and reapply all migrations
   npx prisma migrate reset

   # Run tests to ensure migration works
   npm test
   ```

### Migration Naming Convention

Use descriptive names following this pattern:
- `add_<feature>` - Adding new tables/columns
- `update_<feature>` - Modifying existing schema
- `remove_<feature>` - Dropping tables/columns
- `fix_<issue>` - Fixing schema issues

Examples:
- `add_user_avatar`
- `update_session_indexes`
- `remove_legacy_fields`
- `fix_foreign_key_constraints`

## Production Deployment

### Pre-Deployment Checklist

- [ ] All migrations tested in development
- [ ] Migration is backward compatible (if zero-downtime required)
- [ ] Database backup created
- [ ] Migration rollback plan documented
- [ ] Team notified of deployment

### Deploying Migrations

**Option 1: Manual Deployment (Recommended for Critical Changes)**

```bash
# 1. Create database backup
docker exec codesync-postgres-prod pg_dump -U codesync_user codesync > backup_$(date +%Y%m%d_%H%M%S).sql

# 2. Review pending migrations
cd backend
npx prisma migrate status

# 3. Apply migrations
npx prisma migrate deploy

# 4. Verify migration success
npx prisma migrate status
```

**Option 2: Automated via CI/CD**

Migrations are automatically applied during deployment:
```yaml
# In docker-compose.prod.yml
backend:
  command: sh -c "npx prisma migrate deploy && node dist/index.js"
```

### Rollback Strategy

If a migration fails or causes issues:

```bash
# 1. Stop the application
docker-compose -f docker-compose.prod.yml stop backend

# 2. Restore from backup
docker exec -i codesync-postgres-prod psql -U codesync_user codesync < backup_YYYYMMDD_HHMMSS.sql

# 3. Revert code to previous version
git checkout <previous-commit>

# 4. Restart application
docker-compose -f docker-compose.prod.yml up -d backend
```

## Zero-Downtime Migrations

For production systems requiring zero downtime:

### 1. Adding Columns

✅ **Safe:** Adding nullable columns
```prisma
model User {
  // existing fields...
  avatar String? // nullable - safe to add
}
```

### 2. Making Columns Required

⚠️ **Requires Multi-Step Process:**

**Step 1:** Add nullable column
```prisma
model User {
  avatar String? // Step 1: Add as nullable
}
```

**Step 2:** Deploy and populate data
```typescript
// Run data migration to populate avatar field
await prisma.user.updateMany({
  where: { avatar: null },
  data: { avatar: 'default-avatar.png' }
});
```

**Step 3:** Make column required
```prisma
model User {
  avatar String // Step 3: Make required
}
```

### 3. Removing Columns

⚠️ **Requires Multi-Step Process:**

**Step 1:** Make column nullable and stop using in code
```prisma
model User {
  oldField String? // Step 1: Make nullable
}
```

**Step 2:** Deploy code without oldField references

**Step 3:** Remove column
```prisma
model User {
  // oldField removed
}
```

### 4. Renaming Columns

❌ **Not Safe:** Prisma treats renames as drop + add

**Alternative:** Create new column, migrate data, drop old column
```prisma
// Step 1: Add new column
model User {
  oldName String
  newName String?
}

// Step 2: Migrate data
// Step 3: Drop old column
model User {
  newName String
}
```

## Common Migration Patterns

### Adding Indexes

```prisma
model Session {
  @@index([owner_id, status, deleted_at])
  @@index([visibility, status, deleted_at])
}
```

### Adding Foreign Keys

```prisma
model SessionFile {
  session_id String
  session     Session @relation(fields: [session_id], references: [id], onDelete: Cascade)
}
```

### Enum Changes

Adding enum values is safe:
```prisma
enum UserRole {
  USER
  ADMIN
  MODERATOR // Adding is safe
}
```

Removing enum values requires checking usage first.

## Troubleshooting

### Migration Conflicts

```bash
# Reset development database
npx prisma migrate reset

# Regenerate migrations from schema
npx prisma migrate dev
```

### Failed Migration

```bash
# Mark failed migration as rolled back
npx prisma migrate resolve --rolled-back <migration-name>

# Fix the migration and retry
npx prisma migrate deploy
```

### Schema Drift

```bash
# Check for drift between schema and database
npx prisma migrate diff \
  --from-schema-datamodel prisma/schema.prisma \
  --to-schema-datasource prisma/schema.prisma

# Reset to match schema
npx prisma db push --force-reset
```

## Best Practices

1. **Always backup before migrations** - Especially in production
2. **Test migrations thoroughly** - Use staging environment
3. **Keep migrations small** - One logical change per migration
4. **Document complex migrations** - Add comments in migration files
5. **Use transactions** - Prisma migrations are transactional by default
6. **Monitor after deployment** - Watch for errors and performance issues
7. **Plan rollback strategy** - Before each migration
8. **Coordinate with team** - Notify of schema changes

## Environment-Specific Considerations

### Development
- Use `prisma migrate dev` for iterative development
- Reset database freely with `prisma migrate reset`
- Generate client after each schema change

### Staging
- Use `prisma migrate deploy` for applying migrations
- Test migrations before production
- Match production data patterns

### Production
- Always backup before migrations
- Use `prisma migrate deploy` only
- Never use `prisma migrate reset` or `prisma db push`
- Monitor application during migration
- Have rollback plan ready

## Automated Migration Checks

Add to CI/CD pipeline:

```yaml
- name: Check for pending migrations
  run: |
    npx prisma migrate status
    if [ $? -ne 0 ]; then
      echo "Pending migrations detected"
      exit 1
    fi
```

## Resources

- [Prisma Migrate Documentation](https://www.prisma.io/docs/concepts/components/prisma-migrate)
- [Production Troubleshooting](https://www.prisma.io/docs/guides/migrate/production-troubleshooting)
- [Migration Workflows](https://www.prisma.io/docs/guides/migrate/developing-with-prisma-migrate)
