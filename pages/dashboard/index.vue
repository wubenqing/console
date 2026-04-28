<template>
  <Page class="flex min-h-0 flex-1 flex-col overflow-hidden">
    <PageHeader>
      <div class="flex items-center gap-3">
        <Button v-if="isMonitorMode" type="button" variant="outline" size="sm" @click="goBack">返回</Button>
        <h1 v-if="!isMonitorMode" class="text-2xl font-bold">{{ pageTitle }}</h1>
      </div>
    </PageHeader>

    <div class="flex min-h-0 flex-1 flex-col rounded-lg border bg-background shadow-sm overflow-hidden">
      <iframe
        :src="grafanaUrl"
        class="h-full w-full flex-1 min-h-0 border-0"
        :title="iframeTitle"
        loading="lazy"
        referrerpolicy="strict-origin-when-cross-origin"
      />
    </div>
  </Page>
</template>

<script lang="ts" setup>
import { useRoute, useRouter, useRuntimeConfig } from '#imports'
import { computed } from 'vue'
import Page from '@/components/page.vue'
import PageHeader from '@/components/page-header.vue'
import { Button } from '@/components/ui/button'
import { buildGrafanaDashboardUrl, type GrafanaConfig } from '@/lib/grafana'

const LAKETOKEN_MONITOR_TARGET = 'lmcache-main-v1'

const route = useRoute()
const router = useRouter()
const runtimeConfig = useRuntimeConfig() as {
  public: {
    grafana: GrafanaConfig & {
      laketokenMonitor?: Omit<GrafanaConfig, 'url'> & {
        url?: string
      }
    }
  }
}

function normalizeQueryValue(value: string | null | Array<string | null> | undefined): string {
  if (Array.isArray(value)) {
    return typeof value[0] === 'string' ? value[0].trim() : ''
  }

  return typeof value === 'string' ? value.trim() : ''
}

const monitorTarget = computed(() => normalizeQueryValue(route.query.target))
const monitorSource = computed(() => normalizeQueryValue(route.query.source))
const isMonitorMode = computed(() => monitorTarget.value === LAKETOKEN_MONITOR_TARGET)
const pageTitle = computed(() => '仪表盘')
const iframeTitle = computed(() => (isMonitorMode.value ? 'Grafana Dashboard' : `${pageTitle.value} Grafana Dashboard`))
const grafanaConfig = computed<GrafanaConfig>(() => {
  const baseConfig = runtimeConfig.public.grafana
  const monitorConfig = baseConfig.laketokenMonitor

  if (!isMonitorMode.value || !monitorConfig) {
    return baseConfig
  }

  return {
    url: monitorConfig.url || baseConfig.url,
    dashboard: monitorConfig.dashboard,
    refreshInterval: monitorConfig.refreshInterval,
    timeRange: monitorConfig.timeRange,
    defaultParams: monitorConfig.defaultParams,
  }
})
const grafanaUrl = computed(() => buildGrafanaDashboardUrl(grafanaConfig.value))

function goBack() {
  if (monitorSource.value) {
    void router.push(monitorSource.value)
    return
  }

  router.back()
}
</script>
