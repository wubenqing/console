import { listDirectories } from '~/server/utils/filesystem'
import type { DirectorySummary } from '~/types/filesystem'

export default defineEventHandler(async (): Promise<DirectorySummary[]> => {
  const dirs = await listDirectories()
  return dirs.map(d => ({
    name: d.name,
    mountedHostCount: d.mounts.filter(m => m.status === 'mounted').length,
    mountedCount: d.mounts.length,
    createdAt: d.createdAt,
    statusSummary: d.mounts.length === 0 ? 'idle' : 'active',
  }))
})
