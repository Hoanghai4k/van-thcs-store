# Digital Delivery

## Overview

Product files (.docx) are delivered via time-limited, count-limited download tokens.

## Flow

```
Payment Confirmed (webhook)
    ↓
Generate Download Token (per product in order)
    ↓
Send Email with Download Links
    ↓
Customer clicks link → /api/downloads/[token]
    ↓
Validate Token:
  1. Token exists?
  2. Token not expired?
  3. Order is PAID?
  4. Product belongs to order?
  5. Download count < max?
    ↓
Generate Signed URL from Supabase Storage
    ↓
Redirect/Stream file to customer
    ↓
Increment download count
```

## Token Properties

| Property | Default |
|----------|---------|
| Expiry | 72 hours |
| Max downloads | 5 |
| Token format | 64-char hex (crypto.randomBytes(32)) |

Configurable in `src/config/site.ts` → `store.downloadTokenExpiryHours` and `store.maxDownloadsPerToken`.

## Storage

- **Bucket**: `product-files` (PRIVATE)
- **Path**: `products/{product_id}/files/{uuid}.docx`
- **Access**: Admin only (via `private.is_admin()` RLS policy), service_role for server-side download
- **Delivery**: Time-limited signed URLs generated server-side

### Public Assets

- **Bucket**: `product-assets` (PUBLIC)
- **Path**: `products/{product_id}/assets/{filename}`
- **Access**: Public read, admin write
- **Content**: Thumbnails, preview images (JPEG, PNG, WebP)

## Files

- `src/features/downloads/types.ts` — Types
- `src/features/downloads/token.ts` — Token generation/validation
- `src/features/downloads/service.ts` — Download service
- `src/app/api/downloads/[token]/route.ts` — Download API endpoint

## Security

- Tokens are random and unguessable (32 bytes of crypto randomness)
- Expired tokens are rejected
- Exhausted tokens (download count >= max) are rejected
- Only PAID orders can generate downloads
- File paths are never exposed to the client
- Storage bucket `product-files` has no public read policy
- Only admin users can directly access product files in storage
