# Hotfix: PIN Login & Reset Flow Fixes

## Summary
This hotfix resolves critical issues with PIN authentication for coaches, including login failures, CORS errors, and a complete overhaul of the PIN reset flow to match UX best practices.

## User-Facing Changes

### ✅ PIN Login Now Works
- Fixed PIN module loading issue that prevented coach login
- Coaches can now successfully log in with username and PIN
- Improved error handling and validation

### ✅ PIN Reset Flow Complete Overhaul
- **New "Forgot PIN" page** where coaches can request reset email
- Coaches only need to remember **either email OR username** (not both)
- Improved Reset PIN page with:
  - PINInput component (6 separate boxes matching login page)
  - Shows username being reset
  - Better error messages
  - Matches Login page styling (bg-app-gradient, u-glass, etc.)

### ✅ CORS Fixes
- Fixed CORS errors in development environment
- Properly handles localhost and 127.0.0.1 origins
- Dynamic origin detection for dev vs production

## Technical Changes

### API Endpoints

#### `api/auth/login.ts`
- Fixed PIN module import (changed from `require()` to direct `import`)
- Improved error handling to ensure JSON responses
- Removed debug logging
- Better validation error messages

#### `api/auth/reset-pin.ts`
- Added `validate` action to fetch username before showing reset form
- Updated `request` action to accept email OR username (not both required)
- Fixed Zod validation to handle empty strings from form inputs
- Returns username in reset response

### Frontend Components

#### `src/routes/auth/ForgotPin.tsx` (NEW)
- New page for requesting PIN reset
- Accepts email OR username
- Visual "eller" separator between fields
- Matches Login page styling

#### `src/routes/auth/ResetPin.tsx`
- Complete redesign to match Login page styling
- Uses PINInput component (6 separate boxes)
- Shows username being reset
- Validates token and fetches username on load
- Better error handling

#### `src/routes/auth/Login.tsx`
- Updated "Glemt PIN?" link to go to `forgot-pin` instead of `reset-pin`

#### `src/lib/utils/cors.ts`
- Improved CORS handling for development
- Prioritizes localhost/127.0.0.1 origin check
- Better origin detection logic

## Validation Steps

1. **PIN Login**
   - [x] Coach can log in with username and PIN
   - [x] Error messages are clear and helpful
   - [x] No CORS errors in development

2. **Forgot PIN Flow**
   - [x] Click "Glemt PIN?" from login page
   - [x] Enter email OR username (not both required)
   - [x] Receive reset email with token link
   - [x] Click link to go to Reset PIN page
   - [x] See username being reset
   - [x] Enter new PIN using 6-box input
   - [x] Confirm PIN matches
   - [x] Successfully reset PIN
   - [x] Redirected to login page

3. **UI/UX**
   - [x] All pages match design language
   - [x] PINInput component works correctly
   - [x] Error messages are user-friendly
   - [x] Loading states work correctly

## Risk Assessment

**Low Risk**
- Changes are isolated to authentication flow
- No database schema changes
- Backward compatible (existing flows still work)
- Extensive testing completed

## Rollback Plan

If issues arise:
1. Revert to previous commit before PIN login fixes
2. PIN login will be disabled (coaches can use admin reset)
3. No data loss risk

## Testing Coverage

- ✅ PIN login with valid credentials
- ✅ PIN login with invalid credentials
- ✅ Forgot PIN with email only
- ✅ Forgot PIN with username only
- ✅ Forgot PIN with both email and username
- ✅ Reset PIN with valid token
- ✅ Reset PIN with invalid/expired token
- ✅ CORS handling in development
- ✅ Error handling and validation

## Code Quality

- ✅ Removed debug logging
- ✅ Consistent error handling
- ✅ Proper TypeScript types
- ✅ Zod validation for all inputs
- ✅ No linting errors
