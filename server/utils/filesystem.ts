import type {
  CreateDirectoryRequest,
  DirectoryEntry,
  DirectoryRegistry,
  MountDirectoryRequest,
  UnmountDirectoryRequest,
} from '~/types/filesystem'

const NFS_AGENT_PORT = 18081
const MOUNT_AGENT_PORT = 18082

/**
 * Re-throw a FetchError from an agent call as an H3 createError so that
 * the detailed message in the agent's response body (FastAPI puts it in
 * `detail`) is surfaced to the frontend instead of a bare HTTP status text.
 */
function rethrowAgentError(err: unknown, fallback: string): never {
  const e = err as Record<string, any>
  const statusCode: number = e?.status ?? e?.statusCode ?? 500
  const detail: string = e?.data?.detail ?? e?.statusMessage ?? e?.message ?? fallback
  throw createError({ statusCode, statusMessage: detail })
}

interface FilesystemConfig {
  nfsExportHost: string
}

function getConfig(): FilesystemConfig {
  const config = useRuntimeConfig()
  return (config as Record<string, any>).filesystem as FilesystemConfig
}

/** Build the nfs-agent URL from the configured NFS export host. */
function nfsAgentUrl(): string {
  const { nfsExportHost } = getConfig()
  return `http://${nfsExportHost}:${NFS_AGENT_PORT}`
}

/** Build the mount-agent URL for a specific host entered by the user in the WebUI. */
function mountAgentUrl(host: string): string {
  return `http://${host}:${MOUNT_AGENT_PORT}`
}

/**
 * Fetch the full directory registry from the NFS agent.
 */
export async function fetchRegistry(): Promise<DirectoryRegistry> {
  const res = await $fetch<DirectoryRegistry>(`${nfsAgentUrl()}/api/registry`)
  return res
}

/**
 * List all directories from the NFS agent.
 */
export async function listDirectories(): Promise<DirectoryEntry[]> {
  const registry = await fetchRegistry()
  return registry.directories
}

/**
 * Create a new directory via the NFS agent.
 */
export async function createDirectory(body: CreateDirectoryRequest): Promise<DirectoryEntry> {
  return await $fetch<DirectoryEntry>(`${nfsAgentUrl()}/api/directories`, {
    method: 'POST',
    body,
  })
}

/**
 * Delete a directory via the NFS agent (guarded by active mounts).
 */
export async function deleteDirectory(name: string): Promise<void> {
  await $fetch(`${nfsAgentUrl()}/api/directories/${encodeURIComponent(name)}`, {
    method: 'DELETE',
  })
}

/**
 * Mount a directory on a host.
 * 1. Ask the mount-agent on the target host to perform the mount.
 * 2. Ask the NFS agent to record the mount in the registry.
 */
export async function mountDirectory(directoryName: string, body: MountDirectoryRequest): Promise<DirectoryEntry> {
  // Fetch directory details from nfs-agent to get the mount source (e.g. 172.24.37.159:/dirname)
  const entry = await $fetch<DirectoryEntry>(`${nfsAgentUrl()}/api/directories/${encodeURIComponent(directoryName)}`)
  const agentBase = mountAgentUrl(body.host)

  // Step 1: Tell the host agent to mount
  try {
    await $fetch(`${agentBase}/api/mount`, {
      method: 'POST',
      body: {
        source: entry.mountSource,
        mountPath: body.mountPath,
      },
    })
  } catch (err) {
    rethrowAgentError(err, 'Mount failed')
  }

  // Step 2: Record in registry via NFS agent
  return await $fetch<DirectoryEntry>(`${nfsAgentUrl()}/api/directories/${encodeURIComponent(directoryName)}/mounts`, {
    method: 'POST',
    body,
  })
}

/**
 * Unmount a directory from a host.
 * 1. Ask the mount-agent on the target host to unmount.
 * 2. Ask the NFS agent to remove the mount record.
 */
export async function unmountDirectory(directoryName: string, body: UnmountDirectoryRequest): Promise<DirectoryEntry> {
  const agentBase = mountAgentUrl(body.host)

  // Step 1: Tell the host agent to unmount
  try {
    await $fetch(`${agentBase}/api/unmount`, {
      method: 'POST',
      body: {
        mountPath: body.mountPath,
      },
    })
  } catch (err) {
    rethrowAgentError(err, 'Unmount failed')
  }

  // Step 2: Remove from registry via NFS agent
  return await $fetch<DirectoryEntry>(`${nfsAgentUrl()}/api/directories/${encodeURIComponent(directoryName)}/mounts`, {
    method: 'DELETE',
    body,
  })
}
