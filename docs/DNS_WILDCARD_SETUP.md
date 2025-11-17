# Wildcard DNS Setup Guide

This guide explains how to configure wildcard DNS for multi-tenant subdomains under `rundeklar.dk`.

## Overview

With wildcard DNS, any subdomain like `herlev-hjorten.rundeklar.dk` or `demo.rundeklar.dk` will automatically route to your Vercel deployment. This eliminates the need to manually configure DNS for each new tenant.

## DNS Configuration

### Step 1: Add Wildcard CNAME Record

In your DNS provider (e.g., Cloudflare, Namecheap, GoDaddy), add a wildcard CNAME record:

```
Type: CNAME
Name: *
Value: cname.vercel-dns.com (or your Vercel CNAME target)
TTL: Auto (or 3600)
```

**Note:** The `*` represents any subdomain. This means:
- `herlev-hjorten.rundeklar.dk` → routes to Vercel
- `demo.rundeklar.dk` → routes to Vercel
- `any-club.rundeklar.dk` → routes to Vercel

### Step 2: Add Specific Subdomains (Optional but Recommended)

For important subdomains, you can also add explicit CNAME records:

```
Type: CNAME
Name: demo
Value: cname.vercel-dns.com
TTL: Auto

Type: CNAME
Name: herlev-hjorten
Value: cname.vercel-dns.com
TTL: Auto
```

This provides redundancy and faster DNS resolution.

### Step 3: Verify DNS Propagation

Use `dig` or online DNS checker to verify:

```bash
dig demo.rundeklar.dk
dig herlev-hjorten.rundeklar.dk
dig test-subdomain.rundeklar.dk
```

All should resolve to Vercel's IP addresses.

## Vercel Configuration

### Step 1: Add Wildcard Domain

1. Go to your Vercel project dashboard
2. Navigate to **Settings** → **Domains**
3. Click **Add Domain**
4. Enter: `*.rundeklar.dk`
5. Click **Add**

Vercel will automatically provision SSL certificates for all subdomains via Let's Encrypt.

### Step 2: Verify Domain Ownership

Vercel will provide DNS verification records. Add these to your DNS provider:

```
Type: TXT
Name: _vercel
Value: [verification token from Vercel]
```

### Step 3: Wait for SSL Provisioning

Vercel automatically provisions SSL certificates for wildcard domains. This typically takes 5-10 minutes.

## Testing

### Test Subdomain Detection

1. Visit `herlev-hjorten.rundeklar.dk` → Should load Herlev/Hjorten tenant
2. Visit `demo.rundeklar.dk` → Should load demo tenant
3. Visit `test-club.rundeklar.dk` → Should detect tenant from subdomain

### Verify SSL

All subdomains should have valid SSL certificates:
- ✅ `https://herlev-hjorten.rundeklar.dk`
- ✅ `https://demo.rundeklar.dk`
- ✅ `https://test-club.rundeklar.dk`

## Troubleshooting

### DNS Not Resolving

- Check DNS propagation: Use `dig` or [dnschecker.org](https://dnschecker.org)
- Verify CNAME record is correct
- Wait up to 48 hours for full propagation

### SSL Certificate Issues

- Wait 10-15 minutes after adding domain in Vercel
- Check Vercel dashboard for certificate status
- Verify DNS records are correct

### Subdomain Not Detected

- Check tenant config file exists: `packages/webapp/src/config/tenants/[subdomain].json`
- Verify `getCurrentTenantId()` logic in `packages/webapp/src/lib/tenant.ts`
- Check browser console for errors

## Common DNS Providers

### Cloudflare

1. Go to **DNS** → **Records**
2. Click **Add record**
3. Type: `CNAME`
4. Name: `*`
5. Target: `cname.vercel-dns.com`
6. Proxy status: Proxied (orange cloud) or DNS only (gray cloud)
7. Click **Save**

### Namecheap

1. Go to **Domain List** → **Manage**
2. Go to **Advanced DNS**
3. Click **Add New Record**
4. Type: `CNAME Record`
5. Host: `*`
6. Value: `cname.vercel-dns.com`
7. TTL: Automatic
8. Click **Save**

### GoDaddy

1. Go to **DNS Management**
2. Click **Add**
3. Type: `CNAME`
4. Name: `*`
5. Value: `cname.vercel-dns.com`
6. TTL: 1 hour
7. Click **Save**

## Security Considerations

- Wildcard DNS means ANY subdomain will route to your app
- Ensure tenant detection logic properly validates subdomains
- Consider rate limiting per subdomain
- Monitor for abuse (e.g., random subdomain requests)

## Next Steps

After DNS is configured:

1. Run tenant migration script: `pnpm exec tsx scripts/migrate-default-to-herlev-hjorten.ts`
2. Create tenant configs for each club
3. Test subdomain routing
4. Update documentation with new tenant URLs

