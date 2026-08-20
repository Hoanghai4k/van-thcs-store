# AGENTS.md — Văn THCS Store

Rules and constraints for AI agents working on this codebase.

## Security Rules (CRITICAL)

- **NEVER** expose secrets (API keys, service role keys) in client-side code or logs.
- **NEVER** place product files (.docx) in `/public` or create public URLs for them.
- **NEVER** allow order status to be set to `PAID` from client-side code.
- **NEVER** trust prices sent from the client. Always recalculate from the database.
- **NEVER** log sensitive data (passwords, API keys, full customer records).
- **NEVER** hard-code admin passwords or authentication credentials.

## Architecture Rules

- **Server Components First**: Use Server Components by default. Only add `"use client"` when the component needs interactivity (state, effects, event handlers).
- **Business Logic Location**:
  - Payment logic → `features/payments/`
  - Download logic → `features/downloads/`
  - Order logic → `features/orders/`
  - Product logic → `features/products/`
  - Customer logic → `features/customers/`
- **No business logic in `lib/`**. The `lib/` directory is for infrastructure only.
- **No copy-paste of business logic**. Extract shared logic into reusable functions.
- **Config centralization**: Site name, branding, navigation → `src/config/`. Never hard-code these in components.

## Database Rules

- **Schema changes MUST use migrations**. Do not modify the database directly.
- **New migrations** go in `supabase/migrations/` with sequential numbering.
- **RLS policies** must be reviewed for any new table.
- **Product files** table (`storage_path`) must NEVER be readable by anonymous users.

## Code Quality

- After any code change, run: `npm run lint`, `npx tsc --noEmit`, `npm run build`.
- Do NOT delete code just to make the build pass without understanding the dependency.
- Do NOT make large architectural changes without explicit approval.
- Validate all user input with Zod schemas.
- Handle errors gracefully — never expose internal errors to end users.
- Use TypeScript strict mode. Avoid `any` type.

## Testing

- Unit tests for business logic go in `tests/unit/`.
- Integration tests go in `tests/integration/`.

## Environment

- All environment variables must be defined in `.env.example`.
- Server-only variables must NOT start with `NEXT_PUBLIC_`.
- Use `src/lib/env.ts` for environment variable validation.
