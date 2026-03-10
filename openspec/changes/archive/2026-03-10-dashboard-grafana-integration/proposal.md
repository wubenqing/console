# Dashboard Grafana Integration

## Why

The monitoring dashboard in Console currently displays a placeholder message instead of actual monitoring data. Users need a way to view Grafana's existing monitoring dashboard directly within the Console interface without needing to navigate to a separate Grafana instance.

## What Changes

- **New Dashboard Page**: Integrate Grafana's existing monitoring dashboard into the Console's `/dashboard` route
- **Configuration Management**: Add environment variables for Grafana configuration (URL, dashboard ID, refresh interval, time range)
- **Embedding Mechanism**: Use iframe to embed the complete Grafana dashboard with auto-refresh capability
- **Responsive Layout**: Implement flex-based iframe sizing to adapt to different screen sizes

## Capabilities

### New Capabilities

- `grafana-integration`: Embed and display Grafana monitoring dashboards within Console with configurable parameters

### Modified Capabilities

- None

## Impact

**Affected code:**

- `pages/dashboard/index.vue` - Replace placeholder with iframe implementation
- `nuxt.config.ts` - Add `runtimeConfig.grafana` configuration
- `.env.example` - Add Grafana environment variable definitions

**Dependencies:**

- Grafana instance must be available at configured URL
- Grafana CORS configuration or reverse proxy for cross-origin requests

**Systems:**

- Console UI - Dashboard page will display Grafana content
- Environment configuration - New variables for Grafana connection
