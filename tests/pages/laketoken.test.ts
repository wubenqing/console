import { flushPromises, mount } from '@vue/test-utils'
import { FlexRender } from '@tanstack/vue-table'
import { defineComponent } from 'vue'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import LaketokenPage from '~/pages/ai-datalake/laketoken.vue'
import type { GpustackModel, GpustackModelInstance, GpustackPageResponse } from '~/types/gpustack'

const mocks = vi.hoisted(() => {
  const loadingDestroy = vi.fn()

  return {
    loadingDestroy,
    router: {
      push: vi.fn(),
    },
    gpustack: {
      listModels: vi.fn(),
      getModel: vi.fn(),
      updateModel: vi.fn(),
      listModelInstances: vi.fn(),
      deleteModelInstance: vi.fn(),
    },
    message: {
      success: vi.fn(),
      error: vi.fn(),
      warning: vi.fn(),
      info: vi.fn(),
      loading: vi.fn(() => ({ destroy: loadingDestroy })),
      destroyAll: vi.fn(),
    },
    runtimeConfig: {
      public: {
        gpustack: {
          allowedModelNames: [] as string[],
        },
      },
    },
  }
})

vi.mock('~/composables/useGpustack', () => ({
  useGpustack: () => mocks.gpustack,
}))

vi.mock('~/composables/ui', () => ({
  useMessage: () => mocks.message,
}))

vi.mock('#imports', () => ({
  useRuntimeConfig: () => mocks.runtimeConfig,
  useRouter: () => mocks.router,
}))

vi.mock('vue-i18n', () => ({
  useI18n: () => ({
    t: (key: string, params?: Record<string, string | number>) => {
      if (!params) {
        return key
      }

      return Object.entries(params).reduce(
        (text, [paramKey, value]) => text.replaceAll(`{${paramKey}}`, String(value)),
        key
      )
    },
  }),
}))

const pageResponse = <T>(items: T[]): GpustackPageResponse<T> => ({
  items,
  pagination: {
    page: 1,
    perPage: items.length || 1,
    total: items.length,
    totalPage: 1,
  },
})

const baseModel: GpustackModel = {
  id: 7,
  name: 'Qwen 2.5 7B',
  backend: 'vLLM',
  backend_version: '0.8.5',
  replicas: 1,
  ready_replicas: 1,
}

const allowedModel: GpustackModel = {
  id: 8,
  name: 'qwen3-14b',
  backend: 'vLLM',
  backend_version: '0.8.5',
  replicas: 1,
  ready_replicas: 1,
}

const configuredModel: GpustackModel = {
  ...baseModel,
  source: 'local_path',
  local_path: '/models/qwen3-14b',
  backend_parameters: [
    '--served-model-name=qwen2.5',
    '--kv-transfer-config={"kv_connector":"LMCacheConnectorV1","kv_role":"kv_both"}',
    '--enable-prefix-caching',
  ],
  env: {
    KEEP_ME: '1',
    LMCACHE_USE_EXPERIMENTAL: 'True',
    LMCACHE_CHUNK_SIZE: '256',
    LMCACHE_LOCAL_CPU: 'True',
    LMCACHE_MAX_LOCAL_CPU_SIZE: '64.0',
    LMCACHE_LOCAL_DISK: '"/var/lib/lmcache"',
    LMCACHE_MAX_LOCAL_DISK_SIZE: '256.0',
    PROMETHEUS_MULTIPROC_DIR: '/var/lib/lmcache/metrics',
  },
}

const instance: GpustackModelInstance = {
  id: 88,
  model_id: 7,
  name: 'qwen-instance-1',
  state: 'running',
}

const allowedInstance: GpustackModelInstance = {
  id: 99,
  model_id: 8,
  name: 'qwen3-14b-instance-1',
  state: 'running',
}

const slotStub = (name: string) =>
  defineComponent({
    name,
    template: '<div><slot /></div>',
  })

const ButtonStub = defineComponent({
  name: 'Button',
  props: {
    disabled: Boolean,
  },
  emits: ['click'],
  template: '<button :disabled="disabled" @click="$emit(\'click\', $event)"><slot /></button>',
})

const InputStub = defineComponent({
  name: 'Input',
  props: {
    modelValue: {
      type: String,
      default: '',
    },
    disabled: Boolean,
  },
  emits: ['update:modelValue'],
  template:
    '<input :value="modelValue" :disabled="disabled" @input="$emit(\'update:modelValue\', $event.target.value)" />',
})

