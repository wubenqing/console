import { describe, expect, it } from 'vitest'

import { buildGrafanaDashboardUrl, type GrafanaConfig } from '@/lib/grafana'

describe('buildGrafanaDashboardUrl', () => {
  const config: GrafanaConfig = {
    url: 'http://grafana.example.com/',
    dashboard: {
      id: 'rustfs-s3',
      slug: 'rustfs dashboard',
    },
    refreshInterval: '15s',
    timeRange: 'now-1h',
  }

  it('builds the expected Grafana dashboard URL', () => {
    const url = new URL(buildGrafanaDashboardUrl(config))

    expect(url.origin).toBe('http://grafana.example.com')
    expect(url.pathname).toBe('/d/rustfs-s3/rustfs%20dashboard')
    expect(url.searchParams.get('orgId')).toBe('1')
    expect(url.searchParams.get('from')).toBe('now-1h')
    expect(url.searchParams.get('to')).toBe('now')
    expect(url.searchParams.get('timezone')).toBe('browser')
    expect(url.searchParams.get('refresh')).toBe('15s')
    expect(url.searchParams.get('kiosk')).toBe('true')
    expect(url.searchParams.get('theme')).toBe('light')
    expect(url.searchParams.get('var-datasource')).toBe('prometheus')
    expect(url.searchParams.get('var-job')).toBe('$__all')
    expect(url.searchParams.get('var-path')).toBe('$__all')
    expect(url.searchParams.get('var-bucket')).toBe('$__all')
    expect(url.searchParams.get('var-drive')).toBe('$__all')
  })

  it('removes a trailing slash from the base URL', () => {
    const url = buildGrafanaDashboardUrl(config)

    expect(url).toMatch(/^http:\/\/grafana\.example\.com\/d\//)
    expect(url).not.toContain('example.com//d/')
  })
})
