# Automated Subdomain Setup Guide

## Problem

With manual CNAME records, you need to add each subdomain manually in both DNS and Vercel, which defeats the purpose of automation.

## Solution 1: Use Vercel Nameservers (Recommended)

### Benefits
- ✅ Wildcard domain `*.rundeklar.dk` works automatically
- ✅ All subdomains work without manual DNS configuration
- ✅ New tenants automatically get working subdomains
- ✅ SSL certificates auto-provision for all subdomains

### Setup Steps

#### 1. In Dynadot:
1. Go to **Domain Management** → **rundeklar.dk**
2. Find **Nameservers** section
3. Change from "Dynadot DNS" to **Custom Nameservers**
4. Set nameservers to:
   - `ns1.vercel-dns.com`
   - `ns2.vercel-dns.com`
5. Save changes

#### 2. In Vercel:
1. Go to **Project Settings** → **Domains**
2. The `*.rundeklar.dk` wildcard should automatically become "Valid Configuration"
3. Wait 5-15 minutes for DNS propagation

#### 3. DNS Records in Vercel:
After switching nameservers, you'll manage DNS in Vercel instead of Dynadot:

1. Go to **Vercel Dashboard** → **Settings** → **Domains** → **DNS**
2. Add any custom DNS records you need (A, CNAME, MX, TXT, etc.)
3. Vercel automatically handles wildcard subdomains

### What Happens Next

- Any subdomain like `herlev-hjorten.rundeklar.dk` automatically routes to your Vercel deployment
- SSL certificates are auto-provisioned via Let's Encrypt
- No manual DNS configuration needed for new tenants

## Solution 2: Automate via Vercel API (Alternative)

If you want to keep Dynadot DNS but automate domain addition:

### Use Vercel API to Add Domains Programmatically

When creating a new tenant via admin panel, automatically add the domain:

```typescript
// In packages/webapp/api/admin/tenants.ts (POST handler)
import { Vercel } from '@vercel/node'

async function addDomainToVercel(subdomain: string) {
  const vercel = new Vercel({
    token: process.env.VERCEL_TOKEN
  })
  
  await vercel.domains.create({
    name: `${subdomain}.rundeklar.dk`,
    projectId: process.env.VERCEL_PROJECT_ID
  })
}
```

**Limitations:**
- Still need to add CNAME in Dynadot manually (or automate via Dynadot API)
- More complex setup
- Requires API tokens

## Recommendation

**Use Solution 1 (Vercel Nameservers)** because:
- Fully automated - no manual steps for new tenants
- Simpler to maintain
- Better integration with Vercel platform
- Automatic SSL provisioning

## Migration Checklist

- [ ] Backup current DNS records from Dynadot
- [ ] Note any custom DNS records (MX, TXT, etc.)
- [ ] Change nameservers in Dynadot to Vercel
- [ ] Add custom DNS records in Vercel (if needed)
- [ ] Verify `*.rundeklar.dk` becomes valid in Vercel
- [ ] Test `herlev-hjorten.rundeklar.dk` works
- [ ] Test `demo.rundeklar.dk` still works
- [ ] Update documentation

## Testing After Migration

1. **Test existing subdomains:**
   ```bash
   dig demo.rundeklar.dk
   dig herlev-hjorten.rundeklar.dk
   ```

2. **Test new subdomain:**
   ```bash
   dig test-club.rundeklar.dk
   # Should resolve to Vercel IPs
   ```

3. **Visit in browser:**
   - `https://herlev-hjorten.rundeklar.dk` → Should load app
   - `https://test-club.rundeklar.dk` → Should load app (even without tenant config, will show error or fallback)

