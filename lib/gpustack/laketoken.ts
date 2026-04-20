export interface GpustackModelConfig {
  backend_parameters?: string[]
  env?: Record<string, string>
}

export interface LaketokenFormState {
  kvCacheEnabled: boolean
  prefixCachingEnabled: boolean
  kvTransferConfig: string
  lmcacheUseExperimental: boolean
  lmcacheChunkSize: string
  lmcacheLocalCpu: boolean
  lmcacheMaxLocalCpuSize: string
  lmcacheLocalDisk: string
  lmcacheMaxLocalDiskSize: string
  prometheusMultiprocDir: string
}

const KV_TRANSFER_FLAG = '--kv-transfer-config'
const PREFIX_CACHING_FLAG = '--enable-prefix-caching'

const DEFAULT_KV_TRANSFER_CONFIG = '{"kv_connector":"LMCacheConnectorV1","kv_role":"kv_both"}'

export const MANAGED_ENV_KEYS = [
  'LMCACHE_USE_EXPERIMENTAL',
  'LMCACHE_CHUNK_SIZE',
  'LMCACHE_LOCAL_CPU',
  'LMCACHE_MAX_LOCAL_CPU_SIZE',
  'LMCACHE_LOCAL_DISK',
  'LMCACHE_MAX_LOCAL_DISK_SIZE',
  'PROMETHEUS_MULTIPROC_DIR',
] as const

function getBackendParameterValue(parameters: string[], flag: string): string | undefined {
  const exactPrefix = `${flag}=`
  const spacedPrefix = `${flag} `
  const entry = parameters.find(item => item.startsWith(exactPrefix) || item.startsWith(spacedPrefix))

  if (!entry) {
    return undefined
  }

  if (entry.startsWith(exactPrefix)) {
    return entry.slice(exactPrefix.length)
  }

  return entry.slice(spacedPrefix.length)
}

function hasBackendFlag(parameters: string[], flag: string): boolean {
  return parameters.some(item => item === flag || item.startsWith(`${flag}=`) || item.startsWith(`${flag} `))
}

function filterManagedBackendParameters(parameters: string[]): string[] {
  return parameters.filter(item => !hasBackendFlag([item], KV_TRANSFER_FLAG) && item !== PREFIX_CACHING_FLAG)
}

function filterManagedEnv(env: Record<string, string>): Record<string, string> {
  return Object.fromEntries(Object.entries(env).filter(([key]) => !MANAGED_ENV_KEYS.includes(key as never)))
}

function normalizeWrappedString(value: string | undefined): string {
  let normalized = (value || '').trim()

  while (
    (normalized.startsWith('"') && normalized.endsWith('"')) ||
    (normalized.startsWith("'") && normalized.endsWith("'"))
  ) {
    normalized = normalized.slice(1, -1).trim()
  }

  return normalized
}

function parseBoolean(value: string | undefined): boolean {
  return String(value || '') === 'True'
}

function formatBoolean(value: boolean): string {
  return value ? 'True' : 'False'
}

export function createDefaultLaketokenForm(): LaketokenFormState {
  return {
    kvCacheEnabled: false,
    prefixCachingEnabled: false,
    kvTransferConfig: DEFAULT_KV_TRANSFER_CONFIG,
    lmcacheUseExperimental: true,
    lmcacheChunkSize: '256',
    lmcacheLocalCpu: true,
    lmcacheMaxLocalCpuSize: '64.0',
    lmcacheLocalDisk: '',
    lmcacheMaxLocalDiskSize: '256.0',
    prometheusMultiprocDir: '',
  }
}

export function extractLaketokenForm(model: GpustackModelConfig): LaketokenFormState {
  const parameters = model.backend_parameters || []
  const env = model.env || {}

  const defaultForm = createDefaultLaketokenForm()
  const kvTransferConfig = getBackendParameterValue(parameters, KV_TRANSFER_FLAG)
  const kvCacheEnabled = Boolean(kvTransferConfig || MANAGED_ENV_KEYS.some(key => env[key]))

  if (!kvCacheEnabled && !hasBackendFlag(parameters, PREFIX_CACHING_FLAG)) {
    return defaultForm
  }

  return {
    kvCacheEnabled,
    prefixCachingEnabled: hasBackendFlag(parameters, PREFIX_CACHING_FLAG),
    kvTransferConfig: kvTransferConfig || defaultForm.kvTransferConfig,
    lmcacheUseExperimental: env.LMCACHE_USE_EXPERIMENTAL
      ? parseBoolean(env.LMCACHE_USE_EXPERIMENTAL)
      : defaultForm.lmcacheUseExperimental,
    lmcacheChunkSize: env.LMCACHE_CHUNK_SIZE || defaultForm.lmcacheChunkSize,
    lmcacheLocalCpu: env.LMCACHE_LOCAL_CPU ? parseBoolean(env.LMCACHE_LOCAL_CPU) : defaultForm.lmcacheLocalCpu,
    lmcacheMaxLocalCpuSize: env.LMCACHE_MAX_LOCAL_CPU_SIZE || defaultForm.lmcacheMaxLocalCpuSize,
    lmcacheLocalDisk: normalizeWrappedString(env.LMCACHE_LOCAL_DISK || defaultForm.lmcacheLocalDisk),
    lmcacheMaxLocalDiskSize: env.LMCACHE_MAX_LOCAL_DISK_SIZE || defaultForm.lmcacheMaxLocalDiskSize,
    prometheusMultiprocDir: normalizeWrappedString(env.PROMETHEUS_MULTIPROC_DIR || defaultForm.prometheusMultiprocDir),
  }
}

export function applyLaketokenForm(
  model: GpustackModelConfig,
  form: LaketokenFormState
): Pick<GpustackModelConfig, 'backend_parameters' | 'env'> {
  const backendParameters = filterManagedBackendParameters(model.backend_parameters || [])
  const env = filterManagedEnv(model.env || {})

  if (!form.kvCacheEnabled) {
    if (form.prefixCachingEnabled) {
      backendParameters.push(PREFIX_CACHING_FLAG)
    }

    return {
      backend_parameters: backendParameters,
      env,
    }
  }

  backendParameters.push(`${KV_TRANSFER_FLAG}=${form.kvTransferConfig.trim()}`)

  if (form.prefixCachingEnabled) {
    backendParameters.push(PREFIX_CACHING_FLAG)
  }

  return {
    backend_parameters: backendParameters,
    env: {
      ...env,
      LMCACHE_USE_EXPERIMENTAL: formatBoolean(form.lmcacheUseExperimental),
      LMCACHE_CHUNK_SIZE: form.lmcacheChunkSize.trim(),
      LMCACHE_LOCAL_CPU: formatBoolean(form.lmcacheLocalCpu),
      LMCACHE_MAX_LOCAL_CPU_SIZE: form.lmcacheMaxLocalCpuSize.trim(),
      LMCACHE_LOCAL_DISK: normalizeWrappedString(form.lmcacheLocalDisk),
      LMCACHE_MAX_LOCAL_DISK_SIZE: form.lmcacheMaxLocalDiskSize.trim(),
      ...(form.prometheusMultiprocDir.trim()
        ? {
            PROMETHEUS_MULTIPROC_DIR: normalizeWrappedString(form.prometheusMultiprocDir),
          }
        : {}),
    },
  }
}
