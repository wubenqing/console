export interface GrafanaConfig {
  url: string
  dashboard: {
    id: string
    slug: string
  }
  refreshInterval: string
  timeRange: string
}

const DEFAULT_FILTER_VALUES = {
  'var-datasource': 'prometheus',
  'var-job': '$__all',
  'var-path': '$__all',
  'var-bucket': '$__all',
  'var-drive': '$__all',
} as const

export function buildGrafanaDashboardUrl(config: GrafanaConfig): string {
  const normalizedBaseUrl = config.url.replace(/\/$/, '')
  const dashboardPath = `/d/${encodeURIComponent(config.dashboard.id)}/${encodeURIComponent(config.dashboard.slug)}`
  const params = new URLSearchParams({
    orgId: '1',
    from: config.timeRange,
    to: 'now',
    timezone: 'browser',
    refresh: config.refreshInterval,
    kiosk: 'true',
    theme: 'light',
    ...DEFAULT_FILTER_VALUES,
  })

  return `${normalizedBaseUrl}${dashboardPath}?${params.toString()}`
}
