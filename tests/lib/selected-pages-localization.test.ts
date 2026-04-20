import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const readWorkspaceFile = (relativePath: string) => readFileSync(resolve(process.cwd(), relativePath), 'utf8')

describe('selected pages localization regression', () => {
  it('wires AI Data Lake pages to vue-i18n and removes representative hardcoded copy', () => {
    const catalogSource = readWorkspaceFile('pages/ai-datalake/catalog.vue')
    const laketokenSource = readWorkspaceFile('pages/ai-datalake/laketoken.vue')
    const volumeCatalogSource = readWorkspaceFile('pages/ai-datalake/volume-catalog.vue')
    const dirsSource = readWorkspaceFile('pages/filesystem/dirs.vue')

    expect(catalogSource).toContain("import { useI18n } from 'vue-i18n'")
    expect(catalogSource).toContain('const { t } = useI18n()')
    expect(laketokenSource).toContain("import { useI18n } from 'vue-i18n'")
    expect(laketokenSource).toContain('const { t } = useI18n()')
    expect(volumeCatalogSource).toContain("import { useI18n } from 'vue-i18n'")
    expect(volumeCatalogSource).toContain('const { t } = useI18n()')
    expect(catalogSource).toContain('<h1 class="text-2xl font-bold">{{ t(\'Catalog\') }}</h1>')
    expect(laketokenSource).toContain('<h1 class="text-2xl font-bold">{{ t(\'LakeToken\') }}</h1>')
    expect(dirsSource).toContain('<h1 class="text-2xl font-bold">{{ t(\'Directory Management\') }}</h1>')
    expect(dirsSource).toContain('<template #actions>')
    expect(dirsSource).toContain("return t('Has Mounts')")
    expect(dirsSource).toContain("return t('No Mounts')")

    const forbiddenCatalogSnippets = [
      '>Back Metalakes<',
      '>Create Catalog<',
      '>No details loaded<',
      "message.success('Metalake created')",
      "message.error(err?.message || 'Delete failed')",
    ]

    for (const snippet of forbiddenCatalogSnippets) {
      expect(catalogSource).not.toContain(snippet)
    }

    const forbiddenVolumeCatalogSnippets = [
      '>Volume Catalog<',
      '>Query Panel<',
      '>Column Name<',
      'placeholder="Select column"',
      "error?.statusMessage || error?.message || 'Failed to load schema.'",
    ]

    for (const snippet of forbiddenVolumeCatalogSnippets) {
      expect(volumeCatalogSource).not.toContain(snippet)
    }

    const forbiddenLaketokenSnippets = [
      'Configure GPUStack-backed vLLM KV cache settings through a focused LakeToken workflow.',
      'Only allowlisted GPUStack vLLM model instances are shown in this production-safe view.',
      "return 'Each row represents a GPUStack vLLM serving instance. Editing a row updates its parent model.'",
    ]

    for (const snippet of forbiddenLaketokenSnippets) {
      expect(laketokenSource).not.toContain(snippet)
    }
  })

  it('defines selected-page locale entries in en-US and zh-CN', () => {
    const enUs = JSON.parse(readWorkspaceFile('i18n/locales/en-US.json')) as Record<string, string>
    const zhCn = JSON.parse(readWorkspaceFile('i18n/locales/zh-CN.json')) as Record<string, string>

    const requiredKeys = [
      'Back Metalakes',
      'Create Metalake',
      'Volume Catalog',
      'Query Panel',
      'Condition Group',
      'Directory Management',
      'Search Directory',
      'All Status',
      'No details loaded',
      'Select an item from the left tree.',
      'Failed to load schema.',
      'Directory Name',
      'Create Directory',
      'Mount Records',
      'Mounted Count',
      'Created Time',
      'Dismount',
      'LakeToken',
      'No model instances',
      'No GPUStack vLLM model instances are currently available for LakeToken management.',
      'Edit KV Cache Configuration',
      'Update the selected model instance\'s parent GPUStack model configuration.',
      'Editing {instanceName} updates the parent model {modelName} and recreates all of its running instances.',
      'KV cache',
      'Enable LMCache-backed KV transfer for this model.',
      'Prefix caching',
      'Manage the `--enable-prefix-caching` backend flag independently.',
      'Environment Variables',
      'Enable the experimental LMCache mode.',
      'Chunk size used by LMCache when KV cache is enabled.',
      'Enable local CPU cache storage.',
      'Maximum local CPU cache size.',
      'Disk path used for LMCache local storage.',
      'Maximum local disk cache size.',
      'Optional metrics directory for enabling LMCache Prometheus multiprocess metrics.',
      'Validation issues',
      'Reload',
      'Apply Configuration',
      'Applying…',
    ]

    for (const key of requiredKeys) {
      expect(enUs[key]).toBe(key)
      expect(zhCn[key]).toBeDefined()
    }

    expect(zhCn['Directory Management']).toBe('目录管理')
  })
})
