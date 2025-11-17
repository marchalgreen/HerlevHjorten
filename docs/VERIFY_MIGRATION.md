# Verify Migration Status

## Check Current State

Run these queries to understand your current database state:

### 1. Check if default tenant exists
```sql
SELECT COUNT(*) FROM clubs WHERE tenant_id = 'default';
```

**Expected results:**
- If > 0: You have data that needs migration
- If 0: Either migration already ran, or database is empty

### 2. Check if herlev-hjorten tenant exists
```sql
SELECT COUNT(*) FROM clubs WHERE tenant_id = 'herlev-hjorten';
```

**Expected results:**
- If > 0: Migration 010 already ran successfully
- If 0: Migration 010 hasn't run yet, or database is empty

### 3. Check all tenants
```sql
SELECT tenant_id, COUNT(*) as count 
FROM clubs 
GROUP BY tenant_id;
```

This shows all tenant IDs in your database.

## Migration Scenarios

### Scenario 1: Database is Empty (0 clubs)
If both queries return 0, your database is empty. You need to:

1. **Create initial admin user** (after running migration 008):
   ```sql
   -- You'll need to hash a password first using the app or a script
   -- This is just an example - use proper password hashing!
   INSERT INTO clubs (tenant_id, email, password_hash, role, email_verified)
   VALUES (
     'herlev-hjorten',
     'admin@example.com',
     '$argon2id$v=19$m=65536,t=3,p=4$...', -- Use proper hash!
     'admin',
     true
   );
   ```

2. **Or use the migration script**:
   ```bash
   cd packages/webapp
   pnpm exec tsx scripts/migrate-default-to-herlev-hjorten.ts
   ```

### Scenario 2: Default Tenant Exists (needs migration)
If `default` exists but `herlev-hjorten` doesn't:

1. **Run migration 010** to rename default → herlev-hjorten
2. **Verify** the migration worked:
   ```sql
   SELECT COUNT(*) FROM clubs WHERE tenant_id = 'herlev-hjorten';
   ```

### Scenario 3: Migration Already Complete
If `herlev-hjorten` exists and `default` doesn't:

✅ Migration is complete! You can proceed with:
- Creating coaches
- Testing login
- Setting up admin users

## Next Steps Based on Results

### If you have 0 clubs total:
1. Run migration 008 (adds role, PIN columns)
2. Run migration 010 (creates herlev-hjorten config)
3. Create your first admin user manually or via API

### If you have clubs with tenant_id='default':
1. Run migration 010 to rename them to 'herlev-hjorten'
2. Verify the rename worked
3. Update any existing admin users to have role='admin'

### If you have clubs with tenant_id='herlev-hjorten':
✅ You're all set! Migrations are complete.

