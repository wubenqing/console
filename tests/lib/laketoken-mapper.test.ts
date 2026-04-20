import { describe, expect, it } from 'vitest'

import { applyLaketokenForm, createDefaultLaketokenForm, extractLaketokenForm } from '~/lib/gpustack/laketoken'

describe('laketoken mapper', () => {
  const model = {
    id: 2,
    name: 'qwen3-14b',
    backend_parameters: [
      '--gpu-memory-utilization=0.9',
      '--kv-transfer-config={"kv_connector":"LMCacheConnectorV1", "kv_role":"kv_both"}',
      '--enable-prefix-caching',
    ],
    env: {
      LMCACHE_USE_EXPERIMENTAL: 'True',
      LMCACHE_CHUNK_SIZE: '256',
      LMCACHE_LOCAL_CPU: 'True',
      LMCACHE_MAX_LOCAL_CPU_SIZE: '64.0',
      LMCACHE_LOCAL_DISK: '"/vllm-workspace/mnt/kvcache"',
      LMCACHE_MAX_LOCAL_DISK_SIZE: '256.0',
      PROMETHEUS_MULTIPROC_DIR: '/vllm-workspace/mnt/lmcache_prometheus',
      OTHER_ENV: 'keep-me',
    },
  }

  it('extracts laketoken form values from a gpustack model', () => {
    const form = extractLaketokenForm(model)

    expect(form.kvCacheEnabled).toBe(true)
    expect(form.prefixCachingEnabled).toBe(true)
    expect(form.kvTransferConfig).toBe('{"kv_connector":"LMCacheConnectorV1", "kv_role":"kv_both"}')
    expect(form.lmcacheLocalDisk).toBe('/vllm-workspace/mnt/kvcache')
    expect(form.prometheusMultiprocDir).toBe('/vllm-workspace/mnt/lmcache_prometheus')
  })

  it('creates sensible defaults when managed config is absent', () => {
    const form = extractLaketokenForm({
      backend_parameters: ['--other-flag'],
      env: {},
    })

    expect(form).toEqual(createDefaultLaketokenForm())
  })

  it('preserves unrelated settings and normalizes managed values on save', () => {
    const payload = applyLaketokenForm(model, {
      kvCacheEnabled: true,
      prefixCachingEnabled: false,
      kvTransferConfig: '{"kv_connector":"LMCacheConnectorV1","kv_role":"kv_both"}',
      lmcacheUseExperimental: true,
      lmcacheChunkSize: '512',
      lmcacheLocalCpu: true,
      lmcacheMaxLocalCpuSize: '128',
      lmcacheLocalDisk: '"/cache/path"',
      lmcacheMaxLocalDiskSize: '512',
      prometheusMultiprocDir: '/metrics/path',
    })

    expect(payload.backend_parameters).toEqual([
      '--gpu-memory-utilization=0.9',
      '--kv-transfer-config={"kv_connector":"LMCacheConnectorV1","kv_role":"kv_both"}',
    ])
    expect(payload.env).toEqual({
      OTHER_ENV: 'keep-me',
      LMCACHE_USE_EXPERIMENTAL: 'True',
      LMCACHE_CHUNK_SIZE: '512',
      LMCACHE_LOCAL_CPU: 'True',
      LMCACHE_MAX_LOCAL_CPU_SIZE: '128',
      LMCACHE_LOCAL_DISK: '/cache/path',
      LMCACHE_MAX_LOCAL_DISK_SIZE: '512',
      PROMETHEUS_MULTIPROC_DIR: '/metrics/path',
    })
  })

  it('removes managed configuration when kv cache is disabled', () => {
    const payload = applyLaketokenForm(model, {
      ...createDefaultLaketokenForm(),
      kvCacheEnabled: false,
    })

    expect(payload.backend_parameters).toEqual(['--gpu-memory-utilization=0.9'])
    expect(payload.env).toEqual({
      OTHER_ENV: 'keep-me',
    })
  })

  it('omits PROMETHEUS_MULTIPROC_DIR when the field is left empty', () => {
    const payload = applyLaketokenForm(model, {
      kvCacheEnabled: true,
      prefixCachingEnabled: true,
      kvTransferConfig: '{"kv_connector":"LMCacheConnectorV1","kv_role":"kv_both"}',
      lmcacheUseExperimental: true,
      lmcacheChunkSize: '256',
      lmcacheLocalCpu: true,
      lmcacheMaxLocalCpuSize: '64.0',
      lmcacheLocalDisk: '/vllm-workspace/mnt/kvcache',
      lmcacheMaxLocalDiskSize: '256.0',
      prometheusMultiprocDir: '   ',
    })

    expect(payload.env).toEqual({
      OTHER_ENV: 'keep-me',
      LMCACHE_USE_EXPERIMENTAL: 'True',
      LMCACHE_CHUNK_SIZE: '256',
      LMCACHE_LOCAL_CPU: 'True',
      LMCACHE_MAX_LOCAL_CPU_SIZE: '64.0',
      LMCACHE_LOCAL_DISK: '/vllm-workspace/mnt/kvcache',
      LMCACHE_MAX_LOCAL_DISK_SIZE: '256.0',
    })
  })

  it('keeps prefix caching independent when kv cache is disabled', () => {
    const payload = applyLaketokenForm(model, {
      ...createDefaultLaketokenForm(),
      kvCacheEnabled: false,
      prefixCachingEnabled: true,
    })

    expect(payload.backend_parameters).toEqual(['--gpu-memory-utilization=0.9', '--enable-prefix-caching'])
    expect(payload.env).toEqual({
      OTHER_ENV: 'keep-me',
    })
  })
})
