# Quick Subdomain Test Guide

## Test Tenant Detection Locally

### Option 1: Edit /etc/hosts (macOS/Linux)

1. Edit `/etc/hosts`:
   ```bash
   sudo nano /etc/hosts
   ```

2. Add these lines:
   ```
   127.0.0.1 herlev-hjorten.rundeklar.dk
   127.0.0.1 demo.rundeklar.dk
   ```

3. Start dev server:
   ```bash
   pnpm dev
   ```

4. Visit:
   - `http://herlev-hjorten.rundeklar.dk:5173` → Should detect `herlev-hjorten` tenant
   - `http://demo.rundeklar.dk:5173` → Should detect `demo` tenant

### Option 2: Use Browser DevTools

1. Open browser DevTools (F12)
2. Go to **Network** tab
3. Right-click on any request → **Edit and Resend**
4. Change `Host` header to `herlev-hjorten.rundeklar.dk`
5. Or use browser extension to modify hostname

### Option 3: Test in Production

After DNS and Vercel are configured:
- Visit `https://herlev-hjorten.rundeklar.dk`
- Check browser console for tenant detection logs
- Verify tenant config loads correctly

## Verify Tenant Detection

Open browser console and check:
```javascript
// Should log tenant detection
console.log('Current tenant:', getCurrentTenantId())
```

Expected output:
- `herlev-hjorten.rundeklar.dk` → `"herlev-hjorten"`
- `demo.rundeklar.dk` → `"demo"`
- `localhost:5173` → `"herlev-hjorten"` (fallback)

