<script lang="ts" setup>
import { useRouter, useRuntimeConfig } from '#imports'
import DataTable from '@/components/data-table/data-table.vue'
import DataTablePagination from '@/components/data-table/data-table-pagination.vue'
import { useDataTable } from '@/components/data-table/useDataTable'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import Modal from '@/components/modal.vue'
import Page from '@/components/page.vue'
import PageHeader from '@/components/page-header.vue'
import { Switch } from '@/components/ui/switch'
import type { ColumnDef } from '@tanstack/vue-table'
import { computed, h, onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useGpustack } from '~/composables/useGpustack'
import { useMessage } from '~/composables/ui'
import {
  applyLaketokenForm,
  createDefaultLaketokenForm,
  extractLaketokenForm,
  type LaketokenFormState,
} from '~/lib/gpustack/laketoken'
import type { GpustackModel, GpustackModelInstance } from '~/types/gpustack'

const gpustack = useGpustack()
const message = useMessage()
const router = useRouter()
const runtimeConfig = useRuntimeConfig()
const { t } = useI18n()

const LAKETOKEN_MONITOR_TARGET = 'lmcache-main-v1'
const LAKETOKEN_MONITOR_SOURCE = '/ai-datalake/laketoken'

const models = ref<GpustackModel[]>([])
const instanceRows = ref<LaketokenInstanceRow[]>([])
const editingRow = ref<LaketokenInstanceRow | null>(null)
const editingModel = ref<GpustackModel | null>(null)
const form = ref<LaketokenFormState>(createDefaultLaketokenForm())

const loadingModels = ref(false)
const loadingEditor = ref(false)
const applying = ref(false)
const editOpen = ref(false)
const applyError = ref('')
const applySuccess = ref('')

interface LaketokenInstanceRow {
  id: string
  modelId: number
  modelName: string
  instanceId: number
  instanceName: string
  state: string
  backendVersion: string
}

const publicGpustackConfig = runtimeConfig.public as {
  gpustack?: {
    allowedModelNames?: string[]
  }
}
const allowedModelNames = new Set((publicGpustackConfig.gpustack?.allowedModelNames || []).map((name: string) => name))

const selectableModels = computed(() =>
  models.value.filter(model => {
    if ((model.backend || '').toLowerCase() !== 'vllm') {
      return false
    }

    if (allowedModelNames.size === 0) {
      return true
    }

    return allowedModelNames.has(model.name)
  })
)

const validationErrors = computed(() => {
  if (!form.value.kvCacheEnabled) {
    return []
  }

  const errors: string[] = []
  const numericFields = [
    [t('LMCache chunk size'), form.value.lmcacheChunkSize],
    [t('LMCache max local CPU size'), form.value.lmcacheMaxLocalCpuSize],
    [t('LMCache max local disk size'), form.value.lmcacheMaxLocalDiskSize],
  ]

  if (!form.value.lmcacheLocalDisk.trim()) {
    errors.push(t('LMCache local disk path is required when KV cache is enabled.'))
  }

  for (const [label, value] of numericFields) {
    if (!String(value).trim()) {
      errors.push(t('{label} is required when KV cache is enabled.', { label }))
      continue
    }

    if (Number.isNaN(Number(value))) {
      errors.push(t('{label} must be a valid number.', { label }))
    }
  }

  return errors
})

const columns: ColumnDef<LaketokenInstanceRow>[] = [
  {
    accessorKey: 'modelName',
    header: () => t('Model'),
    cell: ({ row }) => h('span', { class: 'font-medium' }, row.original.modelName),
  },
  {
    accessorKey: 'instanceName',
    header: () => t('Instance'),
  },
  {
    accessorKey: 'state',
    header: () => t('State'),
    cell: ({ row }) => row.original.state || t('Unknown'),
  },
  {
    accessorKey: 'backendVersion',
    header: () => t('Backend Version'),
    cell: ({ row }) => row.original.backendVersion || t('Unknown'),
  },
  {
    id: 'actions',
    header: () => t('Actions'),
    enableSorting: false,
    enableHiding: false,
    meta: {
      width: 220,
    },
    cell: ({ row }) =>
      h('div', { class: 'flex items-center gap-2' }, [
        h(
          Button,
          {
            type: 'button',
            size: 'sm',
            variant: 'outline',
            disabled: loadingEditor.value || applying.value,
            onClick: () => {
              void openEditDialog(row.original)
            },
          },
          () => t('Edit')
        ),
        h(
          Button,
          {
            type: 'button',
            size: 'sm',
            variant: 'outline',
            disabled: applying.value,
            onClick: () => {
              void openMonitor()
            },
          },
          () => t('Monitor')
        ),
      ]),
  },
]

