# Implementation Tasks

## 1. Configuration Setup

- [x] 1.1 Add Grafana environment variables to `.env.example`
  - `GRAFANA_URL=http://172.24.37.159:23000`
  - `GRAFANA_DASHBOARD_ID=rustfs-s3`
  - `GRAFANA_DASHBOARD_SLUG=rustfs`
  - `GRAFANA_REFRESH=15s` (optional)
  - `GRAFANA_TIME_RANGE=now-1h` (optional)

- [x] 1.2 Update `nuxt.config.ts` with runtimeConfig.grafana section
  - Add `runtimeConfig.public.grafana` block
  - Read from environment variables with defaults
  - Structure: url, dashboard (id/sl ug), refreshInterval, timeRange

## 2. Dashboard Implementation

- [x] 2.1 Update `pages/dashboard/index.vue`
  - Replace placeholder text with iframe implementation
  - Import Page and PageHeader components
  - Add computed grafanaUrl using useRuntimeConfig()
  - Implement flex layout wrapper (flex-1 min-h-0)

- [x] 2.2 Verify URL generation逻辑
  - Check URL format: `{url}/d/{id}/{slug}?{params}`
  - Verify all required parameters included
  - Test special characters escaped correctly ($\_\_all)


## 3. Testing

- [x] 3.1 Local development test
  - Start dev server with `pnpm dev`
  - Navigate to `/dashboard` route
  - Verify Grafana dashboard loads in iframe
  - Check 15-second auto-refresh triggers

- [x] 3.2 Configuration override test
  - Modify`.env` with different GRAFANA_URL
  - Restart dev server
  - Verify different dashboard loads

- [x] 3.3 Responsive layout test
  - Test at 1920x1080 screen resolution
  - Test at 1366x768 screen resolution
  - Test window resizing
  - Verify no scrollbars occur

- [x] 3.4 Grafana functionality test
  - Test side panel job filter selection
  - Test time range display updates
  - Verify chart data changes with filters

## 4. Production Ready

- [x] 4.1 Update configuration with production values
  - Replace dev URL with production Grafana URL
  - Verify dashboard ID/slug match production

- [x] 4.2 Document CORS and auth requirements
  - Note Grafana CORS configuration needs
  - Note authentication workaround options

- [x] 4.3 Add test notes to README (if needed)
  - Document how to configure Grafana connection
