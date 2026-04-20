import { describe, expect, it, vi } from 'vitest'

import {
  assertGpustackModelAllowed,
  buildGpustackUrl,
  getGpustackConfig,
  requestGpustack,
} from '~/server/utils/gpustack'

describe('gpustack server integration', () => {
  it('reads private gpustack runtime config', () => {
    const config = getGpustackConfig({
      gpustack: {
        apiUrl: 'http://gpustack.example.com/v2/',
        apiKey: 'secret-key',
        allowedModelNames: ' qwen3-14b , llama-3.1-8b ',
      },
    })

    expect(config).toEqual({
      apiUrl: 'http://gpustack.example.com/v2',
      apiKey: 'secret-key',
      allowedModelNames: ['qwen3-14b', 'llama-3.1-8b'],
    })
  })

  it('blocks mutations for models outside the configured allowlist', () => {
    expect(() =>
      assertGpustackModelAllowed('qwen2.5-7b', {
        apiUrl: 'http://gpustack.example.com/v2',
        apiKey: 'secret-key',
        allowedModelNames: ['qwen3-14b'],
      })
    ).toThrow('LakeToken mutations are not allowed for model "qwen2.5-7b"')

    expect(() =>
      assertGpustackModelAllowed('qwen3-14b', {
        apiUrl: 'http://gpustack.example.com/v2',
        apiKey: 'secret-key',
        allowedModelNames: ['qwen3-14b'],
      })
    ).not.toThrow()
  })

  it('throws when private gpustack config is missing', () => {
    expect(() => getGpustackConfig({ gpustack: { apiUrl: '', apiKey: '' } })).toThrow(
      'GPUStack server configuration is incomplete'
    )
  })

  it('builds gpustack urls with query params', () => {
    const url = buildGpustackUrl('http://gpustack.example.com/v2', '/models', {
      page: 1,
      perPage: 10,
      search: 'qwen',
    })

    expect(url).toBe('http://gpustack.example.com/v2/models?page=1&perPage=10&search=qwen')
  })

  it('sends authenticated requests to gpustack', async () => {
    const fetcher = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      headers: {
        get: (key: string) => (key === 'content-type' ? 'application/json' : null),
      },
      json: async () => ({ items: [] }),
      text: async () => '',
    })

    const result = await requestGpustack(
      {
        apiUrl: 'http://gpustack.example.com/v2',
        apiKey: 'secret-key',
        allowedModelNames: [],
      },
      '/models',
      {
        query: { page: 1, perPage: 1 },
      },
      fetcher
    )

    expect(result).toEqual({ items: [] })
    expect(fetcher).toHaveBeenCalledWith(
      'http://gpustack.example.com/v2/models?page=1&perPage=1',
      expect.objectContaining({
        method: 'GET',
        headers: expect.objectContaining({
          'X-API-Key': 'secret-key',
          Accept: 'application/json',
        }),
      })
    )
  })
})
