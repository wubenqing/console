export interface GpustackConfig {
  apiUrl: string
  apiKey: string
  allowedModelNames: string[]
}

export interface GpustackRequestOptions {
  method?: string
  query?: Record<string, unknown>
  body?: unknown
  headers?: Record<string, string>
}

export class GpustackRequestError extends Error {
  statusCode: number
  payload?: unknown

  constructor(message: string, statusCode: number, payload?: unknown) {
    super(message)
    this.name = 'GpustackRequestError'
    this.statusCode = statusCode
    this.payload = payload
  }
}

export function getGpustackConfig(runtimeConfig: Record<string, any>): GpustackConfig {
  const apiUrl = String(runtimeConfig?.gpustack?.apiUrl || '').replace(/\/$/, '')
  const apiKey = String(runtimeConfig?.gpustack?.apiKey || '')
  const allowedModelNames = Array.isArray(runtimeConfig?.gpustack?.allowedModelNames)
    ? runtimeConfig.gpustack.allowedModelNames.map((name: unknown) => String(name).trim()).filter(Boolean)
    : String(runtimeConfig?.gpustack?.allowedModelNames || '')
        .split(',')
        .map(name => name.trim())
        .filter(Boolean)

  if (!apiUrl || !apiKey) {
    throw new Error('GPUStack server configuration is incomplete')
  }

  return {
    apiUrl,
    apiKey,
    allowedModelNames,
  }
}

export function assertGpustackModelAllowed(modelName: string, config: GpustackConfig): void {
  if (config.allowedModelNames.length === 0) {
    return
  }

  if (!config.allowedModelNames.includes(modelName)) {
    throw new Error(`LakeToken mutations are not allowed for model "${modelName}"`)
  }
}

export function buildGpustackUrl(apiUrl: string, path: string, query: Record<string, unknown> = {}): string {
  const url = new URL(path.replace(/^\//, ''), `${apiUrl.replace(/\/$/, '')}/`)

  for (const [key, value] of Object.entries(query)) {
    if (value === undefined || value === null || value === '') {
      continue
    }

    if (Array.isArray(value)) {
      for (const item of value) {
        if (item !== undefined && item !== null && item !== '') {
          url.searchParams.append(key, String(item))
        }
      }
      continue
    }

    url.searchParams.set(key, String(value))
  }

  return url.toString()
}

async function parseResponsePayload(response: Response): Promise<unknown> {
  const contentType = response.headers?.get?.('content-type') || ''

  if (response.status === 204) {
    return null
  }

  if (contentType.includes('application/json')) {
    return response.json()
  }

  return response.text()
}

export async function requestGpustack<T>(
  config: GpustackConfig,
  path: string,
  options: GpustackRequestOptions = {},
  fetcher: typeof fetch = fetch
): Promise<T> {
  const url = buildGpustackUrl(config.apiUrl, path, options.query)
  const method = options.method || 'GET'
  const headers: Record<string, string> = {
    Accept: 'application/json',
    'X-API-Key': config.apiKey,
    ...options.headers,
  }

  const requestInit: RequestInit = {
    method,
    headers,
  }

  if (options.body !== undefined && options.body !== null) {
    headers['Content-Type'] = 'application/json'
    requestInit.body = JSON.stringify(options.body)
  }

  let response: Response

  try {
    response = await fetcher(url, requestInit)
  } catch (error: any) {
    throw new GpustackRequestError(error?.message || 'Failed to reach GPUStack', 502)
  }

  const payload = await parseResponsePayload(response)

  if (!response.ok) {
    const message =
      typeof payload === 'string'
        ? payload
        : (payload as any)?.error?.message || (payload as any)?.message || 'GPUStack request failed'

    throw new GpustackRequestError(message, response.status, payload)
  }

  return payload as T
}
