import { createSharedComposable } from '@vueuse/core'
import type { GpustackModel, GpustackModelInstance, GpustackPageResponse } from '~/types/gpustack'

export const useGpustack = createSharedComposable(() => {
  const apiBase = '/api/gpustack'

  const fetcher = async <T>(path: string, options: Parameters<typeof $fetch<T>>[1] = {}) => {
    try {
      return await $fetch<T>(path, {
        baseURL: apiBase,
        ...options,
      })
    } catch (error) {
      console.error(`[GPUStack API Error] ${path}:`, error)
      throw error
    }
  }

  const listModels = (query: Record<string, unknown> = { page: -1 }) =>
    fetcher<GpustackPageResponse<GpustackModel>>('/models', { query })

  const getModel = (id: number | string) => fetcher<GpustackModel>(`/models/${id}`)

  const updateModel = (id: number | string, body: Record<string, unknown>) =>
    fetcher<GpustackModel>(`/models/${id}`, {
      method: 'PUT',
      body,
    })

  const listModelInstances = (id: number | string, query: Record<string, unknown> = { page: -1 }) =>
    fetcher<GpustackPageResponse<GpustackModelInstance>>(`/models/${id}/instances`, { query })

  const deleteModelInstance = (id: number | string) =>
    fetcher(`/model-instances/${id}`, {
      method: 'DELETE',
    })

  return {
    listModels,
    getModel,
    updateModel,
    listModelInstances,
    deleteModelInstance,
  }
})
