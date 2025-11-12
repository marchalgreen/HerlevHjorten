# RundeManager Demo - Quick Start Guide

## 🚀 Quick Setup (5 minutes)

### 1. Apply Database Schema

1. Go to your **RundeManagerDemoDB** project in Supabase dashboard
2. Open **SQL Editor** → **New query**
3. Copy entire contents of `supabase/migrations/000_complete_schema_for_new_db.sql`
4. Paste and click **Run**

### 2. Get Your Credentials

1. In Supabase: **Settings** → **API**
2. Copy **Project URL** (e.g., `https://xxxxx.supabase.co`)
3. Copy **anon public** key (starts with `eyJhbGci...`)

### 3. Configure Tenant

Edit `packages/webapp/src/config/tenants/rundemanager.json`:

```json
{
  "id": "rundemanager",
  "name": "RundeManager Demo",
  "logo": "logo.jpeg",
  "maxCourts": 8,
  "supabaseUrl": "YOUR_PROJECT_URL_HERE",
  "supabaseKey": "YOUR_ANON_KEY_HERE",
  "features": {}
}
```

### 4. Seed Courts (Required)

```bash
pnpm exec tsx packages/webapp/scripts/seed-courts.ts rundemanager
```

### 5. Seed Demo Data (Optional)

```bash
pnpm exec tsx packages/webapp/scripts/seed-demo-data.ts rundemanager
```

### 6. Test Locally

```bash
pnpm dev
```

Then visit: `http://127.0.0.1:5173/#/rundemanager/coach`

## 📋 Checklist

- [ ] Database schema applied in Supabase
- [ ] Tenant config updated with credentials
- [ ] Courts seeded
- [ ] Demo data seeded (optional)
- [ ] Local test successful

## 🔗 URLs

Once deployed, access via:
- Coach/Landing: `/#/rundemanager/coach`
- Check-in: `/#/rundemanager/check-in`
- Match Program: `/#/rundemanager/match-program`
- Players: `/#/rundemanager/players`
- Statistics: `/#/rundemanager/statistics`

## 🆘 Troubleshooting

**"Tenant config not found"**
- Check that `rundemanager.json` exists in `packages/webapp/src/config/tenants/`
- Verify JSON syntax is correct

**"Failed to connect to Supabase"**
- Double-check URL and key in tenant config
- Ensure RLS policies are set (they should allow public access)

**"Courts not showing"**
- Run: `pnpm exec tsx packages/webapp/scripts/seed-courts.ts rundemanager`

## 📚 Full Documentation

See `docs/RUNDEMANAGER_SETUP.md` for detailed instructions.

