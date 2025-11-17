# Verify Multi-Tenant Setup

## ✅ Current Status

Your database shows 2 clubs/users for `herlev-hjorten` tenant. Let's verify everything is set up correctly.

## Verification Queries

Run these queries to verify your setup:

### 1. Check user roles
```sql
SELECT id, email, role, tenant_id, email_verified, created_at
FROM clubs
WHERE tenant_id = 'herlev-hjorten'
ORDER BY created_at;
```

**Expected:** Should show your admin users with `role = 'admin'` or `role = 'super_admin'`

### 2. Verify migrations were applied
```sql
-- Check if all new columns exist
SELECT column_name, data_type, is_nullable
FROM information_schema.columns 
WHERE table_name = 'clubs' 
  AND column_name IN ('role', 'username', 'pin_hash', 'pin_reset_token', 'pin_reset_expires')
ORDER BY column_name;
```

**Expected:** Should show all 5 columns

### 3. Check constraints
```sql
-- Verify composite unique constraints exist
SELECT conname, pg_get_constraintdef(oid) as definition
FROM pg_constraint
WHERE conrelid = 'clubs'::regclass
  AND contype = 'u'
  AND conname IN ('clubs_email_tenant_unique', 'clubs_username_tenant_unique');
```

**Expected:** Should show both constraints

### 4. Check other tables have tenant_id
```sql
-- Verify all tables have tenant_id column
SELECT table_name, column_name
FROM information_schema.columns
WHERE column_name = 'tenant_id'
  AND table_name IN ('players', 'training_sessions', 'check_ins', 'matches', 'courts')
ORDER BY table_name;
```

**Expected:** Should show tenant_id column in all tables

## Next Steps

### 1. Test Login

1. **Start the app:**
   ```bash
   cd packages/webapp
   pnpm dev
   ```

2. **Test Admin Login:**
   - Go to login page
   - Select "Administrator" tab
   - Log in with one of your admin emails
   - Should see admin menu in navigation

3. **Test PIN Login (if you have coaches):**
   - Go to login page
   - Select "Træner (PIN)" tab
   - Log in with username + PIN
   - Should access standard features

### 2. Create Coaches (Optional)

If you want to create coaches for testing:

1. Log in as admin
2. Navigate to Admin → Coaches
3. Click "Opret træner"
4. Fill in email, username, and PIN
5. Save

### 3. Verify Tenant Detection

Test that subdomain detection works:

1. **Local development:**
   - App should detect tenant from URL or default to `herlev-hjorten`

2. **Production (after DNS setup):**
   - `herlev-hjorten.rundeklar.dk` → should load herlev-hjorten tenant
   - `demo.rundeklar.dk` → should load demo tenant
   - `rundeklar.dk` → should load marketing site (or herlev-hjorten)

## Troubleshooting

### Can't log in?

1. **Check user exists:**
   ```sql
   SELECT email, role, email_verified FROM clubs WHERE email = 'your-email@example.com';
   ```

2. **Verify email_verified is true:**
   ```sql
   UPDATE clubs SET email_verified = true WHERE email = 'your-email@example.com';
   ```

3. **Check password hash exists:**
   ```sql
   SELECT email, password_hash IS NOT NULL as has_password FROM clubs WHERE email = 'your-email@example.com';
   ```

### Admin menu not showing?

1. **Check role in database:**
   ```sql
   SELECT email, role FROM clubs WHERE email = 'your-email@example.com';
   ```

2. **Should be 'admin' or 'super_admin'**

3. **Check JWT token includes role:**
   - Open browser DevTools → Application → Local Storage
   - Find `auth_access_token`
   - Decode at jwt.io
   - Should include `role` field

### Tenant detection not working?

1. **Check tenant config file exists:**
   ```bash
   ls packages/webapp/src/config/tenants/herlev-hjorten.json
   ```

2. **Verify subdomain in config:**
   ```json
   {
     "id": "herlev-hjorten",
     "subdomain": "herlev-hjorten",
     ...
   }
   ```

3. **Check getCurrentTenantId() logic:**
   - Should detect subdomain from hostname
   - Should fallback to 'herlev-hjorten' for localhost

## Success Checklist

- [ ] Migrations 007, 008, 010 all ran successfully
- [ ] 2+ users exist with tenant_id = 'herlev-hjorten'
- [ ] Users have role = 'admin' or 'super_admin'
- [ ] Can log in as admin
- [ ] Admin menu appears in navigation
- [ ] Can access admin module
- [ ] Tenant config file exists
- [ ] App starts without errors

## Need Help?

If something doesn't work:

1. Check browser console for errors
2. Check API responses in Network tab
3. Verify database state with queries above
4. Check that all migrations ran successfully
5. Ensure environment variables are set correctly