const TextareaStub = defineComponent({
  name: 'Textarea',
  props: {
    modelValue: {
      type: String,
      default: '',
    },
    disabled: Boolean,
  },
  emits: ['update:modelValue'],
  template:
    '<textarea :value="modelValue" :disabled="disabled" @input="$emit(\'update:modelValue\', $event.target.value)"></textarea>',
})

const SwitchStub = defineComponent({
  name: 'Switch',
  props: {
    modelValue: Boolean,
    disabled: Boolean,
  },
  emits: ['update:modelValue'],
  template:
    '<input type="checkbox" :checked="modelValue" :disabled="disabled" @change="$emit(\'update:modelValue\', $event.target.checked)" />',
})

const DataTableStub = defineComponent({
  name: 'DataTable',
  props: {
    table: {
      type: Object,
      required: true,
    },
    isLoading: Boolean,
  },
  components: {
    FlexRender,
  },
  template: `
    <div>
      <div v-if="isLoading">Loading...</div>
      <table v-else>
        <tbody>
          <tr v-for="row in table.getRowModel().rows" :key="row.id">
            <td v-for="cell in row.getVisibleCells()" :key="cell.id">
              <FlexRender :render="cell.column.columnDef.cell" :props="cell.getContext()" />
            </td>
          </tr>
        </tbody>
      </table>
      <slot name="empty" v-if="table.getRowModel().rows.length === 0" />
    </div>
  `,
})

const ModalStub = defineComponent({
  name: 'Modal',
  props: {
    modelValue: Boolean,
    title: {
      type: String,
      default: '',
    },
  },
  emits: ['update:modelValue'],
  template: `
    <div v-if="modelValue" data-test="modal">
      <h2>{{ title }}</h2>
      <slot />
      <slot name="footer" />
    </div>
  `,
})

const testStubs = {
  Page: slotStub('Page'),
  PageHeader: defineComponent({
    name: 'PageHeader',
    template: '<div><slot /><slot name="description" /><slot name="actions" /></div>',
  }),
  Card: slotStub('Card'),
  CardContent: slotStub('CardContent'),
  CardDescription: slotStub('CardDescription'),
  CardHeader: slotStub('CardHeader'),
  CardTitle: slotStub('CardTitle'),
  DataTable: DataTableStub,
  DataTablePagination: slotStub('DataTablePagination'),
  Modal: ModalStub,
  Button: ButtonStub,
  Input: InputStub,
  Textarea: TextareaStub,
  Switch: SwitchStub,
  Icon: slotStub('Icon'),
}

async function flushPage() {
  await flushPromises()
  await flushPromises()
  await flushPromises()
}

async function mountPage() {
  const wrapper = mount(LaketokenPage, {
    global: {
      stubs: testStubs,
    },
  })

  await flushPage()
  return wrapper
}

