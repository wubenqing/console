import type { DirectoryEntry, DirectorySummary } from '~/types/filesystem'

export const useFilesystem = () => {
  const listDirectories = async (): Promise<DirectorySummary[]> => {
    return await $fetch<DirectorySummary[]>('/api/filesystem/dirs')
  }

  const getDirectory = async (name: string): Promise<DirectoryEntry> => {
    return await $fetch<DirectoryEntry>(`/api/filesystem/dirs/${encodeURIComponent(name)}`)
  }

  const createDirectory = async (name: string): Promise<DirectoryEntry> => {
    return await $fetch<DirectoryEntry>('/api/filesystem/dirs', {
      method: 'POST',
      body: { name },
    })
  }

  const deleteDirectory = async (name: string): Promise<void> => {
    await $fetch(`/api/filesystem/dirs/${encodeURIComponent(name)}`, {
      method: 'DELETE',
    })
  }

  const mountDirectory = async (dirName: string, host: string, mountPath: string): Promise<DirectoryEntry> => {
    return await $fetch<DirectoryEntry>(`/api/filesystem/dirs/${encodeURIComponent(dirName)}/mount`, {
      method: 'POST',
      body: { host, mountPath },
    })
  }

  const unmountDirectory = async (dirName: string, host: string, mountPath: string): Promise<DirectoryEntry> => {
    return await $fetch<DirectoryEntry>(`/api/filesystem/dirs/${encodeURIComponent(dirName)}/unmount`, {
      method: 'POST',
      body: { host, mountPath },
    })
  }

  return {
    listDirectories,
    getDirectory,
    createDirectory,
    deleteDirectory,
    mountDirectory,
    unmountDirectory,
  }
}
