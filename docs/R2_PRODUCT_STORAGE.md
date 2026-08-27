# R2 Product File Storage — Runbook

## Overview

Product files (DOCX, ZIP) up to 1 GB are stored in **Cloudflare R2** using
multipart upload. This avoids the 50 MB limit of Supabase Free tier storage.

Legacy files already in Supabase continue to work — the system reads
`product_files.storage_provider` to route downloads/deletions to the correct backend.

## Architecture

```
Admin Browser
  │
  ├─ POST /api/admin/upload/init        → sessionToken + objectKey + partCount
  │
  ├─ POST /api/admin/upload/sign-part   → presigned PUT URL (per part)
  │    └─ PUT presignedUrl (binary)     → R2 directly (Vercel never sees the binary)
  │
  ├─ POST /api/admin/upload/complete    → CompleteMultipart + HEAD verify + DB persist
  │
  └─ POST /api/admin/upload/abort       → AbortMultipart (cleanup)

Customer Download
  │
  └─ processDownload()
       ├─ entitlement check (unchanged)
       ├─ inspect file.storage_provider
       │     ├─ SUPABASE → supabaseAdmin.storage.createSignedUrl(...)
       │     └─ R2       → getSignedUrl(GetObjectCommand, ...)
       └─ redirect to signed URL (direct download from storage)
```

## Setup

### 1. Create R2 Bucket

1. Go to [Cloudflare Dashboard → R2 → Create Bucket](https://dash.cloudflare.com)
2. Bucket name: `tailieuhangcao-product-files`
3. Location hint: APAC (closest to Vietnam users)
4. **Do NOT enable public access** — bucket must stay private

### 2. Create R2 API Token

1. R2 → Manage R2 API Tokens → Create API token
2. Permissions: **Object Read & Write**
3. Bucket scope: `tailieuhangcao-product-files` only
4. TTL: No expiration (or set rotation policy)
5. Save the **Access Key ID** and **Secret Access Key**

### 3. Configure Bucket CORS

In the Cloudflare Dashboard → R2 → `tailieuhangcao-product-files` → Settings → CORS:

```json
[
  {
    "AllowedOrigins": [
      "https://tailieuhangcao.vn",
      "https://www.tailieuhangcao.vn",
      "http://localhost:3000"
    ],
    "AllowedMethods": ["PUT", "GET", "HEAD", "DELETE"],
    "AllowedHeaders": ["*"],
    "ExposeHeaders": ["ETag"],
    "MaxAgeSeconds": 3600
  }
]
```

> **IMPORTANT**: The `ExposeHeaders: ["ETag"]` entry is required for multipart
> upload. Without it, the browser cannot read the ETag response header from
> R2 PUT responses, and the upload will fail at the complete step.

### 4. Set Environment Variables

#### Local Development (`.env.local`)

```bash
R2_ACCOUNT_ID=your-cloudflare-account-id
R2_ACCESS_KEY_ID=your-r2-access-key-id
R2_SECRET_ACCESS_KEY=your-r2-secret-access-key
R2_BUCKET_NAME=tailieuhangcao-product-files
PRODUCT_FILE_STORAGE_PROVIDER=R2
```

#### Vercel Production

Set the same variables in Vercel → Project → Settings → Environment Variables.
All R2 variables are server-only (no `NEXT_PUBLIC_` prefix).

### 5. Apply Migration 013

```bash
# Dry run first
npx supabase db push --dry-run

# After Tech Lead review
npx supabase db push
```

This adds `storage_provider TEXT NOT NULL DEFAULT 'SUPABASE'` to `product_files`.
All existing rows remain `SUPABASE`. No data migration needed.

## Testing

### Small File Test (< 16 MiB, single part)

1. Upload a 1 MB DOCX in Admin
2. Verify: `product_files` row has `storage_provider = 'R2'`
3. Verify: File accessible via customer download flow

### Large File Test (> 16 MiB, multipart)

1. Upload a 100+ MB ZIP in Admin
2. Verify: Progress bar shows accurate percentage
3. Verify: Upload completes successfully
4. Verify: File downloadable by customer

### Very Large File Test (> 500 MB)

1. Upload a 500+ MB ZIP
2. Verify: Large file warning appears during upload
3. Verify: Upload completes after extended time

### Interrupted Upload Test

1. Start a large upload, then kill network mid-upload
2. Verify: Failed parts retry with backoff
3. Verify: Upload eventually completes when network returns
4. OR: Cancel button works and R2 multipart is aborted

### Legacy File Download Test

1. Find an existing file with `storage_provider = 'SUPABASE'`
2. Verify: Customer download still generates Supabase signed URL
3. Verify: Download works correctly

### Preview Generation Test

1. Upload a DOCX file to R2
2. Generate Auto Preview from Admin
3. Verify: CloudConvert receives R2 signed URL
4. Verify: Preview PDF is created in Supabase `product-previews` bucket

### File Deletion Test

1. Delete an R2 file from Admin
2. Verify: R2 object is removed
3. Verify: DB row is removed
4. Delete a Supabase file from Admin
5. Verify: Supabase storage object is removed

## Security Checklist

- [ ] R2 bucket is private (no public access)
- [ ] R2 API token is scoped to single bucket only
- [ ] R2 credentials are server-only (no `NEXT_PUBLIC_` prefix)
- [ ] All upload API routes require `getCurrentAdmin()` auth
- [ ] Upload session tokens are HMAC-signed with `ADMIN_SECRET_KEY`
- [ ] Presigned PUT URLs expire in 15 minutes
- [ ] Download signed URLs expire per `siteConfig.store.signedUrlTtlSeconds`
- [ ] Entitlement checks are NOT bypassed for R2 files
- [ ] Binary data never flows through Vercel functions

## Troubleshooting

### Upload fails: "Phiên tải lên không hợp lệ"
- Check that `ADMIN_SECRET_KEY` is set and >= 16 chars
- Ensure session token hasn't been tampered with

### Upload fails: CORS error in browser console
- Verify R2 CORS config includes your domain
- Verify `ExposeHeaders: ["ETag"]` is set
- Check `AllowedMethods` includes `PUT`

### Download fails for R2 file
- Check R2 API token has Read permission
- Verify `R2_BUCKET_NAME` matches the actual bucket
- Check object key in `product_files.storage_path` matches R2

### Build error: Cannot find module '@aws-sdk/client-s3'
- Run `npm install @aws-sdk/client-s3 @aws-sdk/s3-request-presigner`