describe('LakeToken page', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.runtimeConfig.public.gpustack.allowedModelNames = []

    mocks.message.loading.mockImplementation(() => ({ destroy: mocks.loadingDestroy }))
    mocks.gpustack.listModels.mockResolvedValue(pageResponse([baseModel]))
    mocks.gpustack.getModel.mockResolvedValue(configuredModel)
    mocks.gpustack.updateModel.mockResolvedValue(configuredModel)
    mocks.gpustack.listModelInstances.mockImplementation((id: number | string) => {
      if (String(id) === '8') {
        return Promise.resolve(pageResponse([allowedInstance]))
      }

      return Promise.resolve(pageResponse([instance]))
    })
    mocks.gpustack.deleteModelInstance.mockResolvedValue({})
  })

  it('loads vLLM model instances into a table and applies configuration from the edit modal', async () => {
    const wrapper = await mountPage()

    expect(mocks.gpustack.listModels).toHaveBeenCalledWith({ page: -1 })
    expect(mocks.gpustack.listModelInstances).toHaveBeenCalledWith(7, { page: -1 })
    expect(wrapper.text()).toContain('Qwen 2.5 7B')
    expect(wrapper.text()).toContain('qwen-instance-1')
    expect(wrapper.text()).not.toContain(
      'Configure GPUStack-backed vLLM KV cache settings through a focused LakeToken workflow.'
    )
    expect(wrapper.text()).not.toContain(
      'Only allowlisted GPUStack vLLM model instances are shown in this production-safe view.'
    )

    const editButton = wrapper.findAll('button').find(button => button.text().includes('Edit'))

    expect(editButton).toBeDefined()

    await editButton!.trigger('click')
    await flushPage()

    expect(mocks.gpustack.getModel).toHaveBeenCalledWith(7)
    expect(wrapper.text()).toContain('LMCACHE_USE_EXPERIMENTAL')
    expect(wrapper.text()).toContain('LMCACHE_LOCAL_DISK')
    expect(wrapper.text()).toContain('PROMETHEUS_MULTIPROC_DIR')
    expect(wrapper.text()).not.toContain('KV transfer config')

    const applyButton = wrapper.findAll('button').find(button => button.text().includes('Apply Configuration'))

    expect(applyButton).toBeDefined()

    await applyButton!.trigger('click')
    await flushPage()

    expect(mocks.gpustack.updateModel).toHaveBeenCalledWith(
      7,
      expect.objectContaining({
        name: 'Qwen 2.5 7B',
        source: 'local_path',
        local_path: '/models/qwen3-14b',
        backend_parameters: [
          '--served-model-name=qwen2.5',
          '--kv-transfer-config={"kv_connector":"LMCacheConnectorV1","kv_role":"kv_both"}',
          '--enable-prefix-caching',
        ],
        env: {
          KEEP_ME: '1',
          LMCACHE_USE_EXPERIMENTAL: 'True',
          LMCACHE_CHUNK_SIZE: '256',
          LMCACHE_LOCAL_CPU: 'True',
          LMCACHE_MAX_LOCAL_CPU_SIZE: '64.0',
          LMCACHE_LOCAL_DISK: '/var/lib/lmcache',
          LMCACHE_MAX_LOCAL_DISK_SIZE: '256.0',
          PROMETHEUS_MULTIPROC_DIR: '/var/lib/lmcache/metrics',
        },
      })
    )
    expect(mocks.gpustack.listModelInstances).toHaveBeenCalledWith(7, { page: -1 })
    expect(mocks.gpustack.deleteModelInstance).toHaveBeenCalledWith(88)
    expect(mocks.message.success).toHaveBeenCalledWith(
      'Configuration applied. GPUStack is recreating the serving instances.'
    )
    expect(mocks.loadingDestroy).toHaveBeenCalled()
    expect(wrapper.text()).toContain('Configuration applied. GPUStack is recreating the serving instances.')
  })

  it('shows only allowlisted models when a gpustack model allowlist is configured', async () => {
    mocks.runtimeConfig.public.gpustack.allowedModelNames = ['qwen3-14b']
    mocks.gpustack.listModels.mockResolvedValue(pageResponse([baseModel, allowedModel]))
    mocks.gpustack.getModel.mockResolvedValue({
      ...configuredModel,
      id: allowedModel.id,
      name: allowedModel.name,
    })

    const wrapper = await mountPage()

    expect(mocks.gpustack.listModelInstances).toHaveBeenCalledTimes(1)
    expect(mocks.gpustack.listModelInstances).toHaveBeenCalledWith(8, { page: -1 })
    expect(wrapper.text()).toContain('qwen3-14b')
    expect(wrapper.text()).toContain('qwen3-14b-instance-1')
    expect(wrapper.text()).not.toContain('Qwen 2.5 7B')
  })

  it('navigates to the dashboard monitor view from the monitor action', async () => {
    const wrapper = await mountPage()
    const monitorButton = wrapper.findAll('button').find(button => button.text().includes('Monitor'))

    expect(monitorButton).toBeDefined()

    await monitorButton!.trigger('click')

    expect(mocks.router.push).toHaveBeenCalledWith({
      path: '/dashboard',
      query: {
        target: 'lmcache-main-v1',
        source: '/ai-datalake/laketoken',
      },
    })
  })

  it('surfaces apply failures without deleting instances', async () => {
    mocks.gpustack.updateModel.mockRejectedValue(new Error('GPUStack update failed'))

    const wrapper = await mountPage()
    const initialListInstanceCalls = mocks.gpustack.listModelInstances.mock.calls.length
    const editButton = wrapper.findAll('button').find(button => button.text().includes('Edit'))

    expect(editButton).toBeDefined()

    await editButton!.trigger('click')
    await flushPage()

    const applyButton = wrapper.findAll('button').find(button => button.text().includes('Apply Configuration'))

    expect(applyButton).toBeDefined()

    await applyButton!.trigger('click')
    await flushPage()

    expect(mocks.gpustack.listModelInstances).toHaveBeenCalledTimes(initialListInstanceCalls)
    expect(mocks.gpustack.deleteModelInstance).not.toHaveBeenCalled()
    expect(mocks.message.error).toHaveBeenCalledWith('Failed to apply LakeToken configuration', {
      description: 'GPUStack update failed',
    })
    expect(mocks.loadingDestroy).toHaveBeenCalled()
    expect(wrapper.text()).toContain('GPUStack update failed')
  })
})