const { table } = useDataTable<LaketokenInstanceRow>({
  data: instanceRows,
  columns,
  pageSize: 10,
  getRowId: row => row.id,
})

async function loadModels() {
  loadingModels.value = true
  applyError.value = ''

  try {
    const response = await gpustack.listModels({ page: -1 })
    models.value = response.items

    const responses = await Promise.all(
      selectableModels.value.map(async model => {
        const instances = await gpustack.listModelInstances(model.id, { page: -1 })

        return instances.items.map(instance => createInstanceRow(model, instance))
      })
    )

    instanceRows.value = responses.flat()
  } catch (error: any) {
    instanceRows.value = []
    applyError.value = error?.message || t('Failed to load GPUStack models.')
    message.error(applyError.value)
  } finally {
    loadingModels.value = false
  }
}

function createInstanceRow(model: GpustackModel, instance: GpustackModelInstance): LaketokenInstanceRow {
  return {
    id: `${model.id}:${instance.id}`,
    modelId: model.id,
    modelName: model.name,
    instanceId: instance.id,
    instanceName: instance.name,
    state: instance.state || 'Unknown',
    backendVersion: model.backend_version || 'Unknown',
  }
}

function getModelSourcePayload(model: GpustackModel) {
  if (model.source === 'huggingface') {
    return {
      source: model.source,
      huggingface_repo_id: model.huggingface_repo_id,
      huggingface_filename: model.huggingface_filename,
    }
  }

  if (model.source === 'model_scope') {
    return {
      source: model.source,
      model_scope_model_id: model.model_scope_model_id,
      model_scope_file_path: model.model_scope_file_path,
    }
  }

  if (model.source === 'local_path') {
    return {
      source: model.source,
      local_path: model.local_path,
    }
  }

  return {
    source: model.source,
  }
}

async function openEditDialog(row: LaketokenInstanceRow) {
  loadingEditor.value = true
  applyError.value = ''
  applySuccess.value = ''

  try {
    const model = await gpustack.getModel(row.modelId)

    editingRow.value = row
    editingModel.value = model
    form.value = extractLaketokenForm(model)
    editOpen.value = true
  } catch (error: any) {
    applyError.value = error?.message || t('Failed to load GPUStack model details.')
    message.error(applyError.value)
  } finally {
    loadingEditor.value = false
  }
}

async function openMonitor() {
  await router.push({
    path: '/dashboard',
    query: {
      target: LAKETOKEN_MONITOR_TARGET,
      source: LAKETOKEN_MONITOR_SOURCE,
    },
  })
}

async function refreshPage() {
  await loadModels()
}

async function reloadEditingModel() {
  if (!editingRow.value) {
    return
  }

  await openEditDialog(editingRow.value)
}

async function applyConfiguration() {
  if (!editingModel.value) {
    return
  }

  if (validationErrors.value.length > 0) {
    applyError.value = validationErrors.value.join(' ')
    const [firstError, ...remainingErrors] = validationErrors.value

    message.error(firstError || t('LakeToken configuration is invalid.'), {
      description: remainingErrors.join(' '),
    })
    return
  }

  const loadingHandle = message.loading(t('Applying LakeToken configuration...'), { duration: 0 })
  applyError.value = ''
  applySuccess.value = ''
  applying.value = true

  try {
    const payload = {
      name: editingModel.value.name,
      ...getModelSourcePayload(editingModel.value),
      ...applyLaketokenForm(editingModel.value, form.value),
    }

    await gpustack.updateModel(editingModel.value.id, payload)

    const instances = await gpustack.listModelInstances(editingModel.value.id, { page: -1 })
    await Promise.all(instances.items.map(instance => gpustack.deleteModelInstance(instance.id)))

    applySuccess.value =
      instances.items.length > 0
        ? t('Configuration applied. GPUStack is recreating the serving instances.')
        : t('Configuration applied. No running instances required recreation.')

    message.success(applySuccess.value)
    editOpen.value = false
    await refreshPage()
  } catch (error: any) {
    applyError.value = error?.message || t('Failed to apply LakeToken configuration.')
    message.error(t('Failed to apply LakeToken configuration'), {
      description: applyError.value,
    })
  } finally {
    applying.value = false
    loadingHandle.destroy()
  }
}

