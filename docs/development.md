# Development Guide

## Prerequisites

- Node.js 18+
- npm

## Setup

```bash
# Install dependencies
npm install

# Copy environment file
cp .env.example .env.local

# Start development server
npm run dev
```

## Development Without Supabase

The application works without Supabase credentials using mock data. This allows frontend development without a database.

When Supabase credentials are not configured:
- Product queries return mock data (8 products, 10 categories)
- Checkout creates orders in memory (not persisted)
- Admin login will fail (requires Supabase Auth)
- Download validation always returns "not configured"

## Code Quality

```bash
npm run lint       # ESLint
npx tsc --noEmit   # TypeScript strict check
npm run build      # Production build
npm run test       # Vitest
npm audit --omit=dev  # Security audit
```

## Project Conventions

### File Naming
- Components: PascalCase (`ProductCard.tsx`)
- Utilities: camelCase (`utils.ts`)
- Pages: `page.tsx` (Next.js convention)

### Import Aliases
Use `@/` for absolute imports from `src/`:
```typescript
import { siteConfig } from "@/config/site";
```

### Server vs Client Components
- Default: Server Component
- Add `"use client"` only when using: `useState`, `useEffect`, event handlers, browser APIs

### Validation
- All user input validated with Zod schemas
- Schemas defined in `features/*/schema.ts`
- Shared schemas in `lib/validation/common.ts`

## Database

### Applying Migrations

Migrations must be applied in order to the Supabase database. Options:

**Option A: Supabase CLI (recommended)**
```bash
# Install Supabase CLI
npm install -g supabase

# Link to your project
supabase link --project-ref <project-ref>

# Push migrations
supabase db push

# Seed demo data (optional, development only)
supabase db seed
```

**Option B: Supabase Dashboard SQL Editor**
1. Open the SQL Editor in your Supabase Dashboard
2. Run each migration file in order: 001 → 002 → 003 → 004
3. Optionally run `seed.sql` for demo data

### Adding a New Migration
1. Create `supabase/migrations/NNN_description.sql`
2. Update TypeScript types in `src/types/database.ts`
3. Update feature types if needed

### Generating TypeScript Types
After applying migrations:
```bash
npx supabase gen types typescript --project-id <project-id> > src/types/database.ts
```

## Admin Setup

### First Admin Bootstrap

After applying migrations, bootstrap the first admin:

1. **Create Auth user** in Supabase Dashboard → Authentication → Users → Add user
   - Set email and password
   - Confirm the user's email
2. **Copy the user's UUID** from the user details
3. **Insert into admin_users** via SQL Editor:
   ```sql
   INSERT INTO admin_users (user_id) VALUES ('paste-uuid-here');
   ```
4. **Test login** at `/admin/login` with the email/password

**IMPORTANT**: Never hard-code admin credentials in code or migrations.

### Admin Route Structure

```
/admin/login    — Login page (NOT protected)
/admin/*        — All other admin routes (protected by requireAdmin())
```

## Storage

### Bucket Structure

| Bucket | Access | Purpose |
|--------|--------|---------|
| `product-assets` | Public read, admin write | Thumbnails, preview images |
| `product-files` | Admin only | Product .docx files |

### Path Convention

```
product-assets:  products/{product_id}/assets/{filename}
product-files:   products/{product_id}/files/{uuid}.docx
```

## Payment Provider: payOS

### Setup Steps

1. **Create payOS merchant account** at [my.payos.vn](https://my.payos.vn)
2. **Verify your account** (KYC, bank account link)
3. **Create a Payment Channel** in the dashboard
4. **Obtain credentials** from Integration Info:
   - Client ID
   - API Key
   - Checksum Key
5. **Add to `.env.local`** (NEVER commit these):
   ```
   PAYOS_CLIENT_ID=your_client_id
   PAYOS_API_KEY=your_api_key
   PAYOS_CHECKSUM_KEY=your_checksum_key
   ```
6. **Configure webhook URL** in payOS dashboard:
   ```
   https://your-domain.com/api/payments/payos/webhook
   ```
7. **Configure Return URL** in payOS dashboard:
   ```
   https://your-domain.com/order/success
   ```
8. **Configure Cancel URL** in payOS dashboard:
   ```
   https://your-domain.com/order
   ```

### Local Development

- payOS webhooks require a publicly reachable HTTPS URL
- For local testing, use unit tests with mock webhook payloads
- For real webhook testing, deploy to a staging environment or use a tunnel (e.g., ngrok)
- payOS does NOT have a sandbox environment — use small amounts for testing
- Do NOT run `npm run dev` and expect real webhooks to arrive at localhost

### SDK

- Package: `@payos/node` (official SDK)
- Requires Node.js 20+
- SDK handles signature generation/verification internally

## Deployment Checklist

- [ ] Configure Supabase production project
- [ ] Set all environment variables
- [ ] Run migrations on production database (001 → 006)
- [ ] Bootstrap first admin user
- [ ] Test admin login
- [ ] Verify RLS policies (anon cannot see product_files)
- [ ] Remove or protect `/api/health/supabase` endpoint
- [ ] Configure payOS payment provider (see above)
- [ ] Set payOS webhook URL to production domain
- [ ] Configure email provider
- [ ] Test full checkout → payment → webhook flow
- [ ] Set up monitoring/error tracking

