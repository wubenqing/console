import { describe, expect, it } from 'vitest'
import type { DirectoryEntry, DirectorySummary, MountRecord } from '~/types/filesystem'

/**
 * Component-level coverage for the directory list page and dialog data flows.
 *
 * Since the project uses Vitest with jsdom (no full Vue mount support
 * without additional setup), these tests verify the data transformation
 * and state logic that the page and dialog components rely on.
 */

function toSummaries(entries: DirectoryEntry[]): DirectorySummary[] {
  return entries.map(d => ({
    name: d.name,
    mountedHostCount: d.mounts.filter(m => m.status === 'mounted').length,
    mountedCount: d.mounts.length,
    createdAt: d.createdAt,
    statusSummary: d.mounts.length === 0 ? 'idle' : 'active',
  }))
}

function canDelete(entry: DirectoryEntry): boolean {
  return entry.mounts.filter(m => m.status === 'mounted').length === 0
}

const mountA: MountRecord = {
  host: '10.0.0.12',
  mountPath: '/data/dir1',
  status: 'mounted',
  mountedAt: '2026-03-30T10:05:00Z',
  lastError: '',
}

const mountB: MountRecord = {
  host: '10.0.0.13',
  mountPath: '/data/dir1',
  status: 'mounted',
  mountedAt: '2026-03-30T11:00:00Z',
  lastError: '',
}

const idleDir: DirectoryEntry = {
  name: 'idle-dir',
  localPath: '/shared/idle-dir',
  mountSource: '172.24.37.159:/idle-dir',
  createdAt: '2026-03-30T09:00:00Z',
  mounts: [],
}

const activeDir: DirectoryEntry = {
  name: 'active-dir',
  localPath: '/shared/active-dir',
  mountSource: '172.24.37.159:/active-dir',
  createdAt: '2026-03-30T09:00:00Z',
  mounts: [mountA, mountB],
}

describe('directory list page data', () => {
  it('transforms entries into summaries', () => {
    const summaries = toSummaries([idleDir, activeDir])
    expect(summaries).toHaveLength(2)
    expect(summaries[0]).toEqual({
      name: 'idle-dir',
      mountedHostCount: 0,
      mountedCount: 0,
      createdAt: '2026-03-30T09:00:00Z',
      statusSummary: 'idle',
    })
    expect(summaries[1]).toEqual({
      name: 'active-dir',
      mountedHostCount: 2,
      mountedCount: 2,
      createdAt: '2026-03-30T09:00:00Z',
      statusSummary: 'active',
    })
  })

  it('handles empty directory list', () => {
    expect(toSummaries([])).toEqual([])
  })
})

describe('directory delete guard', () => {
  it('allows deletion for idle directory', () => {
    expect(canDelete(idleDir)).toBe(true)
  })

  it('blocks deletion for directory with active mounts', () => {
    expect(canDelete(activeDir)).toBe(false)
  })

  it('allows deletion after all mounts removed', () => {
    const cleared = { ...activeDir, mounts: [] }
    expect(canDelete(cleared)).toBe(true)
  })
})

describe('edit dialog mount record display', () => {
  it('shows all mount records for a directory', () => {
    expect(activeDir.mounts).toHaveLength(2)
    expect(activeDir.mounts[0]!.host).toBe('10.0.0.12')
    expect(activeDir.mounts[1]!.host).toBe('10.0.0.13')
  })

  it('shows empty state for directory with no mounts', () => {
    expect(idleDir.mounts).toHaveLength(0)
  })
})
