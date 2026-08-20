# Database Schema

## Tables

### categories
| Column | Type | Constraints |
|--------|------|------------|
| id | UUID | PK, auto-generated |
| name | VARCHAR(255) | NOT NULL |
| slug | VARCHAR(255) | NOT NULL, UNIQUE |
| description | TEXT | nullable |
| is_active | BOOLEAN | NOT NULL, default true |
| created_at | TIMESTAMPTZ | auto |
| updated_at | TIMESTAMPTZ | auto-trigger |

### products
| Column | Type | Constraints |
|--------|------|------------|
| id | UUID | PK |
| name | VARCHAR(255) | NOT NULL |
| slug | VARCHAR(255) | NOT NULL, UNIQUE |
| short_description | VARCHAR(500) | nullable |
| description | TEXT | nullable |
| price | INTEGER | NOT NULL, >= 0 (VND, no decimals) |
| original_price | INTEGER | nullable, >= 0 |
| category_id | UUID | FK → categories, ON DELETE SET NULL |
| thumbnail_path | TEXT | nullable — storage path in product-assets |
| preview_images | TEXT[] | nullable — array of storage paths |
| file_count | INTEGER | NOT NULL, default 1, >= 1 |
| page_count | INTEGER | nullable, > 0 if set |
| file_format | TEXT | NOT NULL, default 'docx' |
| features | TEXT[] | nullable — product feature list |
| suitable_for | TEXT[] | nullable — target audience tags |
| is_active | BOOLEAN | NOT NULL, default true |
| created_at | TIMESTAMPTZ | auto |
| updated_at | TIMESTAMPTZ | auto-trigger |

### product_files
| Column | Type | Constraints |
|--------|------|------------|
| id | UUID | PK |
| product_id | UUID | FK → products, ON DELETE CASCADE |
| file_name | VARCHAR(255) | NOT NULL |
| storage_path | TEXT | NOT NULL, UNIQUE (PRIVATE — never exposed to client) |
| file_size | BIGINT | default 0 |
| mime_type | VARCHAR(100) | .docx MIME type |
| created_at | TIMESTAMPTZ | auto |

### admin_users
| Column | Type | Constraints |
|--------|------|------------|
| user_id | UUID | PK, FK → auth.users(id) ON DELETE CASCADE |
| created_at | TIMESTAMPTZ | auto |

**Note**: No password stored here. Authentication is managed by Supabase Auth.
Admin authorization is verified by checking `auth.uid()` against `admin_users.user_id`.

### customers
| Column | Type | Constraints |
|--------|------|------------|
| id | UUID | PK |
| name | VARCHAR(255) | NOT NULL |
| email | VARCHAR(255) | NOT NULL, UNIQUE (lowercase) |
| phone | VARCHAR(20) | nullable |
| created_at | TIMESTAMPTZ | auto |
| updated_at | TIMESTAMPTZ | auto-trigger |

### orders
| Column | Type | Constraints |
|--------|------|------------|
| id | UUID | PK |
| order_code | VARCHAR(50) | NOT NULL, UNIQUE |
| customer_id | UUID | FK → customers, ON DELETE RESTRICT |
| subtotal | INTEGER | NOT NULL, >= 0 |
| discount | INTEGER | default 0, >= 0 |
| total_amount | INTEGER | NOT NULL, >= 0 |
| payment_method | VARCHAR(50) | nullable |
| payment_transaction_id | VARCHAR(255) | nullable |
| status | order_status ENUM | PENDING/PAID/FAILED/CANCELLED/REFUNDED |
| paid_at | TIMESTAMPTZ | nullable |
| created_at | TIMESTAMPTZ | auto |
| updated_at | TIMESTAMPTZ | auto-trigger |

### order_items
| Column | Type | Constraints |
|--------|------|------------|
| id | UUID | PK |
| order_id | UUID | FK → orders, ON DELETE CASCADE |
| product_id | UUID | FK → products, ON DELETE RESTRICT |
| product_name | VARCHAR(255) | NOT NULL (snapshot at order time) |
| unit_price | INTEGER | NOT NULL, >= 0 (snapshot) |
| created_at | TIMESTAMPTZ | auto |

### download_tokens
| Column | Type | Constraints |
|--------|------|------------|
| id | UUID | PK |
| order_id | UUID | FK → orders, ON DELETE CASCADE |
| product_id | UUID | FK → products, ON DELETE RESTRICT |
| token | VARCHAR(255) | NOT NULL, UNIQUE |
| expires_at | TIMESTAMPTZ | NOT NULL |
| max_downloads | INTEGER | default 5 |
| download_count | INTEGER | default 0 |
| created_at | TIMESTAMPTZ | auto |
| last_download_at | TIMESTAMPTZ | nullable |

## Functions

### `update_updated_at_column()`
Trigger function that sets `updated_at = NOW()` before UPDATE on categories, products, customers, orders.

### `private.is_admin()`
Returns `BOOLEAN`. Checks if `auth.uid()` exists in `admin_users`.
- Lives in `private` schema — NOT exposed via Supabase Data API
- `SECURITY DEFINER` — bypasses RLS on admin_users to avoid recursion
- `STABLE` — safe for RLS policy evaluation
- `SET search_path = ''` — prevents search_path hijacking
- `EXECUTE` revoked from `PUBLIC`/`anon`; granted to `authenticated`/`service_role`

## Migrations

Located in `supabase/migrations/`:
1. `001_initial_schema.sql` — Complete foundation: all tables, indexes, constraints, triggers, product enrichment columns
2. `002_rls_policies.sql` — RLS: public active-only SELECT, service_role policies for server-only tables
3. `003_storage.sql` — Storage buckets: product-assets (public), product-files (private)
4. `004_admin_product_foundation.sql` — Private schema, admin_users table, private.is_admin() function, admin RLS policies, REVOKE/GRANT, storage policy upgrade

**IMMUTABILITY RULE**: Once migrations 001–004 are applied to production, they become immutable. All future schema changes must use migration 005+.

## Seed Data

`supabase/seed.sql` contains demo data: 10 categories, 8 products with enrichment data.
Does NOT seed admin users — admin bootstrap is manual.

## Important Notes

- Prices are stored in VND as integers (no decimals needed).
- `product_name` and `unit_price` in `order_items` are snapshots — they preserve the values at order time even if the product is later updated.
- Email uniqueness uses `LOWER(email)` index for case-insensitive comparison.
- `updated_at` columns are automatically maintained by database triggers.
- `private.is_admin()` always uses `auth.uid()` — never accepts user_id from the client.
- The `private` schema must NOT be added to Supabase exposed schemas (API Settings → Data API).

## Type Generation

After applying migrations, generate TypeScript types:
```bash
npx supabase gen types typescript --project-id <project-id> > src/types/database.ts
```
