import { getGpustackConfig, GpustackRequestError, requestGpustack } from '~/server/utils/gpustack'

export default defineEventHandler(async event => {
  try {
    const config = getGpustackConfig(useRuntimeConfig(event))

    return await requestGpustack(config, `/model-instances/${getRouterParam(event, 'id')}`, {
      method: 'DELETE',
    })
  } catch (error) {
    if (error instanceof GpustackRequestError) {
      throw createError({
        statusCode: error.statusCode,
        statusMessage: error.message,
        data: error.payload,
      })
    }

    throw createError({
      statusCode: 500,
      statusMessage: error instanceof Error ? error.message : 'GPUStack request failed',
    })
  }
})
