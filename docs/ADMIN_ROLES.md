# Admin Roller og Niveauer

## Roller i Systemet

Systemet har tre roller, arrangeret i hierarki:

### 1. Super Admin (Højeste Niveau) 🔴
**Rolle:** `super_admin`

**Rettigheder:**
- Kan oprette og administrere alle tenants
- Kan oprette og administrere tenant admin brugere
- Kan se alle tenants og deres data (read-only)
- Kan slette tenants (soft delete)
- Har adgang til super admin modulet

**Brug:**
- Platform administratorer
- System operatører
- Initial setup

**Login:** Email + Password

### 2. Admin / Tenant Admin (Mellem Niveau) 🟡
**Rolle:** `admin`

**Rettigheder:**
- Kan oprette og administrere coaches i sin egen tenant
- Kan nulstille coach PINs
- Kan slette coaches
- Kan se alle coaches i sin tenant
- Har adgang til tenant admin modulet
- **IKKE** adgang til super admin modulet

**Brug:**
- Klub administratorer
- Badminton klub managers
- Tenant ejere

**Login:** Email + Password

### 3. Coach (Standard Bruger) 🟢
**Rolle:** `coach`

**Rettigheder:**
- Kan tilgå tenant features
- Kan checke spillere ind
- Kan se match program
- Kan se statistikker
- **INGEN** admin rettigheder

**Brug:**
- Badminton trænere
- Trænings personale
- Standard brugere

**Login:** Username + PIN (6 cifre)

## Opgradering til Super Admin

For at opgradere en bruger til super admin, kør denne SQL:

```sql
UPDATE clubs 
SET role = 'super_admin' 
WHERE email = 'din-email@example.com';
```

**Efter opgradering:**
1. Log ud og log ind igen for at opdatere JWT token
2. Du vil nu se "Admin" menu i navigationen
3. Klik på "Admin" for at se super admin modulet

## Tjek Nuværende Rolle

For at se din nuværende rolle:

```sql
SELECT email, role, tenant_id 
FROM clubs 
WHERE email = 'din-email@example.com';
```

## Rolle Hierarki

```
Super Admin (super_admin)
    ↓
Admin (admin)
    ↓
Coach (coach)
```

Højere roller arver rettigheder fra lavere roller.

