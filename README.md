# RustFS Console

A modern web management console for [RustFS](https://github.com/rustfs/rustfs) distributed file system.

## Features

- Vue 3 + Nuxt 4 + TypeScript + Tailwind CSS v4
- shadcn-vue components with dark mode
- i18n support (English, Chinese, Turkish)
- Responsive design
- S3-compatible API with AWS signing
- Real-time monitoring dashboard

## Quick Start

### Prerequisites

- Node.js >= 22.0.0
- pnpm >= 10.27.0 (managed via corepack or mise)
- RustFS backend running

### Installation

```bash
git clone https://github.com/rustfs/console.git
cd console
pnpm install
```

### Development

```bash
pnpm dev
```

Server starts at `http://localhost:3000`.

### Environment (Optional)

Create `.env`:

```env
APP_NAME=RustFS
BASE_URL=/rustfs/console/
API_BASE_URL=http://localhost:9000/rustfs/admin/v3
SERVER_HOST=http://localhost:9000
S3_REGION=us-east-1
S3_ENDPOINT=http://localhost:9000
GRAFANA_URL=http://172.24.37.159:23000
GRAFANA_DASHBOARD_ID=rustfs-s3
GRAFANA_DASHBOARD_SLUG=rustfs
GRAFANA_REFRESH=15s
GRAFANA_TIME_RANGE=now-1h
```

Configuration is auto-detected from server config, localStorage, or browser host.

The dashboard route embeds Grafana with the public runtime config above. If your Grafana deployment differs, override those values in `.env` before starting the app.

Grafana embedding requirements:

- Allow the Console origin to load Grafana in an iframe. This usually means setting Grafana `allow_embedding = true` and configuring CORS or a reverse proxy for the Console origin.
- If Grafana requires authentication, prefer a same-origin reverse proxy or SSO flow so the embedded iframe does not prompt the user unexpectedly.
- After changing Grafana-related environment variables, restart `pnpm dev` or your production process so Nuxt reloads runtime config.

Manual verification notes:

- Open `/dashboard` and confirm the iframe loads the expected dashboard.
- Change `GRAFANA_URL` in `.env`, restart the app, and confirm the iframe points to the new Grafana instance.
- Resize the window at desktop resolutions such as `1920x1080` and `1366x768` and check that the page does not introduce extra scrollbars.
- Use the Grafana side-panel filters and time range controls to confirm the embedded dashboard stays interactive.

### Production Build

```bash
pnpm build
pnpm preview
```

## Project Structure

```
├── components/     # Vue components
├── composables/    # Reusable logic
├── pages/         # Nuxt routes
├── lib/           # API clients, utilities
├── store/         # Pinia stores
├── tests/         # Test files
└── utils/         # Utility functions
```

## Development

### Code Quality

```bash
pnpm type-check    # TypeScript checking
pnpm lint          # Linting
pnpm lint:fix      # Auto-fix formatting
```

### Testing

```bash
pnpm test          # Run tests
pnpm test:run      # CI mode
pnpm test:coverage # With coverage
```

See [tests/README.md](tests/README.md) for details.

### Coding Standards

- Component files: kebab-case (`bucket-selector.vue`)
- Component usage: StudlyCase (`<BucketSelector />`)
- Composables: camelCase with `use` prefix (`useBucket.ts`)
- TypeScript: Strict mode, avoid `any`
- Comments: English only

## Contributing

### Workflow

1. Fork and clone
2. Create feature branch: `git checkout -b feature/amazing-feature`
3. Make changes following coding standards
4. Test: `pnpm type-check && pnpm lint && pnpm test:run`
5. Commit: `git commit -m 'feat: add amazing feature'` (English only)
6. Push and create PR

### Pre-Commit Checklist

**Before committing, run all checks:**

```bash
# Quick check (lint, type-check, tests, build)
pnpm run check

# Full check (includes security audit)
pnpm run pre-commit
```

Or manually:

- ✅ `pnpm lint` passes
- ✅ `pnpm type-check` passes
- ✅ `pnpm test:run` passes
- ✅ `pnpm build` succeeds
- ✅ `pnpm audit --audit-level=moderate` passes
- ✅ No debug code (`console.log`)
- ✅ Self-reviewed
- ✅ Commit messages in English

**Tip**: Run `pnpm run check` before every commit to catch issues early.

### Commit Convention

Follow [Conventional Commits](https://www.conventionalcommits.org/):

- `feat`: New features
- `fix`: Bug fixes
- `docs`: Documentation
- `style`: Formatting
- `refactor`: Code refactoring
- `test`: Tests
- `chore`: Build/tool changes

**All commit messages must be in English.**

## Deployment

### Build

```bash
pnpm build
```

Output: `.output/public` (static files)

### Docker

```dockerfile
FROM node:22-alpine AS builder
WORKDIR /app
COPY package.json pnpm-lock.yaml ./
RUN corepack enable && corepack prepare pnpm@10.27.0 --activate
RUN pnpm install --frozen-lockfile
COPY . .
RUN pnpm build

FROM nginx:alpine
COPY --from=builder /app/.output/public /usr/share/nginx/html
EXPOSE 80
```

## License

Apache License 2.0 - see [LICENSE](LICENSE)
