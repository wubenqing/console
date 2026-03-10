# Technical Design - Dashboard Grafana Integration

## Context

### Current State

- Console has a `/dashboard` route with a placeholder message
- Grafana monitoring dashboard exists at `http://172.24.37.159:23000/d/rustfs-s3/rustfs`
- Grafana dashboard includes 8 stat cards and multiple chart panels
- Grafana has built-in filtering variables (job, path, bucket, drive)

### Constraints

- Cannot modify Grafana configuration or dashboard structure
- Must maintain Console UI consistency
- Must use existing Nuxt configuration patterns
- Grafana may require CORS or authentication configuration

## Goals / Non-Goals

**Goals:**

- Display Grafana dashboard within Console via iframe
- Support configurable Grafana URL and dashboard ID via environment variables
- Implement responsive layout that adapts to different screen sizes
- Enable 15-second auto-refresh (configurable)
- Maintain all Grafana functionality including side panel filters

**Non-Goals:**

- Do not re-draw Grafana panels using ECharts or other libraries
- Do not add Console-specific filtering controls (rely on Grafana side panel)
- Do not modify Grafana dashboard structure or queries
- Do not implement additional authentication beyond what Grafana provides

## Decisions

### 1. Embed Full Dashboard vs Individual Panels

**Decision:** Embed complete Grafana dashboard in single iframe

**Rationale:**

- **Maintains time synchronization**: All panels show same data time range
- **Preserves Grafana controls**: Side panel filters work naturally
- **Simpler implementation**: One iframe vs multiple coordinated iframes
- **Performance**: Single HTTP request vs multiple

**Alternatives Considered:**

- Embed individual panels: Would require manual time range sync, more complex
- Re-draw using ECharts: Would lose Grafana functionality, high development cost

### 2. Environment Variables Configuration

**Decision:** Use Nuxt runtimeConfig with environment variables

**Rationale:**

- **Follows project pattern**: Matches existing `GRAVITINO_API_URL`, `S3_ENDPOINT` patterns
- **Environment isolation**: Different configs for dev/test/prod
- **Clean code**: URL generation logic stays in component
- **Sensible defaults**: Code works out of box, overrides optional

**Configuration Structure:**

```typescript
runtimeConfig.public.grafana = {
  url: process.env.GRAFANA_URL || 'http://localhost:3000',
  dashboard: {
    id: process.env.GRAFANA_DASHBOARD_ID || 'rustfs-s3',
    slug: process.env.GRAFANA_DASHBOARD_SLUG || 'rustfs',
  },
  refreshInterval: '15s', // code default
  timeRange: 'now-1h', // code default
}
```

### 3. Flex-Based Responsive Layout

**Decision:** Use CSS flex for iframe sizing

**Rationale:**

- **Automatic adaptation**: No manual height calculations
- **Responsive**: Works on different screen sizes
- **Simple**: `flex-1 min-h-0` pattern already used in Console
- **No overflow**: `min-h-0` prevents flex child from growing too large

**Implementation:**

```vue
<div class="flex-1 min-h-0">
  <iframe class="w-full h-full" />
</div>
```

### 4. Grafana UI Configuration

**Decision:** Use Kiosk mode with light theme

**Rationale:**

- **Kiosk mode**: Hides Grafana UI chrome (header, sidebar)
- **Light theme**: Matches Console UI design
- **URL parameters**: Simple to add to iframe src

**Parameters:**

```
&kiosk=true    // Hide Grafana UI
&theme=light   // Light theme
```

## Risks / Trade-offs

| Risk                   | Impact                         | Mitigation                                                          |
| ---------------------- | ------------------------------ | ------------------------------------------------------------------- |
| CORS errors            | iframe won't load              | Configure `CORS_ALLOW_ORIGIN` in Grafana or use Nginx reverse proxy |
| Authentication prompts | Users see login dialog         | Configure Nginx proxy with authentication or use Grafana API token  |
| Height mismatch        | Scrollbars or overflow         | Use flex layout with `min-h-0`; test on multiple screen sizes       |
| Slow load              | Poor UX                        | Grafana loads first-party resources; may take 2-5 seconds initially |
| Mobile incompatibility | Dashboard not usable on phones | Dashboard not designed for mobile; accept limitation                |

## Open Questions

1. **What is the production Grafana URL?** - Currently using dev URL from local testing
2. **Will Grafana run on same server as Console?** - Impacts CORS configuration requirements
3. **Is Nginx reverse proxy available?** - Would simplify CORS and authentication handling
