# Fix for Vercel Wildcard Domain Configuration

## Problem

Vercel shows "Invalid Configuration" for `*.rundeklar.dk` because it requires Vercel nameservers to verify wildcard domains. However, you're using Dynadot DNS with CNAME records.

## Solution: Add Specific Subdomain

Since `demo.rundeklar.dk` works with CNAME, we can add a specific CNAME for `herlev-hjorten`:

### In Dynadot DNS Settings:

1. Add a new subdomain record:
   - **Subdomain:** `herlev-hjorten`
   - **Record Type:** `CNAME`
   - **IP Address / Destination:** `cname.vercel-dns.com` (same as wildcard)
   - **TTL:** 5 minutes

2. Save the changes

### In Vercel:

1. Go to **Project Settings** → **Domains**
2. Click **Add Domain**
3. Enter: `herlev-hjorten.rundeklar.dk`
4. Click **Add**

Vercel will verify this specific subdomain using the CNAME record (just like `demo.rundeklar.dk`).

## Alternative: Use Vercel Nameservers

If you want the wildcard to work properly in Vercel:

1. **In Dynadot:**
   - Change nameservers from "Dynadot DNS" to custom nameservers
   - Set to: `ns1.vercel-dns.com` and `ns2.vercel-dns.com`

2. **In Vercel:**
   - The `*.rundeklar.dk` domain should automatically become valid
   - All subdomains will work automatically

**Note:** Changing nameservers means you'll manage DNS records in Vercel instead of Dynadot.

## Recommended Approach

For now, add the specific `herlev-hjorten` CNAME record in Dynadot and add `herlev-hjorten.rundeklar.dk` in Vercel. This is the quickest solution and matches how `demo.rundeklar.dk` is configured.

