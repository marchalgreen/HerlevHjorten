# Admin Module Guide

This guide explains how to use the admin module for managing tenants, users, and coaches.

## Overview

The admin module provides three levels of access:

1. **Super Admin** - Manages all tenants and tenant admins
2. **Tenant Admin** - Manages coaches within their tenant
3. **Coach** - Standard user with no admin access

## Super Admin Features

### Accessing Super Admin

1. Log in with a super admin account (email/password)
2. Navigate to **Admin** in the main menu
3. You'll see the tenants management interface

### Managing Tenants

#### Create New Tenant

1. Click **Create Tenant** (or navigate to `/admin/tenants/new`)
2. Fill in:
   - **Name**: Tenant display name (e.g., "Herlev Hjorten")
   - **Subdomain**: Auto-generated from name, or customize (e.g., "herlev-hjorten")
   - **Logo**: Logo filename (optional)
   - **Max Courts**: Maximum number of courts (default: 8)
   - **Admin Email**: Email for the initial tenant admin user
   - **Admin Password**: Password for the initial tenant admin user
3. Click **Create Tenant**

The system will:
- Create tenant config file
- Create admin user in database
- Set up subdomain mapping

#### List All Tenants

- View all tenants with user counts
- See subdomain for each tenant
- Access tenant details

#### Manage Tenant Admins

1. Navigate to tenant details
2. Click **Manage Admins**
3. Create new admin users for the tenant
4. View existing admin users

## Tenant Admin Features

### Accessing Tenant Admin

1. Log in with a tenant admin account (email/password)
2. Navigate to **Admin** in the main menu
3. You'll see the coaches management interface

### Managing Coaches

#### Create New Coach

1. Click **Create Coach**
2. Fill in:
   - **Email**: Coach email address
   - **Username**: Unique username (3-50 characters)
   - **PIN**: 6-digit PIN (or auto-generate)
   - **Send Email**: Option to send welcome email with PIN
3. Click **Create Coach**

**Note:** Username must be unique within the tenant. PIN can be auto-generated or manually set.

#### List Coaches

- View all coaches in your tenant
- See last login time
- Access coach management actions

#### Reset Coach PIN

1. Find the coach in the list
2. Click **Reset PIN**
3. Coach will receive an email with PIN reset link

#### Delete Coach

1. Find the coach in the list
2. Click **Delete**
3. Confirm deletion

**Warning:** This action cannot be undone.

## Role-Based Access

### Super Admin

- Can access all tenants
- Can create/manage tenants
- Can create/manage tenant admins
- Can access any tenant's coaches (read-only)

### Tenant Admin

- Can only access their own tenant
- Can create/manage coaches in their tenant
- Cannot access other tenants
- Cannot create/manage other tenant admins

### Coach

- No admin access
- Uses PIN login (username + 6-digit PIN)
- Can reset PIN via email

## PIN Management

### For Coaches

Coaches use a 6-digit PIN for login:

1. **Login**: Username + PIN
2. **Reset PIN**: Click "Forgot PIN?" on login page
   - Enter email and username
   - Receive reset link via email
   - Set new PIN

### For Admins

Admins use email/password login:

1. **Login**: Email + Password
2. **Reset Password**: Standard password reset flow
3. **2FA**: Optional two-factor authentication

## API Endpoints

### Super Admin

- `GET /api/admin/tenants` - List all tenants
- `POST /api/admin/tenants` - Create tenant
- `GET /api/admin/tenants/:id` - Get tenant details
- `PUT /api/admin/tenants/:id` - Update tenant
- `DELETE /api/admin/tenants/:id` - Delete tenant (soft)
- `GET /api/admin/tenants/:id/admins` - List tenant admins
- `POST /api/admin/tenants/:id/admins` - Create tenant admin

### Tenant Admin

- `GET /api/:tenantId/admin/coaches` - List coaches
- `POST /api/:tenantId/admin/coaches` - Create coach
- `GET /api/:tenantId/admin/coaches/:id` - Get coach details
- `PUT /api/:tenantId/admin/coaches/:id` - Update coach
- `DELETE /api/:tenantId/admin/coaches/:id` - Delete coach
- `POST /api/:tenantId/admin/coaches/:id` (action: reset-pin) - Reset coach PIN

## Security Considerations

- All admin endpoints require authentication
- Role-based authorization enforced at API level
- PIN resets expire after 1 hour
- Rate limiting on login attempts
- Tenant isolation enforced in all queries

## Troubleshooting

### Cannot Access Admin Module

- Verify your role is `admin` or `super_admin`
- Check JWT token includes role
- Ensure tenant_id matches your tenant

### Cannot Create Coach

- Verify username is unique within tenant
- Check email format is valid
- Ensure PIN is exactly 6 digits

### PIN Reset Email Not Received

- Check spam folder
- Verify email address is correct
- Check RESEND_API_KEY is configured
- Verify email service is working

## Next Steps

- See [PIN_AUTHENTICATION.md](./PIN_AUTHENTICATION.md) for PIN details
- See [ROLES_AND_PERMISSIONS.md](./ROLES_AND_PERMISSIONS.md) for role system
- See [DNS_WILDCARD_SETUP.md](./DNS_WILDCARD_SETUP.md) for subdomain setup

