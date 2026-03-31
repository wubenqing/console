import { mountDirectory } from '~/server/utils/filesystem'

export default defineEventHandler(async event => {
  const name = getRouterParam(event, 'name')
  if (!name) {
    throw createError({ statusCode: 400, statusMessage: 'Directory name is required' })
  }
  const body = await readBody(event)
  const host = String(body?.host ?? '').trim()
  const mountPath = String(body?.mountPath ?? '').trim()
  if (!host || !mountPath) {
    throw createError({ statusCode: 400, statusMessage: 'Host and mountPath are required' })
  }
  return await mountDirectory(name, { host, mountPath })
})