onMounted(() => {
  void loadModels()
})
</script>

<template>
  <Page>
    <PageHeader>
      <h1 class="text-2xl font-bold">{{ t('LakeToken') }}</h1>
      <template #actions>
        <Button variant="outline" :disabled="loadingModels || loadingEditor || applying" @click="refreshPage">
          {{ t('Refresh') }}
        </Button>
      </template>
    </PageHeader>

    <div class="space-y-4">
      <div
        v-if="applyError && !editOpen"
        class="rounded-md border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive"
      >
        {{ applyError }}
      </div>

      <div v-if="applySuccess" class="rounded-md border border-green-500/30 bg-green-500/5 p-4 text-sm text-green-700">
        {{ applySuccess }}
      </div>

      <DataTable
        :table="table"
        :is-loading="loadingModels"
        :empty-title="t('No model instances')"
        :empty-description="t('No GPUStack vLLM model instances are currently available for LakeToken management.')"
      />
      <DataTablePagination :table="table" />
    </div>

    <Modal
      v-model="editOpen"
      :title="t('Edit KV Cache Configuration')"
      :description="t('Update the selected model instance\'s parent GPUStack model configuration.')"
      size="lg"
      :close-on-backdrop="!applying"
      :close-on-escape="!applying"
    >
      <div v-if="editingRow" class="space-y-6">
        <div class="rounded-md border bg-muted/20 p-4 text-sm text-muted-foreground">
          {{
            t(
              'Editing {instanceName} updates the parent model {modelName} and recreates all of its running instances.',
              {
                instanceName: editingRow.instanceName,
                modelName: editingRow.modelName,
              }
            )
          }}
        </div>

        <div class="grid gap-4 md:grid-cols-2">
          <div class="rounded-md border p-4">
            <div class="flex items-start justify-between gap-4">
              <div>
                <h3 class="font-medium">{{ t('KV cache') }}</h3>
                <p class="text-sm text-muted-foreground">
                  {{ t('Enable LMCache-backed KV transfer for this model.') }}
                </p>
              </div>
              <Switch v-model="form.kvCacheEnabled" :disabled="loadingEditor || applying" />
            </div>
          </div>

          <div class="rounded-md border p-4">
            <div class="flex items-start justify-between gap-4">
              <div>
                <h3 class="font-medium">{{ t('Prefix caching') }}</h3>
                <p class="text-sm text-muted-foreground">
                  {{ t('Manage the `--enable-prefix-caching` backend flag independently.') }}
                </p>
              </div>
              <Switch v-model="form.prefixCachingEnabled" :disabled="loadingEditor || applying" />
            </div>
          </div>
        </div>

        <div class="space-y-3">
          <h3 class="text-sm font-medium">{{ t('Environment Variables') }}</h3>

          <div class="grid gap-3">
            <div class="grid items-center gap-3 rounded-md border px-4 py-3 md:grid-cols-[260px_minmax(0,1fr)]">
              <div>
                <p class="text-sm font-medium">LMCACHE_USE_EXPERIMENTAL</p>
                <p class="text-xs text-muted-foreground">{{ t('Enable the experimental LMCache mode.') }}</p>
              </div>
              <div class="flex justify-start md:justify-end">
                <Switch v-model="form.lmcacheUseExperimental" :disabled="!form.kvCacheEnabled || applying" />
              </div>
            </div>

            <div class="grid items-center gap-3 rounded-md border px-4 py-3 md:grid-cols-[260px_minmax(0,1fr)]">
              <div>
                <p class="text-sm font-medium">LMCACHE_CHUNK_SIZE</p>
                <p class="text-xs text-muted-foreground">
                  {{ t('Chunk size used by LMCache when KV cache is enabled.') }}
                </p>
              </div>
              <Input v-model="form.lmcacheChunkSize" :disabled="!form.kvCacheEnabled || applying" />
            </div>

            <div class="grid items-center gap-3 rounded-md border px-4 py-3 md:grid-cols-[260px_minmax(0,1fr)]">
              <div>
                <p class="text-sm font-medium">LMCACHE_LOCAL_CPU</p>
                <p class="text-xs text-muted-foreground">{{ t('Enable local CPU cache storage.') }}</p>
              </div>
              <div class="flex justify-start md:justify-end">
                <Switch v-model="form.lmcacheLocalCpu" :disabled="!form.kvCacheEnabled || applying" />
              </div>
            </div>

            <div class="grid items-center gap-3 rounded-md border px-4 py-3 md:grid-cols-[260px_minmax(0,1fr)]">
              <div>
                <p class="text-sm font-medium">LMCACHE_MAX_LOCAL_CPU_SIZE</p>
                <p class="text-xs text-muted-foreground">{{ t('Maximum local CPU cache size.') }}</p>
              </div>
              <Input v-model="form.lmcacheMaxLocalCpuSize" :disabled="!form.kvCacheEnabled || applying" />
            </div>

            <div class="grid items-center gap-3 rounded-md border px-4 py-3 md:grid-cols-[260px_minmax(0,1fr)]">
              <div>
                <p class="text-sm font-medium">LMCACHE_LOCAL_DISK</p>
                <p class="text-xs text-muted-foreground">{{ t('Disk path used for LMCache local storage.') }}</p>
              </div>
              <Input v-model="form.lmcacheLocalDisk" :disabled="!form.kvCacheEnabled || applying" />
            </div>

            <div class="grid items-center gap-3 rounded-md border px-4 py-3 md:grid-cols-[260px_minmax(0,1fr)]">
              <div>
                <p class="text-sm font-medium">LMCACHE_MAX_LOCAL_DISK_SIZE</p>
                <p class="text-xs text-muted-foreground">{{ t('Maximum local disk cache size.') }}</p>
              </div>
              <Input v-model="form.lmcacheMaxLocalDiskSize" :disabled="!form.kvCacheEnabled || applying" />
            </div>

            <div class="grid items-center gap-3 rounded-md border px-4 py-3 md:grid-cols-[260px_minmax(0,1fr)]">
              <div>
                <p class="text-sm font-medium">PROMETHEUS_MULTIPROC_DIR</p>
                <p class="text-xs text-muted-foreground">
                  {{ t('Optional metrics directory for enabling LMCache Prometheus multiprocess metrics.') }}
                </p>
              </div>
              <Input v-model="form.prometheusMultiprocDir" :disabled="!form.kvCacheEnabled || applying" />
            </div>
          </div>
        </div>

        <div
          v-if="validationErrors.length > 0"
          class="rounded-md border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive"
        >
          <p class="font-medium">{{ t('Validation issues') }}</p>
          <ul class="mt-2 list-disc pl-5">
            <li v-for="error in validationErrors" :key="error">{{ error }}</li>
          </ul>
        </div>

        <div
          v-if="applyError && editOpen"
          class="rounded-md border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive"
        >
          {{ applyError }}
        </div>
      </div>

      <template #footer>
        <div class="flex flex-wrap items-center justify-end gap-2">
          <Button variant="outline" :disabled="loadingEditor || applying" @click="reloadEditingModel">{{
            t('Reload')
          }}</Button>
          <Button variant="outline" :disabled="applying" @click="editOpen = false">{{ t('Cancel') }}</Button>
          <Button :disabled="loadingEditor || applying || !editingModel" @click="applyConfiguration">
            {{ applying ? t('Applying…') : t('Apply Configuration') }}
          </Button>
        </div>
      </template>
    </Modal>
  </Page>
</template>
