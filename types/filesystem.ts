/**
 * Filesystem directory management type definitions.
 *
 * These types model the directory-centric domain where each directory
 * is the aggregate root containing its own mount records.
 */

/** A mount record representing a single host mount for a directory. */
export interface MountRecord {
  host: string
  mountPath: string
  status: 'mounted' | 'unmounting' | 'error'
  mountedAt: string
  lastError: string
}

/** A managed directory entry as stored in the registry. */
export interface DirectoryEntry {
  name: string
  localPath: string
  mountSource: string
  createdAt: string
  mounts: MountRecord[]
}

/** The JSON registry schema persisted on the NFS server. */
export interface DirectoryRegistry {
  version: number
  directories: DirectoryEntry[]
}

/** Summary row returned for the directory list page. */
export interface DirectorySummary {
  name: string
  mountedHostCount: number
  createdAt: string
  statusSummary: string
}

/** Payload for creating a new directory. */
export interface CreateDirectoryRequest {
  name: string
}

/** Payload for mounting a directory on a host. */
export interface MountDirectoryRequest {
  host: string
  mountPath: string
}

/** Payload for unmounting a directory from a host. */
export interface UnmountDirectoryRequest {
  host: string
  mountPath: string
}

/** Standard API success response wrapper. */
export interface FilesystemApiResponse<T = void> {
  success: boolean
  data?: T
  error?: string
}
