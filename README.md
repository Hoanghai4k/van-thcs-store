# Văn THCS Store

Website bán tài liệu Ngữ văn THCS dạng Microsoft Word (.docx).

## Tech Stack

- **Framework**: Next.js 15 (App Router)
- **Language**: TypeScript (strict)
- **Styling**: Tailwind CSS v4
- **Database**: Supabase / PostgreSQL
- **Validation**: Zod
- **Icons**: Lucide React

## Getting Started

### Prerequisites

- Node.js 18+
- npm

### Installation

```bash
cd van-thcs-store-v2
npm install
```

### Environment Setup

```bash
cp .env.example .env.local
# Edit .env.local with your values
```

### Development

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

The app works with mock data when Supabase is not configured.

### Code Quality

```bash
npm run lint       # ESLint
npm run typecheck  # TypeScript check
npm run build      # Production build
npm run test       # Run tests
```

## Project Structure

```
src/
├── app/           # Routes, pages, layouts, API routes
├── components/    # Reusable UI components
├── features/      # Business logic (products, orders, payments, downloads)
├── lib/           # Infrastructure (Supabase, auth, storage, utils)
├── types/         # TypeScript type definitions
└── config/        # Centralized configuration
```

## Documentation

See `docs/` directory:

- [Architecture](docs/architecture.md)
- [Database](docs/database.md)
- [Payment](docs/payment.md)
- [Digital Delivery](docs/digital-delivery.md)
- [Security](docs/security.md)
- [Development](docs/development.md)
