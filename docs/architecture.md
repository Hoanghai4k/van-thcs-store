# Architecture

## Overview

Văn THCS Store is a digital product store for Vietnamese literature (Ngữ văn THCS) study materials. Customers can browse products, add to cart, checkout, pay, and receive download links automatically.

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | Next.js 15 (App Router), React 19, TypeScript |
| Styling | Tailwind CSS v4 |
| Database | Supabase (PostgreSQL) |
| Storage | Supabase Storage (private bucket for .docx files) |
| Validation | Zod |
| Icons | Lucide React |

## Directory Structure

### `src/app/` — Routes & Pages
Only responsible for routing, page composition, layouts, and API routes. No business logic here.

### `src/components/` — UI Components
Reusable, presentational components organized by domain:
- `ui/` — Generic UI primitives (buttons, inputs, etc.)
- `layout/` — Header, Footer, navigation
- `product/` — Product cards, product detail sections
- `cart/` — Cart provider, cart components
- `checkout/` — Checkout form components
- `order/` — Order-related components
- `admin/` — Admin panel components

### `src/features/` — Business Logic
Domain-driven business logic, each with:
- `types.ts` — Domain types
- `schema.ts` — Zod validation schemas
- `queries.ts` — Data fetching functions
- `actions.ts` — Server Actions (mutations)
- `service.ts` — Complex business logic

Domains: `products`, `orders`, `payments`, `downloads`, `customers`, `emails`.

### `src/lib/` — Infrastructure
Infrastructure code only — no business logic:
- `supabase/` — Supabase client instances
- `auth/` — Authentication utilities
- `storage/` — Storage helpers
- `validation/` — Shared validation schemas
- `utils.ts` — Utility functions
- `constants.ts` — Application constants
- `env.ts` — Environment variable validation

### `src/config/` — Configuration
Centralized configuration that can be changed without modifying components:
- `site.ts` — Site name, tagline, contact info, store settings
- `navigation.ts` — Navigation menus

## Data Flow

```
Client → Server Component → Feature Query → Supabase (RLS) → Response
Client → Server Action → Feature Action → Supabase Admin → Response
Client → API Route → Feature Service → Supabase Admin → Response
```

## Key Design Decisions

1. **Server-first**: Server Components by default, Client Components only for interactivity.
2. **Mock data fallback**: When Supabase is not configured, the app uses mock data.
3. **Price always server-calculated**: Client never sends price; server fetches from DB.
4. **Private file storage**: Product files (.docx) stored in private Supabase bucket.
5. **Token-based downloads**: Time-limited, count-limited download tokens.
6. **Provider-agnostic payments**: Abstract PaymentProvider interface for future integration.
