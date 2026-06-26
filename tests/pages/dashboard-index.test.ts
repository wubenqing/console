import { mount } from '@vue/test-utils'
import { defineComponent } from 'vue'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import DashboardPage from '~/pages/dashboard/index.vue'

const mocks = vi.hoisted(() => ({
  router: {
    push: vi.fn(),
    back: vi.fn(),
  },
  route: {
    query: {} as Record<string, string>,
  },
  runtimeConfig: {
    public: {
      grafana: {
        url: 'http://grafana.example.com/',
        dashboard: {
          id: 'rustfs-s3',
          slug: 'rustfs dashboard',
        },
        refreshInterval: '15s',
        timeRange: 'now-1h',
        defaultParams: {
          'var-datasource': 'prometheus',
          'var-job': '$__all',
          'var-path': '$__all',
          'var-bucket': '$__all',
          'var-drive': '$__all',
        },
        laketokenMonitor: {
          dashboard: {
            id: 'lmcache-main-v1',
            slug: 'lmcache',
          },
          refreshInterval: '5s',
          timeRange: 'now-1h',
          defaultParams: {
            'var-datasource': 'prometheus-1',
            'var-model_name': '$__all',
            'var-worker_id': '$__all',
          },
        },
      },
    },
  },
}))

vi.mock('#imports', () => ({
  useRoute: () => mocks.route,
  useRouter: () => mocks.router,
  useRuntimeConfig: () => mocks.runtimeConfig,
}))

const slotStub = (name: string) =>
  defineComponent({
    name,
    template: '<div><slot /><slot name="actions" /></div>',
  })

const ButtonStub = defineComponent({
  name: 'Button',
  emits: ['click'],
  template: '<button @click="$emit(\'click\', $event)"><slot /></button>',
})

describe('Dashboard page', () => {
  beforeEach(() => {
    mocks.route.query = {}
    vi.clearAllMocks()
  })

  it('keeps the default dashboard title and url when no monitor target is provided', () => {
    const wrapper = mount(DashboardPage, {
      global: {
        stubs: {
          Page: slotStub('Page'),
          PageHeader: slotStub('PageHeader'),
          Button: ButtonStub,
        },
      },
    })

    expect(wrapper.text()).toContain('仪表盘')
    expect(wrapper.text()).not.toContain('返回')
    expect(wrapper.find('iframe').attributes('src')).toContain('/d/rustfs-s3/rustfs%20dashboard')
    expect(wrapper.find('iframe').attributes('src')).toContain('var-job=%24__all')
  })

  it('renders monitor mode back button and the laketoken lmcache dashboard url', async () => {
    mocks.route.query = {
      target: 'lmcache-main-v1',
      source: '/ai-datalake/laketoken',
    }

    const wrapper = mount(DashboardPage, {
      global: {
        stubs: {
          Page: slotStub('Page'),
          PageHeader: slotStub('PageHeader'),
          Button: ButtonStub,
        },
      },
    })

    expect(wrapper.text()).not.toContain('监控')
    expect(wrapper.text()).not.toContain('lmcache-main-v1')
    expect(wrapper.text()).toContain('返回')
    expect(wrapper.find('iframe').attributes('src')).toContain('/d/lmcache-main-v1/lmcache')
    expect(wrapper.find('iframe').attributes('src')).toContain('refresh=5s')
    expect(wrapper.find('iframe').attributes('src')).toContain('var-datasource=prometheus-1')
    expect(wrapper.find('iframe').attributes('src')).toContain('var-model_name=%24__all')
    expect(wrapper.find('iframe').attributes('src')).toContain('var-worker_id=%24__all')
    expect(wrapper.find('iframe').attributes('src')).not.toContain('var-job=lmcache-main-v1')

    await wrapper.find('button').trigger('click')

    expect(mocks.router.push).toHaveBeenCalledWith('/ai-datalake/laketoken')
  })
})
