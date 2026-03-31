import { listDirectories } from '~/server/utils/filesystem'

export default defineEventHandler(async event => {
  const name = getRouterParam(event, 'name')
  if (!name) {
    throw createError({ statusCode: 400, statusMessage: 'Directory name is required' })
  }
  const dirs = await listDirectories()
  const dir = dirs.find(d => d.name === name)
  if (!dir) {
    throw createError({ statusCode: 404, statusMessage: 'Directory not found' })
  }
  return dir
})
