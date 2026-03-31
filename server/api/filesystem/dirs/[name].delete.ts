import { deleteDirectory } from '~/server/utils/filesystem'

export default defineEventHandler(async event => {
  const name = getRouterParam(event, 'name')
  if (!name) {
    throw createError({ statusCode: 400, statusMessage: 'Directory name is required' })
  }
  await deleteDirectory(name)
  return { success: true }
})
