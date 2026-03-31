import { describe, expect, it } from 'vitest'
import type { DirectoryEntry, DirectoryRegistry, DirectorySummary, MountRecord } from '~/types/filesystem'

/**
 * Tests for registry store behaviour modelled at the type level.
 * These verify the data shape and business rules without needing
 * a real filesystem or running Python agent.
 */

function emptyRegistry(): DirectoryRegistry {
  return { version: 1, directories: [] }
}

function addDirectory(registry: DirectoryRegistry, entry: DirectoryEntry): DirectoryRegistry {
  if (registry.directories.some(d => d.name === entry.name)) {
    throw new Error(`Directory '${entry.name}' already exists`)
  }
  return { ...registry, directories: [...registry.directories, entry] }
}

function removeDirectory(registry: DirectoryRegistry, name: string): DirectoryRegistry {
  const dir = registry.directories.find(d => d.name === name)
  if (!dir) throw new Error(`Directory '${name}' not found`)
  const active = dir.mounts.filter(m => m.status === 'mounted')
  if (active.length > 0) {
    throw new Error(`Cannot delete '${name}': ${active.length} active mount(s)`)
  }
  return { ...registry, directories: registry.directories.filter(d => d.name !== name) }
}

function addMount(registry: DirectoryRegistry, dirName: string, mount: MountRecord): DirectoryRegistry {
  return {
    ...registry,
    directories: registry.directories.map(d => (d.name === dirName ? { ...d, mounts: [...d.mounts, mount] } : d)),
  }
}

function removeMount(registry: DirectoryRegistry, dirName: string, host: string, mountPath: string): DirectoryRegistry {
  return {
    ...registry,
    directories: registry.directories.map(d =>
      d.name === dirName ? { ...d, mounts: d.mounts.filter(m => !(m.host === host && m.mountPath === mountPath)) } : d
    ),
  }
}

function toSummary(entry: DirectoryEntry): DirectorySummary {
  return {
    name: entry.name,
    mountedHostCount: entry.mounts.filter(m => m.status === 'mounted').length,
    createdAt: entry.createdAt,
    statusSummary: entry.mounts.length === 0 ? 'idle' : 'active',
  }
}

const sampleDir: DirectoryEntry = {
  name: 'test-dir1',
  localPath: '/shared/test-dir1',
  mountSource: '172.24.37.159:/test-dir1',
  createdAt: '2026-03-30T10:00:00Z',
  mounts: [],
}

const sampleMount: MountRecord = {
  host: '10.0.0.12',
  mountPath: '/data/test-dir1',
  status: 'mounted',
  mountedAt: '2026-03-30T10:05:00Z',
  lastError: '',
}

describe('registry store behaviour', () => {
  describe('empty state', () => {
    it('starts with version 1 and no directories', () => {
      const reg = emptyRegistry()
      expect(reg.version).toBe(1)
      expect(reg.directories).toEqual([])
    })
  })

  describe('directory create', () => {
    it('adds a directory to the registry', () => {
      let reg = emptyRegistry()
      reg = addDirectory(reg, sampleDir)
      expect(reg.directories).toHaveLength(1)
      expect(reg.directories[0]!.name).toBe('test-dir1')
    })

    it('rejects duplicate directory names', () => {
      let reg = emptyRegistry()
      reg = addDirectory(reg, sampleDir)
      expect(() => addDirectory(reg, sampleDir)).toThrow('already exists')
    })
  })

  describe('mount update', () => {
    it('adds a mount record to an existing directory', () => {
      let reg = addDirectory(emptyRegistry(), sampleDir)
      reg = addMount(reg, 'test-dir1', sampleMount)
      expect(reg.directories[0]!.mounts).toHaveLength(1)
      expect(reg.directories[0]!.mounts[0]!.host).toBe('10.0.0.12')
    })

    it('removes a specific mount record', () => {
      let reg = addDirectory(emptyRegistry(), sampleDir)
      reg = addMount(reg, 'test-dir1', sampleMount)
      reg = removeMount(reg, 'test-dir1', '10.0.0.12', '/data/test-dir1')
      expect(reg.directories[0]!.mounts).toHaveLength(0)
    })
  })

  describe('guarded delete', () => {
    it('allows deleting an unmounted directory', () => {
      let reg = addDirectory(emptyRegistry(), sampleDir)
      reg = removeDirectory(reg, 'test-dir1')
      expect(reg.directories).toHaveLength(0)
    })

    it('rejects deleting a directory with active mounts', () => {
      let reg = addDirectory(emptyRegistry(), sampleDir)
      reg = addMount(reg, 'test-dir1', sampleMount)
      expect(() => removeDirectory(reg, 'test-dir1')).toThrow('active mount')
    })

    it('allows deleting after all mounts are removed', () => {
      let reg = addDirectory(emptyRegistry(), sampleDir)
      reg = addMount(reg, 'test-dir1', sampleMount)
      reg = removeMount(reg, 'test-dir1', '10.0.0.12', '/data/test-dir1')
      reg = removeDirectory(reg, 'test-dir1')
      expect(reg.directories).toHaveLength(0)
    })

    it('reports not found for unknown directory', () => {
      const reg = emptyRegistry()
      expect(() => removeDirectory(reg, 'nonexistent')).toThrow('not found')
    })
  })

  describe('summary projection', () => {
    it('summarises an idle directory', () => {
      const summary = toSummary(sampleDir)
      expect(summary.mountedHostCount).toBe(0)
      expect(summary.statusSummary).toBe('idle')
    })

    it('summarises an active directory', () => {
      const dir = { ...sampleDir, mounts: [sampleMount] }
      const summary = toSummary(dir)
      expect(summary.mountedHostCount).toBe(1)
      expect(summary.statusSummary).toBe('active')
    })
  })
})
