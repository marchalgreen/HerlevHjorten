# PIN Authentication Guide

This guide explains the PIN-based authentication system for coaches.

## Overview

Coaches use a 6-digit PIN code combined with a username for authentication. This provides a simpler login experience compared to traditional email/password authentication.

## PIN Format

- **Length**: Exactly 6 digits
- **Format**: Numeric only (0-9)
- **Examples**: `123456`, `000000`, `987654`

## PIN Security

### Hashing

PINs are hashed using Argon2id with stronger settings than passwords:

- **Memory Cost**: 64 MB
- **Time Cost**: 5 (higher than password's 3)
- **Output Length**: 32 bytes
- **Parallelism**: 4

This provides better security despite the shorter length.

### Storage

- PINs are never stored in plain text
- Only hashed PINs are stored in the database
- PIN reset tokens are hashed before storage

## Login Flow

### For Coaches

1. Navigate to login page
2. Select "Træner (PIN)" tab
3. Enter username
4. Enter 6-digit PIN
5. Click "Log ind"

### For Admins

1. Navigate to login page
2. Select "Administrator" tab
3. Enter email
4. Enter password
5. Click "Log ind"

## PIN Reset Flow

### Request Reset

1. Click "Glemt PIN?" on login page
2. Enter email address
3. Enter username
4. Click "Send reset link"

### Reset PIN

1. Receive email with reset link
2. Click link (expires in 1 hour)
3. Enter new 6-digit PIN
4. Confirm PIN
5. PIN is updated

## PIN Management

### Creating Coach with PIN

When creating a coach, you can:

1. **Auto-generate PIN**: System generates random 6-digit PIN
2. **Manual PIN**: Admin sets specific PIN
3. **Send Email**: Option to email PIN to coach

### Resetting Coach PIN

Tenant admins can reset a coach's PIN:

1. Navigate to coaches list
2. Find coach
3. Click "Reset PIN"
4. Coach receives email with reset link

## PIN Validation

### Client-Side

- PIN input accepts only numeric characters
- Maximum 6 characters
- Auto-formats as user types

### Server-Side

- Validates exactly 6 digits
- Checks format before hashing
- Returns clear error messages

## Best Practices

### For Coaches

- Don't share your PIN with others
- Use a memorable but secure PIN
- Reset PIN if compromised
- Don't use obvious patterns (e.g., `123456`, `000000`)

### For Admins

- Use auto-generated PINs when possible
- Send PINs via email, not SMS or chat
- Require PIN reset on first login (future feature)
- Monitor for suspicious login patterns

## Security Considerations

### PIN vs Password

- PINs are shorter but easier to remember
- Argon2 hashing compensates for shorter length
- Rate limiting prevents brute force attacks
- PIN reset requires email verification

### Rate Limiting

- Maximum 5 failed login attempts per 15 minutes
- 15-minute lockout after max attempts
- Lockout applies per username/email

### Email Verification

- PIN reset requires valid email
- Reset tokens expire after 1 hour
- Tokens are single-use only

## API Endpoints

### Login

```
POST /api/auth/login
{
  "username": "coach123",
  "pin": "123456",
  "tenantId": "herlev-hjorten"
}
```

### Request PIN Reset

```
POST /api/auth/reset-pin?action=request
{
  "email": "coach@example.com",
  "username": "coach123",
  "tenantId": "herlev-hjorten"
}
```

### Reset PIN

```
POST /api/auth/reset-pin?action=reset
{
  "token": "reset-token-from-email",
  "pin": "654321",
  "tenantId": "herlev-hjorten"
}
```

## Troubleshooting

### PIN Not Working

- Verify PIN is exactly 6 digits
- Check username is correct
- Ensure tenant_id matches
- Try resetting PIN

### Reset Email Not Received

- Check spam folder
- Verify email address
- Check RESEND_API_KEY is configured
- Wait a few minutes and try again

### PIN Reset Token Expired

- Request new reset link
- Tokens expire after 1 hour
- Each token can only be used once

## Implementation Details

### PIN Utilities

Located in `packages/webapp/src/lib/auth/pin.ts`:

- `validatePIN()` - Validates PIN format
- `hashPIN()` - Hashes PIN with Argon2
- `verifyPIN()` - Verifies PIN against hash
- `generateRandomPIN()` - Generates random 6-digit PIN
- `generatePINResetToken()` - Creates reset token
- `isPINResetTokenExpired()` - Checks token expiration

### Database Schema

PIN-related columns in `clubs` table:

- `pin_hash` - Hashed PIN (Argon2)
- `pin_reset_token` - Reset token (hashed)
- `pin_reset_expires` - Token expiration timestamp

## Future Enhancements

- PIN expiration (require reset every 90 days)
- PIN history (prevent reuse of recent PINs)
- PIN complexity requirements
- Biometric authentication (mobile)
- Two-factor authentication for coaches

