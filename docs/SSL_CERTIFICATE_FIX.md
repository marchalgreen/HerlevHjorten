# SSL Certificate Fix for Subdomains

## Problem

After switching to Vercel nameservers, HTTPS doesn't work because SSL certificates haven't been provisioned yet.

## Solution

### Option 1: Wait for Automatic Provisioning (Recommended)

Vercel automatically provisions SSL certificates via Let's Encrypt, but this can take:
- **5-15 minutes** after nameserver change
- **Up to 24 hours** in rare cases

### Option 2: Force SSL Provisioning in Vercel

1. Go to **Vercel Dashboard** → **Project Settings** → **Domains**
2. Find `*.rundeklar.dk` (should show "Valid Configuration")
3. Click **Refresh** button next to it
4. Vercel will attempt to provision SSL immediately

### Option 3: Add Specific Subdomain in Vercel

Sometimes adding the specific subdomain helps trigger SSL:

1. Go to **Vercel Dashboard** → **Project Settings** → **Domains**
2. Click **Add Domain**
3. Enter: `herlev-hjorten.rundeklar.dk`
4. Click **Add**
5. Wait 5-10 minutes for SSL provisioning

## Check SSL Status

### In Vercel Dashboard:
- Go to **Domains** section
- Look for SSL certificate status (should show green checkmark when ready)

### Test SSL:
```bash
# Check SSL certificate
openssl s_client -connect herlev-hjorten.rundeklar.dk:443 -servername herlev-hjorten.rundeklar.dk

# Or use online tool
# https://www.ssllabs.com/ssltest/analyze.html?d=herlev-hjorten.rundeklar.dk
```

## Temporary Workaround

While waiting for SSL:
- Use `http://herlev-hjorten.rundeklar.dk` (works but shows "Not secure")
- Or wait for SSL certificate to be provisioned

## Expected Timeline

- **Nameserver propagation:** 5-15 minutes
- **Vercel domain validation:** 5-10 minutes  
- **SSL certificate provisioning:** 5-15 minutes after domain is valid
- **Total:** 15-40 minutes typically

## Troubleshooting

If SSL doesn't provision after 1 hour:

1. **Check domain status in Vercel:**
   - Should show "Valid Configuration"
   - Should show SSL certificate status

2. **Verify DNS propagation:**
   ```bash
   dig herlev-hjorten.rundeklar.dk
   # Should resolve to Vercel IPs
   ```

3. **Check Vercel logs:**
   - Go to **Deployments** → Latest deployment → **Functions** tab
   - Look for SSL-related errors

4. **Contact Vercel support** if issue persists

