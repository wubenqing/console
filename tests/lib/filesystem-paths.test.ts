import { describe, expect, it } from 'vitest'

/**
 * These tests verify the path composition rules used by the console server
 * and the NFS agent to build local directory paths and host-visible mount sources.
 *
 * The rules are:
 * - Local directory path: `{sharedPath}/<directoryName>`
 * - Registry path: `{sharedPath}/.aiunistor/registry.json`
 * - Host mount source: `{nfsExportHost}:/<directoryName>`
 */

function buildLocalDirectoryPath(sharedPath: string, directoryName: string): string {
  const base = sharedPath.replace(/\/+$/, '')
  return `${base}/${directoryName}`
}

function buildRegistryPath(sharedPath: string): string {
  const base = sharedPath.replace(/\/+$/, '')
  return `${base}/.aiunistor/registry.json`
}

function buildMountSource(nfsExportHost: string, directoryName: string): string {
  return `${nfsExportHost}:/${directoryName}`
}

describe('filesystem path composition', () => {
  const sharedPath = '/home/renlanhui/pacific-storage/stage/fs'
  const nfsExportHost = '172.24.37.159'

  describe('buildLocalDirectoryPath', () => {
    it('builds local path from shared-path and directory name', () => {
      expect(buildLocalDirectoryPath(sharedPath, 'test-dir1')).toBe(
        '/home/renlanhui/pacific-storage/stage/fs/test-dir1'
      )
    })

    it('strips trailing slashes from shared-path', () => {
      expect(buildLocalDirectoryPath(sharedPath + '/', 'mydir')).toBe('/home/renlanhui/pacific-storage/stage/fs/mydir')
    })

    it('handles directory names with hyphens and numbers', () => {
      expect(buildLocalDirectoryPath(sharedPath, 'kv-cache-2026')).toBe(
        '/home/renlanhui/pacific-storage/stage/fs/kv-cache-2026'
      )
    })
  })

  describe('buildRegistryPath', () => {
    it('builds registry path under .aiunistor', () => {
      expect(buildRegistryPath(sharedPath)).toBe('/home/renlanhui/pacific-storage/stage/fs/.aiunistor/registry.json')
    })

    it('strips trailing slashes', () => {
      expect(buildRegistryPath(sharedPath + '/')).toBe(
        '/home/renlanhui/pacific-storage/stage/fs/.aiunistor/registry.json'
      )
    })
  })

  describe('buildMountSource', () => {
    it('composes export-host:/<directory-name>', () => {
      expect(buildMountSource(nfsExportHost, 'test-dir3')).toBe('172.24.37.159:/test-dir3')
    })

    it('works with different host addresses', () => {
      expect(buildMountSource('10.0.0.1', 'shared')).toBe('10.0.0.1:/shared')
    })

    it('does not include shared-path in the mount source', () => {
      const source = buildMountSource(nfsExportHost, 'mydir')
      expect(source).not.toContain(sharedPath)
      expect(source).toBe('172.24.37.159:/mydir')
    })
  })
})
