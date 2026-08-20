# Security

## Admin Authentication

Admin authentication uses Supabase Auth with email/password (`signInWithPassword`).

**Flow:**
```
Login form → Supabase Auth → Verify admin_users → Session cookie
```

**Authorization model:**
```
auth.uid()  →  admin_users.user_id  →  is_admin() = true
```

- No customer signup exists — only admin login
- No self-promotion — admin records are manually inserted via SQL
- Non-admin users who authenticate are immediately signed out

### First Admin Bootstrap

1. Create an Auth user in Supabase Dashboard (Authentication → Users → Add user)
2. Copy the user's UUID
3. Insert into admin_users:
   ```sql
   INSERT INTO admin_users (user_id) VALUES ('your-uuid-here');
   ```

**NEVER** hard-code admin credentials in code or migrations.

## RLS Policies

All tables have Row Level Security enabled.

| Table | Anonymous | Authenticated (non-admin) | Admin (`is_admin()`) | Service Role |
|-------|-----------|--------------------------|---------------------|-------------|
| categories | SELECT (active only) | SELECT (active only) | ALL | ALL |
| products | SELECT (active only) | SELECT (active only) | ALL | ALL |
| product_files | ❌ | ❌ | ALL | ALL |
| admin_users | ❌ | SELECT own row only | SELECT own row | ALL |
| customers | ❌ | ❌ | ❌ | ALL |
| orders | ❌ | ❌ | ❌ | ALL |
| order_items | ❌ | ❌ | ❌ | ALL |
| download_tokens | ❌ | ❌ | ❌ | ALL |

### `private.is_admin()` Function

PostgreSQL function used in RLS policies. Lives in the `private` schema (NOT `public`) so it is never exposed through the Supabase Data API / PostgREST:
- `SECURITY DEFINER` — avoids RLS recursion when checking admin_users
- `STABLE` — safe for repeated evaluation within a query
- `SET search_path = ''` — prevents search_path hijacking attacks
- Always reads `auth.uid()` — never accepts user_id parameter from client
- `EXECUTE` revoked from `PUBLIC` and `anon`; granted only to `authenticated` and `service_role`
- The `private` schema must NOT be added to Supabase's exposed schemas (API Settings → Data API)

## Storage Security

| Bucket | Visibility | Read | Write | Content |
|--------|-----------|------|-------|---------|
| `product-assets` | PUBLIC | anon, authenticated | admin only | Thumbnails, preview images |
| `product-files` | PRIVATE | admin only | admin only | Product .docx files |

### Storage Path Convention

```
product-assets:  products/{product_id}/assets/{filename}
product-files:   products/{product_id}/files/{uuid}.docx
```

Product files (.docx) are **NEVER** publicly accessible. Downloads are served via time-limited signed URLs after download token validation (future milestone).

## Environment Variables

Server-only secrets (without `NEXT_PUBLIC_` prefix):
- `SUPABASE_SERVICE_ROLE_KEY`
- `PAYMENT_PROVIDER_API_KEY`
- `PAYMENT_PROVIDER_SECRET`
- `EMAIL_API_KEY`
- `ADMIN_SECRET_KEY`

These MUST NEVER appear in client-side code or browser network requests.

## Price Calculation

Prices are **ALWAYS calculated server-side** from database values.

```
❌ Client sends totalAmount → Server trusts it
✅ Client sends productIds → Server looks up prices → Server calculates total
```

This prevents price manipulation attacks.

## Order Lookup

Order lookup requires both `orderCode` AND `email` to match. This prevents:
- Order enumeration attacks
- Unauthorized access to order details

## Download Security

See [digital-delivery.md](digital-delivery.md) for download token security.

## Health Check

`GET /api/health/supabase` returns only:
```json
{"status": "ok"}
```
or:
```json
{"status": "degraded"}
```

No internal errors, schema names, or credentials are exposed. Detailed errors are logged server-side only. This route should be removed or protected before production.
