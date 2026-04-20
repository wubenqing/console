import {
  assertGpustackModelAllowed,
  getGpustackConfig,
  GpustackRequestError,
  requestGpustack,
} from '~/server/utils/gpustack'

export default defineEventHandler(async event => {
  try {
    const config = getGpustackConfig(useRuntimeConfig(event))
    const body = await readBody(event)
    const currentModel = await requestGpustack<{ name?: string }>(config, `/models/${getRouterParam(event, 'id')}`)

    assertGpustackModelAllowed(currentModel.name || '', config)

    return await requestGpustack(config, `/models/${getRouterParam(event, 'id')}`, {
      method: 'PUT',
      body,
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
