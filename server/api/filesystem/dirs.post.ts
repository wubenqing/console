import { createDirectory } from '~/server/utils/filesystem'

export default defineEventHandler(async event => {
  const body = await readBody(event)
  const name = String(body?.name ?? '').trim()
  if (!name) {
    throw createError({ statusCode: 400, statusMessage: 'Directory name is required' })
  }
  return await createDirectory({ name })
})
