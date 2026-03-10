<template>
  <Page class="flex min-h-0 flex-1 flex-col overflow-hidden">
    <PageHeader>
      <h1 class="text-2xl font-bold">仪表盘</h1>
    </PageHeader>

    <div class="flex min-h-0 flex-1 flex-col rounded-lg border bg-background shadow-sm overflow-hidden">
      <iframe
        :src="grafanaUrl"
        class="h-full w-full flex-1 min-h-0 border-0"
        title="Grafana Dashboard"
        loading="lazy"
        referrerpolicy="strict-origin-when-cross-origin"
      />
    </div>
  </Page>
</template>

<script lang="ts" setup>
import Page from '@/components/page.vue'
import PageHeader from '@/components/page-header.vue'
import { buildGrafanaDashboardUrl } from '@/lib/grafana'

const runtimeConfig = useRuntimeConfig()

const grafanaUrl = computed(() => buildGrafanaDashboardUrl(runtimeConfig.public.grafana))
</script>
