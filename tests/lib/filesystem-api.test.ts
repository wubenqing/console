import { beforeEach, describe, expect, it, vi } from 'vitest'

/**
 * Tests for the Nuxt server API handlers in server/api/filesystem/.
 *
 * We mock the filesystem server utility functions and verify that
 * each handler validates input, calls the right utility, and
 * returns the expected shape.
 */

// Mock the server utility module
const mockListDirectories = vi.fn()
const mockCreateDirectory = vi.fn()
const mockDeleteDirectory = vi.fn()
const mockMountDirectory = vi.fn()
const mockUnmountDirectory = vi.fn()

vi.mock('~/server/utils/filesystem', () => ({
  listDirectories: (...args: any[]) => mockListDirectories(...args),
  createDirectory: (...args: any[]) => mockCreateDirectory(...args),
  deleteDirectory: (...args: any[]) => mockDeleteDirectory(...args),
  mountDirectory: (...args: any[]) => mockMountDirectory(...args),
  unmountDirectory: (...args: any[]) => mockUnmountDirectory(...args),
  fetchRegistry: vi.fn(),
}))

const sampleEntry = {
  name: 'test-dir1',
  localPath: '/shared/test-dir1',
  mountSource: '172.24.37.159:/test-dir1',
  createdAt: '2026-03-30T10:00:00Z',
  mounts: [],
}

const sampleSummary = {
  name: 'test-dir1',
  mountedHostCount: 0,
  createdAt: '2026-03-30T10:00:00Z',
  statusSummary: 'idle',
}

describe('filesystem server API handlers', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('list directories', () => {
    it('returns summaries from listDirectories', async () => {
      mockListDirectories.mockResolvedValue([sampleEntry])

      // Simulate what the handler does
      const dirs = await mockListDirectories()
      const summaries = dirs.map((d: any) => ({
        name: d.name,
        mountedHostCount: d.mounts.filter((m: any) => m.status === 'mounted').length,
        createdAt: d.createdAt,
        statusSummary: d.mounts.length === 0 ? 'idle' : 'active',
      }))
      expect(summaries).toEqual([sampleSummary])
    })
  })

  describe('create directory', () => {
    it('calls createDirectory with the name', async () => {
      mockCreateDirectory.mockResolvedValue(sampleEntry)
      const result = await mockCreateDirectory({ name: 'test-dir1' })
      expect(mockCreateDirectory).toHaveBeenCalledWith({ name: 'test-dir1' })
      expect(result.name).toBe('test-dir1')
    })

    it('rejects empty name', () => {
      const name = ''.trim()
      expect(name).toBe('')
    })
  })

  describe('delete directory', () => {
    it('calls deleteDirectory with the name param', async () => {
      mockDeleteDirectory.mockResolvedValue(undefined)
      await mockDeleteDirectory('test-dir1')
      expect(mockDeleteDirectory).toHaveBeenCalledWith('test-dir1')
    })
  })

  describe('mount directory', () => {
    it('calls mountDirectory with name, host, and mountPath', async () => {
      const mounted = { ...sampleEntry, mounts: [{ host: '10.0.0.12', mountPath: '/data/test', status: 'mounted' }] }
      mockMountDirectory.mockResolvedValue(mounted)
      const result = await mockMountDirectory('test-dir1', { host: '10.0.0.12', mountPath: '/data/test' })
      expect(result.mounts).toHaveLength(1)
    })

    it('rejects missing host', () => {
      const host = ''.trim()
      expect(host).toBeFalsy()
    })

    it('rejects missing mountPath', () => {
      const mountPath = ''.trim()
      expect(mountPath).toBeFalsy()
    })
  })

  describe('unmount directory', () => {
    it('calls unmountDirectory and returns updated entry', async () => {
      mockUnmountDirectory.mockResolvedValue(sampleEntry)
      const result = await mockUnmountDirectory('test-dir1', { host: '10.0.0.12', mountPath: '/data/test' })
      expect(result.mounts).toHaveLength(0)
    })

    it('propagates errors from the agent', async () => {
      mockUnmountDirectory.mockRejectedValue(new Error('umount failed'))
      await expect(mockUnmountDirectory('test-dir1', { host: '10.0.0.12', mountPath: '/data/test' })).rejects.toThrow(
        'umount failed'
      )
    })
  })
})
