<script lang="ts" setup>
import Page from '@/components/page.vue'
import PageHeader from '@/components/page-header.vue'
import Selector from '@/components/selector.vue'
import EmptyState from '@/components/empty-state.vue'
import JsonEditor from '@/components/json-editor.vue'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Separator } from '@/components/ui/separator'
import { Switch } from '@/components/ui/switch'
import { Textarea } from '@/components/ui/textarea'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { useMessage } from '@/lib/ui/message'
import { Icon } from '#components'
import { computed, ref, watch } from 'vue'

const asString = (value: unknown): string | undefined => {
  if (Array.isArray(value)) {
    const first = value[0]
    return typeof first === 'string' ? first : undefined
  }
  return typeof value === 'string' ? value : undefined
}

const route = useRoute()
const router = useRouter()

const api = useGravitino()
const message = useMessage()

const parseInUse = (value: unknown): boolean | undefined => {
  if (typeof value === 'string') {
    const v = value.trim().toLowerCase()
    if (v === 'false' || v === '0' || v === 'no') return false
    if (v === 'true' || v === '1' || v === 'yes') return true
  }

  if (value === false || value === 0) return false
  if (value === true || value === 1) return true
  if (value == null) return undefined
  return undefined
}

const getPropertyValue = (resource: any, key: string): unknown => {
  if (!resource) return undefined

  const props =
    resource?.properties ??
    resource?.metalake?.properties ??
    resource?.catalog?.properties ??
    resource?.schema?.properties

  if (!props) return undefined

  // Object form: { "in-use": "true" }
  if (typeof props === 'object' && !Array.isArray(props)) {
    return props?.[key] ?? props?.[key.replaceAll('-', '_')] ?? props?.[key.replaceAll('-', '')]
  }

  // Array form: [{ key: 'in-use', value: 'true' }]
  if (Array.isArray(props)) {
    const hit = props.find((p: any) => p?.key === key || p?.name === key)
    return hit?.value ?? hit?.val
  }

  return undefined
}

const getResourceInUse = (resource: any): boolean | undefined => {
  if (!resource) return undefined

  // 1. Try to find 'in-use' in various possible property locations
  const propRaw = getPropertyValue(resource, 'in-use')
  
  // 2. Extra check: sometimes backend doesn't nest it under properties in different contexts
  const directProp = resource?.properties?.['in-use'] || resource?.metalake?.properties?.['in-use'] || resource?.catalog?.properties?.['in-use']

  const propParsed = parseInUse(propRaw || directProp)

  // 3. Fallback to top-level fields
  const rawFallback = resource?.inUse ?? resource?.in_use ?? resource?.metalake?.inUse
  const fallbackParsed = parseInUse(rawFallback)

  const finalResult = propParsed ?? fallbackParsed

  console.log(`[InUse Check] ${resource?.name}:`, {
    propRaw,
    directProp,
    rawFallback,
    finalResult
  })

  return finalResult
}

const isResourceInUse = (resource: any): boolean => {
  const result = getResourceInUse(resource) === true
  console.log('[isResourceInUse] Checking:', {
    resourceName: resource?.name,
    rawResource: resource,
    getResourceInUseResult: getResourceInUse(resource),
    finalBoolean: result
  })
  return result
}

const pickFirstString = (...candidates: any[]): string | undefined => {
  for (const c of candidates) {
    if (typeof c === 'string' && c.trim()) return c
  }
  return undefined
}

const formatTime = (value: unknown): string | undefined => {
  if (typeof value === 'number' && Number.isFinite(value)) {
    // Heuristic: seconds vs millis
    const ms = value < 10_000_000_000 ? value * 1000 : value
    return new Date(ms).toLocaleString()
  }
  if (typeof value === 'string' && value.trim()) {
    const n = Number(value)
    if (!Number.isNaN(n)) return formatTime(n)
    const d = new Date(value)
    if (!Number.isNaN(d.getTime())) return d.toLocaleString()
    return value
  }
  return undefined
}

const getCreatedBy = (resource: any): string | undefined => {
  if (!resource) return undefined
  return pickFirstString(
    resource?.audit?.createdBy,
    resource?.auditInfo?.createdBy,
    resource?.audit?.creator,
    resource?.createdBy,
    resource?.creator
  )
}

const getCreatedAt = (resource: any): string | undefined => {
  if (!resource) return undefined
  return (
    formatTime(resource?.audit?.createTime) ??
    formatTime(resource?.auditInfo?.createTime) ??
    formatTime(resource?.createdAt) ??
    formatTime(resource?.createTime)
  )
}

const getResourceName = (resource: any): string | undefined => {
  if (!resource) return undefined
  return pickFirstString(resource?.name, resource?.metalake?.name, resource?.catalog?.name)
}

const isLoading = ref(false)
const metalakes = ref<any[]>([])
const catalogs = ref<any[]>([])
const schemas = ref<any[]>([])
const entities = ref<any[]>([])
const modelVersions = ref<any[]>([])

const metalakeDetail = ref<any | null>(null)
const catalogDetail = ref<any | null>(null)
const schemaDetail = ref<any | null>(null)
const entityDetail = ref<any | null>(null)
const versionDetail = ref<any | null>(null)

const q = computed(() => {
  return {
    metalake: asString(route.query.metalake),
    catalog: asString(route.query.catalog),
    type: asString(route.query.type) as 'relational' | 'fileset' | 'messaging' | 'model' | undefined,
    schema: asString(route.query.schema),
    table: asString(route.query.table),
    fileset: asString(route.query.fileset),
    topic: asString(route.query.topic),
    model: asString(route.query.model),
    version: asString(route.query.version),
  }
})

const entityKey = computed(() => {
  switch (q.value.type) {
    case 'relational':
      return 'table'
    case 'fileset':
      return 'fileset'
    case 'messaging':
      return 'topic'
    case 'model':
      return 'model'
    default:
      return undefined
  }
})

const selectedEntityName = computed(() => {
  const key = entityKey.value
  if (!key) return undefined
  return (q.value as any)[key] as string | undefined
})

const identityString = computed(() => {
  const parts = [q.value.metalake, q.value.catalog, q.value.schema, selectedEntityName.value, q.value.version]
  return parts.filter(Boolean).join('.')
})

const metalakeOptions = computed(() => {
  return (metalakes.value || [])
    .map(m => ({ label: getResourceName(m) ?? '', value: getResourceName(m) ?? '' }))
    .filter(x => x.value)
})

const metalakeNameFilter = ref('')

const filteredMetalakeRows = computed(() => {
  const q = metalakeNameFilter.value.trim().toLowerCase()
  if (!q) return metalakeRows.value
  return metalakeRows.value.filter(r => r.name.toLowerCase().includes(q))
})

type MetalakeRow = {
  name: string
  comment?: string
  inUse?: boolean
  createdBy?: string
  createdAt?: string
  raw: any
}

const metalakeRows = computed<MetalakeRow[]>(() => {
  return (metalakes.value || [])
    .map(m => {
      const name = getResourceName(m)
      // Always re-compute inUse from properties['in-use']
      const inUse = getResourceInUse(m)
      return {
        name,
        comment: m?.comment ?? m?.metalake?.comment,
        inUse,
        createdBy: getCreatedBy(m),
        createdAt: getCreatedAt(m),
        raw: m,
      } as MetalakeRow & { name: string | undefined }
    })
    .filter((r): r is MetalakeRow => typeof r.name === 'string' && r.name.length > 0)
})

const currentMetalake = computed<string | null>({
  get: () => q.value.metalake ?? null,
  set: value => {
    if (!value) goToMetalakeList()
    else {
      const m = metalakes.value.find(x => x?.name === value)
      if (m && getResourceInUse(m) === false) {
        message.warning('This metalake is disabled (in-use=false)')
        return
      }
      goToMetalake(value)
    }
  },
})

const goTo = (query: Record<string, string> = {}) => router.push({ path: '/ai-datalake/catalog', query })
const goToMetalakeList = () => goTo({})
const goToMetalake = (metalake: string) => goTo({ metalake })
const goToCatalog = (metalake: string, catalog: string, type: string) => goTo({ metalake, catalog, type })
const goToSchema = (metalake: string, catalog: string, type: string, schema: string) =>
  goTo({ metalake, catalog, type, schema })

const goToEntity = (metalake: string, catalog: string, type: string, schema: string, entity: string) => {
  switch (type) {
    case 'relational':
      goTo({ metalake, catalog, type, schema, table: entity })
      break
    case 'fileset':
      goTo({ metalake, catalog, type, schema, fileset: entity })
      break
    case 'messaging':
      goTo({ metalake, catalog, type, schema, topic: entity })
      break
    case 'model':
      goTo({ metalake, catalog, type, schema, model: entity })
      break
    default:
      goTo({ metalake, catalog, type, schema })
  }
}

const goToModelVersion = (metalake: string, catalog: string, schema: string, model: string, version: string) =>
  goTo({ metalake, catalog, type: 'model', schema, model, version })

const currentMetalakeObj = computed<any | null>(() => {
  const name = q.value.metalake
  if (!name) return null
  const found = metalakes.value.find(m => m?.name === name) ?? null
  console.log('[currentMetalakeObj] Computed:', {
    searchName: name,
    found: found,
    foundInUse: found?.properties?.['in-use'],
    allMetalakes: metalakes.value.map(m => ({ name: m.name, inUse: m.properties?.['in-use'] }))
  })
  return found
})

const currentCatalogObj = computed<any | null>(() => {
  const { catalog, type } = q.value
  if (!catalog || !type) return null
  return catalogs.value.find(c => c?.name === catalog && c?.type === type) ?? null
})

// --- Metalake create form (Gravitino-like, not raw JSON) ---
const createMetalakeOpen = ref(false)
const createMetalakeName = ref('')
const createMetalakeComment = ref('')
const createMetalakeProps = ref<Array<{ key: string; value: string }>>([{ key: '', value: '' }])

const resetMetalakeForm = () => {
  createMetalakeName.value = ''
  createMetalakeComment.value = ''
  createMetalakeProps.value = [{ key: '', value: '' }]
}

const openMetalakeCreate = () => {
  resetMetalakeForm()
  createMetalakeOpen.value = true
}

const metalakePropsObject = computed(() => {
  const obj: Record<string, string> = {}
  for (const row of createMetalakeProps.value) {
    const k = row.key?.trim()
    if (!k) continue
    obj[k] = row.value ?? ''
  }
  return obj
})

const addMetalakePropRow = () => {
  createMetalakeProps.value = [...createMetalakeProps.value, { key: '', value: '' }]
}

const removeMetalakePropRow = (idx: number) => {
  if (createMetalakeProps.value.length <= 1) return
  createMetalakeProps.value = createMetalakeProps.value.filter((_, i) => i !== idx)
}

const submitCreateMetalake = async () => {
  const name = createMetalakeName.value.trim()
  if (!name) {
    message.error('Name is required')
    return
  }

  try {
    isLoading.value = true
    await api.createMetalake({
      name,
      comment: createMetalakeComment.value,
      properties: metalakePropsObject.value,
    })
    message.success('Metalake created')
    createMetalakeOpen.value = false
    await refreshAll()
    goToMetalake(name)
  } catch (err: any) {
    message.error(err?.message || 'Failed to create metalake')
  } finally {
    isLoading.value = false
  }
}

// --- Left tree caches (catalog -> schema -> entity) ---
const openCatalogKeys = ref<Record<string, boolean>>({})
const openSchemaKeys = ref<Record<string, boolean>>({})
const treeSchemasByCatalogKey = ref<Record<string, string[]>>({})
const treeEntitiesBySchemaKey = ref<Record<string, string[]>>({})
const treeLoading = ref<Record<string, boolean>>({})

const setTreeLoading = (key: string, value: boolean) => {
  treeLoading.value = { ...treeLoading.value, [key]: value }
}

const catalogKeyOf = (catalog: string, type: string) => `${catalog}::${type}`
const schemaKeyOf = (catalogKey: string, schema: string) => `${catalogKey}::${schema}`

const loadSchemasForCatalog = async (metalake: string, catalogName: string, type: string) => {
  const cKey = catalogKeyOf(catalogName, type)
  if (treeSchemasByCatalogKey.value[cKey]) return
  setTreeLoading(`schemas:${cKey}`, true)
  try {
    const schemasRes = await api.getSchemas(metalake, catalogName)
    treeSchemasByCatalogKey.value = {
      ...treeSchemasByCatalogKey.value,
      [cKey]: (schemasRes.identifiers || []).map((i: any) => i.name ?? i),
    }
  } catch {
    message.error('Failed to load schemas')
  } finally {
    setTreeLoading(`schemas:${cKey}`, false)
  }
}

const loadEntitiesForSchema = async (metalake: string, catalogName: string, type: string, schema: string) => {
  const cKey = catalogKeyOf(catalogName, type)
  const sKey = schemaKeyOf(cKey, schema)
  if (treeEntitiesBySchemaKey.value[sKey]) return
  setTreeLoading(`entities:${sKey}`, true)
  try {
    const listRes = await (async () => {
      switch (type) {
        case 'relational':
          return api.getTables(metalake, catalogName, schema)
        case 'fileset':
          return api.getFilesets(metalake, catalogName, schema)
        case 'messaging':
          return api.getTopics(metalake, catalogName, schema)
        case 'model':
          return api.getModels(metalake, catalogName, schema)
        default:
          return { identifiers: [] as any[] }
      }
    })()

    treeEntitiesBySchemaKey.value = {
      ...treeEntitiesBySchemaKey.value,
      [sKey]: (listRes.identifiers || []).map((i: any) => i.name ?? i),
    }
  } catch {
    message.error('Failed to load entities')
  } finally {
    setTreeLoading(`entities:${sKey}`, false)
  }
}

const toggleCatalogOpen = async (catalogName: string, type: string) => {
  const metalake = q.value.metalake
  if (!metalake) return
  const key = catalogKeyOf(catalogName, type)
  const next = !openCatalogKeys.value[key]
  openCatalogKeys.value = { ...openCatalogKeys.value, [key]: next }
  if (next) await loadSchemasForCatalog(metalake, catalogName, type)
}

const toggleSchemaOpen = async (catalogName: string, type: string, schema: string) => {
  const metalake = q.value.metalake
  if (!metalake) return
  const cKey = catalogKeyOf(catalogName, type)
  const key = schemaKeyOf(cKey, schema)
  const next = !openSchemaKeys.value[key]
  openSchemaKeys.value = { ...openSchemaKeys.value, [key]: next }
  if (next) await loadEntitiesForSchema(metalake, catalogName, type, schema)
}

const toggleMetalakeInUse = async (next: boolean) => {
  const metalake = q.value.metalake
  if (!metalake) return

  try {
    isLoading.value = true
    // Use Gravitino's dedicated PATCH endpoint
    await api.switchMetalakeInUse(metalake, next)
    message.success('Updated in-use')
    await refreshAll()
    if (!next) {
      goToMetalakeList()
      return
    }
    // refreshMetalakeContext is now called inside refreshAll if context active
  } catch (err: any) {
    message.error('Failed to update in-use')
  } finally {
    isLoading.value = false
  }
}

const toggleMetalakeInUseFromList = async (metalake: string, next: boolean) => {
  const previous = [...metalakes.value]

  // Optimistically update local state so the switch and actions reflect the change immediately
  const idx = metalakes.value.findIndex(m => getResourceName(m) === metalake)
  if (idx !== -1) {
    const current = metalakes.value[idx]
    const updated = {
      ...current,
      inUse: next,
      properties: { ...(current.properties || {}), 'in-use': String(next) },
    }
    metalakes.value = [
      ...metalakes.value.slice(0, idx),
      updated,
      ...metalakes.value.slice(idx + 1),
    ]
  }

  try {
    isLoading.value = true
    await api.switchMetalakeInUse(metalake, next)
    message.success('Updated in-use')
    await refreshAll()
  } catch {
    // Revert optimistic update on failure
    metalakes.value = previous
    message.error('Failed to update in-use')
  } finally {
    isLoading.value = false
  }
}

const toggleCatalogInUse = async (catalogName: string, next: boolean) => {
  const metalake = q.value.metalake
  if (!metalake) return

  try {
    isLoading.value = true
    await api.updateCatalog(metalake, catalogName, {
      updates: [{ '@type': 'setProperty', property: 'in-use', value: String(next) }],
    })
    message.success('Updated in-use')
    await refreshMetalakeContext(metalake)

    const { catalog, type } = q.value
    if (!next && catalog === catalogName && type) {
      goToMetalake(metalake)
    }
  } catch (err: any) {
    message.error('Failed to update in-use')
  } finally {
    isLoading.value = false
  }
}

// --- Metalake edit form (Gravitino-like) ---
const editMetalakeOpen = ref(false)
const editMetalakeOriginal = ref<any | null>(null)
const editMetalakeName = ref('')
const editMetalakeComment = ref('')
const editMetalakeProps = ref<Array<{ key: string; value: string; disabled?: boolean }>>([{ key: '', value: '' }])

const propsObjectToRows = (obj: any): Array<{ key: string; value: string; disabled?: boolean }> => {
  if (!obj || typeof obj !== 'object') return [{ key: '', value: '' }]
  const rows = Object.entries(obj).map(([k, v]) => {
    if (k === 'in-use') {
      return { key: k, value: v == null ? '' : String(v), disabled: true }
    }
    return { key: k, value: v == null ? '' : String(v) }
  })
  return rows.length ? rows : [{ key: '', value: '' }]
}

const propsRowsToObject = (rows: Array<{ key: string; value: string }>) => {
  const obj: Record<string, string> = {}
  for (const r of rows) {
    const k = r.key?.trim()
    if (!k) continue
    obj[k] = r.value ?? ''
  }
  return obj
}

const addEditMetalakePropRow = () => {
  editMetalakeProps.value = [...editMetalakeProps.value, { key: '', value: '' }]
}

const removeEditMetalakePropRow = (idx: number) => {
  if (editMetalakeProps.value.length <= 1) return
  if (editMetalakeProps.value[idx]?.key === 'in-use') return // do not remove in-use row
  editMetalakeProps.value = editMetalakeProps.value.filter((_, i) => i !== idx)
}

const openMetalakeEdit = async (name: string) => {
  try {
    isLoading.value = true
    const res = await api.getMetalake(name)
    const metalake = res?.metalake ?? res
    editMetalakeOriginal.value = metalake
    editMetalakeName.value = metalake?.name ?? name
    editMetalakeComment.value = metalake?.comment ?? ''
    editMetalakeProps.value = propsObjectToRows(metalake?.properties)
    editMetalakeOpen.value = true
  } catch {
    message.error('Failed to load metalake details')
  } finally {
    isLoading.value = false
  }
}

const tryOpenMetalakeEdit = async (name: string, inUse?: boolean) => {
  const resolvedInUse = inUse ?? getResourceInUse(metalakeDetail.value || currentMetalakeObj.value)
  if (resolvedInUse === false) {
    message.warning('This metalake is disabled (in-use=false) and cannot be edited')
    return
  }
  await openMetalakeEdit(name)
}

const submitEditMetalake = async () => {
  const original = editMetalakeOriginal.value
  if (!original) return

  const next = {
    name: editMetalakeName.value.trim(),
    comment: editMetalakeComment.value,
    properties: propsRowsToObject(editMetalakeProps.value),
  }
  if (!next.name) {
    message.error('Name is required')
    return
  }

  try {
    isLoading.value = true
    const updates = genUpdates(original, next)
    await api.updateMetalake(original?.name ?? next.name, { updates })
    message.success('Metalake updated')
    editMetalakeOpen.value = false
    await refreshAll()
    if (q.value.metalake && q.value.metalake === original?.name && next.name) {
      goToMetalake(next.name)
    }
  } catch (err: any) {
    message.error(err?.message || 'Failed to update metalake')
  } finally {
    isLoading.value = false
  }
}

const refreshAll = async () => {
  isLoading.value = true
  try {
    // Always refresh metalakes for selector
    const res = await api.getMetalakes()
    metalakes.value = res.metalakes || []

    // Also refresh context if we are in a metalake detail view
    if (q.value.metalake) {
      // Catch error here so we don't break the whole refresh if just context fails
      await refreshMetalakeContext(q.value.metalake).catch(console.error)
    }
  } catch (err: any) {
    message.error('Failed to load metalakes')
  } finally {
    isLoading.value = false
  }
}

const refreshMetalakeContext = async (metalake: string) => {
  isLoading.value = true
  try {
    const [metalakeRes, catalogsRes] = await Promise.all([
      api.getMetalake(metalake).catch(() => null),
      api.getCatalogs(metalake),
    ])
    console.log('DEBUG: Metalake refresh response:', {
      url: metalake,
      fullResponse: metalakeRes,
      extractedInUse: (metalakeRes?.metalake ?? metalakeRes)?.properties?.['in-use']
    })
    metalakeDetail.value = metalakeRes?.metalake ?? metalakeRes ?? null
    catalogs.value = catalogsRes.catalogs || []
  } catch (err: any) {
    message.error('Failed to load catalogs')
  } finally {
    isLoading.value = false
  }
}

const refreshCatalogContext = async (metalake: string, catalog: string, type: string) => {
  isLoading.value = true
  try {
    const [catalogRes, schemasRes] = await Promise.all([
      api.getCatalog(metalake, catalog).catch(() => null),
      api.getSchemas(metalake, catalog),
    ])
    catalogDetail.value = catalogRes?.catalog ?? catalogRes ?? null
    schemas.value = (schemasRes.identifiers || []).map((i: any) => i.name ?? i)
    // Clear deeper caches
    schemaDetail.value = null
    entities.value = []
    entityDetail.value = null
    modelVersions.value = []
    versionDetail.value = null
  } catch (err: any) {
    message.error('Failed to load schemas')
  } finally {
    isLoading.value = false
  }
}

const refreshSchemaContext = async (metalake: string, catalog: string, type: string, schema: string) => {
  isLoading.value = true
  try {
    const schemaRes = await api.getSchema(metalake, catalog, schema).catch(() => null)
    schemaDetail.value = schemaRes?.schema ?? null

    const listRes = await (async () => {
      switch (type) {
        case 'relational':
          return api.getTables(metalake, catalog, schema)
        case 'fileset':
          return api.getFilesets(metalake, catalog, schema)
        case 'messaging':
          return api.getTopics(metalake, catalog, schema)
        case 'model':
          return api.getModels(metalake, catalog, schema)
        default:
          return { identifiers: [] as any[] }
      }
    })()

    entities.value = (listRes.identifiers || []).map((i: any) => i.name ?? i)
    entityDetail.value = null
    modelVersions.value = []
    versionDetail.value = null
  } catch (err: any) {
    message.error('Failed to load schema/entities')
  } finally {
    isLoading.value = false
  }
}

const refreshEntityDetails = async (metalake: string, catalog: string, type: string, schema: string, name: string) => {
  isLoading.value = true
  try {
    if (type === 'relational') {
      const res = await api.getTable(metalake, catalog, schema, name)
      entityDetail.value = res.table ?? res
    } else if (type === 'fileset') {
      const res = await api.getFileset(metalake, catalog, schema, name)
      entityDetail.value = res.fileset ?? res
    } else if (type === 'messaging') {
      const res = await api.getTopic(metalake, catalog, schema, name)
      entityDetail.value = res.topic ?? res
    } else if (type === 'model') {
      const [modelRes, versionsRes] = await Promise.all([
        api.getModel(metalake, catalog, schema, name).catch(() => null),
        api.getModelVersions(metalake, catalog, schema, name).catch(() => null),
      ])
      entityDetail.value = modelRes?.model ?? modelRes
      modelVersions.value = (versionsRes?.identifiers || []).map((i: any) => i.name ?? i)
    } else {
      entityDetail.value = null
    }
  } catch (err: any) {
    message.error('Failed to load details')
  } finally {
    isLoading.value = false
  }
}

const refreshVersionDetails = async (
  metalake: string,
  catalog: string,
  schema: string,
  model: string,
  version: string
) => {
  isLoading.value = true
  try {
    const res = await api.getVersion(metalake, catalog, schema, model, version)
    versionDetail.value = res
  } catch (err: any) {
    message.error('Failed to load version')
  } finally {
    isLoading.value = false
  }
}

const lastMetalake = ref<string | undefined>(undefined)
const lastCatalogKey = ref<string | undefined>(undefined)
const lastSchemaKey = ref<string | undefined>(undefined)
const lastEntityKey = ref<string | undefined>(undefined)
const lastVersionKey = ref<string | undefined>(undefined)

watch(
  () => route.query,
  async () => {
    // Load metalakes once (and refresh when landing)
    if (!metalakes.value.length) {
      await refreshAll()
    }

    const { metalake, catalog, type, schema, version } = q.value

    if (!metalake) {
      catalogs.value = []
      schemas.value = []
      entities.value = []
      modelVersions.value = []
      metalakeDetail.value = null
      catalogDetail.value = null
      schemaDetail.value = null
      entityDetail.value = null
      versionDetail.value = null

      openCatalogKeys.value = {}
      openSchemaKeys.value = {}
      treeSchemasByCatalogKey.value = {}
      treeEntitiesBySchemaKey.value = {}
      treeLoading.value = {}
      return
    }

    // If user pasted a URL with a disabled metalake, do not drill down.
    const selectedMetalake = metalakes.value.find(m => m?.name === metalake)
    if (selectedMetalake && getResourceInUse(selectedMetalake) === false) {
      message.warning('This metalake is disabled (in-use=false)')
      goToMetalakeList()
      return
    }


    const nextCatalogKey = catalog && type ? `${catalog}::${type}` : undefined
    const nextSchemaKey = schema && nextCatalogKey ? `${nextCatalogKey}::${schema}` : undefined
    const nextEntityName = selectedEntityName.value
    const nextEntityKey = nextEntityName && nextSchemaKey ? `${nextSchemaKey}::${nextEntityName}` : undefined
    const nextVersionKey =
      type === 'model' && q.value.model && version ? `${nextEntityKey ?? ''}::${String(version)}` : undefined

    const metalakeChanged = metalake !== lastMetalake.value
    const catalogChanged = nextCatalogKey !== lastCatalogKey.value
    const schemaChanged = nextSchemaKey !== lastSchemaKey.value
    const entityChanged = nextEntityKey !== lastEntityKey.value
    const versionChanged = nextVersionKey !== lastVersionKey.value

    if (metalakeChanged) {
      await refreshMetalakeContext(metalake)
      schemas.value = []
      entities.value = []
      modelVersions.value = []
      catalogDetail.value = null
      schemaDetail.value = null
      entityDetail.value = null
      versionDetail.value = null

      // Reset tree caches when switching metalakes
      openCatalogKeys.value = {}
      openSchemaKeys.value = {}
      treeSchemasByCatalogKey.value = {}
      treeEntitiesBySchemaKey.value = {}
      treeLoading.value = {}
    }

    if (!catalog || !type) {
      lastMetalake.value = metalake
      lastCatalogKey.value = undefined
      lastSchemaKey.value = undefined
      lastEntityKey.value = undefined
      lastVersionKey.value = undefined
      return
    }

    // If user pasted a URL with a disabled catalog, do not drill down.
    const selectedCatalog = catalogs.value.find(c => c?.name === catalog && c?.type === type)
    if (selectedCatalog && getResourceInUse(selectedCatalog) === false) {
      message.warning('This catalog is disabled (in-use=false)')
      goToMetalake(metalake)
      return
    }

    if (metalakeChanged || catalogChanged) {
      await refreshCatalogContext(metalake, catalog, type)
    }

    // Auto-open the selected catalog in the left tree
    const selectedCatalogKey = catalogKeyOf(catalog, type)
    if (!openCatalogKeys.value[selectedCatalogKey]) {
      openCatalogKeys.value = { ...openCatalogKeys.value, [selectedCatalogKey]: true }
    }
    await loadSchemasForCatalog(metalake, catalog, type)

    if (!schema) {
      lastMetalake.value = metalake
      lastCatalogKey.value = nextCatalogKey
      lastSchemaKey.value = undefined
      lastEntityKey.value = undefined
      lastVersionKey.value = undefined
      return
    }

    // Auto-open the selected schema in the left tree
    const selectedSchemaKey = schemaKeyOf(selectedCatalogKey, schema)
    if (!openSchemaKeys.value[selectedSchemaKey]) {
      openSchemaKeys.value = { ...openSchemaKeys.value, [selectedSchemaKey]: true }
    }
    await loadEntitiesForSchema(metalake, catalog, type, schema)

    if (metalakeChanged || catalogChanged || schemaChanged) {
      await refreshSchemaContext(metalake, catalog, type, schema)
    }

    if (nextEntityName && (metalakeChanged || catalogChanged || schemaChanged || entityChanged)) {
      await refreshEntityDetails(metalake, catalog, type, schema, nextEntityName)
    }

    if (type === 'model' && q.value.model && version) {
      if (metalakeChanged || catalogChanged || schemaChanged || entityChanged || versionChanged) {
        await refreshVersionDetails(metalake, catalog, schema, q.value.model, String(version))
      }
    } else {
      versionDetail.value = null
    }

    lastMetalake.value = metalake
    lastCatalogKey.value = nextCatalogKey
    lastSchemaKey.value = nextSchemaKey
    lastEntityKey.value = nextEntityKey
    lastVersionKey.value = nextVersionKey
  },
  { immediate: true }
)

const copyIdentity = async () => {
  const text = identityString.value
  if (!text) {
    message.warning('Nothing to copy')
    return
  }
  try {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      await navigator.clipboard.writeText(text)
      message.success('Copied')
    } else {
      message.warning('Clipboard API not available')
    }
  } catch {
    message.error('Copy failed')
  }
}

const typeLabel = (type?: string) => {
  switch (type) {
    case 'relational':
      return 'Relational'
    case 'fileset':
      return 'Fileset'
    case 'messaging':
      return 'Messaging'
    case 'model':
      return 'Model'
    default:
      return 'Unknown'
  }
}

const currentLevel = computed<
  'metalake-list' | 'metalake' | 'catalog' | 'schema' | 'entity' | 'version'
>(() => {
  if (!q.value.metalake) return 'metalake-list'
  if (q.value.metalake && !q.value.catalog) return 'metalake'
  if (q.value.catalog && q.value.type && !q.value.schema) return 'catalog'
  if (q.value.schema && q.value.type && !selectedEntityName.value) return 'schema'
  if (q.value.type === 'model' && q.value.version) return 'version'
  return 'entity'
})

const detailsTarget = computed<any | null>(() => {
  switch (currentLevel.value) {
    case 'metalake':
      return metalakeDetail.value
    case 'catalog':
      return catalogDetail.value
    case 'schema':
      return schemaDetail.value
    case 'version':
      return versionDetail.value
    case 'entity':
      return entityDetail.value
    default:
      return null
  }
})

const detailsRows = computed(() => {
  const target = detailsTarget.value
  if (!target) return [] as Array<{ label: string; value: string }>
  const rows: Array<{ label: string; value: string }> = []

  const name = getResourceName(target)
  if (name) rows.push({ label: 'Name', value: name })

  const comment = pickFirstString(target?.comment)
  if (comment) rows.push({ label: 'Comment', value: comment })

  // When we render an interactive switch in the Details header (metalake/catalog),
  // avoid duplicating it as a static row.
  const inUse = getResourceInUse(target)
  if (inUse != null && currentLevel.value !== 'metalake' && currentLevel.value !== 'catalog') {
    rows.push({ label: 'In use', value: String(inUse) })
  }

  const provider = pickFirstString(target?.provider)
  if (provider) rows.push({ label: 'Provider', value: provider })

  const type = pickFirstString(target?.type)
  if (type) rows.push({ label: 'Type', value: typeLabel(type) })

  const createdBy = getCreatedBy(target)
  if (createdBy) rows.push({ label: 'Created by', value: createdBy })

  const createdAt = getCreatedAt(target)
  if (createdAt) rows.push({ label: 'Created at', value: createdAt })

  const properties = target?.properties
  if (properties && typeof properties === 'object') {
    rows.push({ label: 'Properties', value: String(Object.keys(properties).length) })
  }

  return rows
})

const showRawDetailsJson = ref(false)

const breadcrumbText = computed(() => {
  const parts = [q.value.metalake, q.value.catalog, q.value.schema, selectedEntityName.value].filter(Boolean)
  return parts.join(' / ')
})

const listTabLabel = computed(() => {
  switch (currentLevel.value) {
    case 'metalake':
      return 'Catalogs'
    case 'catalog':
      return 'Schemas'
    case 'schema': {
      // Gravitino shows Tables/Filesets/Topics/Models depending on catalog type
      const t = q.value.type
      if (t === 'relational') return 'Tables'
      if (t === 'fileset') return 'Filesets'
      if (t === 'messaging') return 'Topics'
      if (t === 'model') return 'Models'
      return 'Entities'
    }
    case 'entity':
      if (q.value.type === 'relational') return 'Columns'
      if (q.value.type === 'model') return 'Versions'
      return 'Details'
    case 'version':
      return 'Details'
    default:
      return 'Catalogs'
  }
})

const rightTabsDefault = computed(() => {
  // Keep list tab selected by default
  return 'list'
})

const currentEntityKind = computed<ResourceKind | null>(() => {
  switch (q.value.type) {
    case 'relational':
      return 'table'
    case 'fileset':
      return 'fileset'
    case 'messaging':
      return 'topic'
    case 'model':
      return 'model'
    default:
      return null
  }
})

type ResourceKind =
  | 'metalake'
  | 'catalog'
  | 'schema'
  | 'table'
  | 'fileset'
  | 'topic'
  | 'model'
  | 'version'

const editOpen = ref(false)
const editTitle = ref('')
const editDescription = ref<string | undefined>(undefined)
const editKind = ref<ResourceKind>('metalake')
const editMode = ref<'create' | 'edit'>('create')
const editJson = ref('')

const deleteOpen = ref(false)
const deleteKind = ref<ResourceKind>('metalake')
const deleteTitle = ref('')
const deleteContext = ref<Partial<{
  metalake: string
  catalog: string
  type: string
  schema: string
  entity: string
  version: string
  model: string
}> | null>(null)

const parseJson = (raw: string) => {
  const trimmed = raw.trim()
  if (!trimmed) return null
  return JSON.parse(trimmed)
}

const genUpdates = (original: any, next: any) => {
  const updates: any[] = []
  if (!original || !next) return updates

  if (typeof next.name === 'string' && original.name && original.name !== next.name) {
    updates.push({ '@type': 'rename', newName: next.name })
  }

  if (original.comment !== next.comment) {
    updates.push({ '@type': 'updateComment', newComment: next.comment ?? '' })
  }

  const originalProperties = original.properties || {}
  const nextProperties = next.properties || {}

  for (const key of Object.keys(originalProperties)) {
    if (!(key in nextProperties)) {
      updates.push({ '@type': 'removeProperty', property: key })
    }
  }

  for (const [key, value] of Object.entries(nextProperties)) {
    if (originalProperties[key] !== value) {
      updates.push({ '@type': 'setProperty', property: key, value })
    }
  }

  return updates
}

const openCreate = (kind: ResourceKind) => {
  editKind.value = kind
  editMode.value = 'create'
  editDescription.value = 'Edit the JSON payload. Required fields depend on provider/type.'

  const metalake = q.value.metalake
  const catalog = q.value.catalog
  const type = q.value.type
  const schema = q.value.schema
  const entity = selectedEntityName.value

  const templates: Record<ResourceKind, any> = {
    metalake: { name: '', comment: '', properties: {} },
    catalog: { name: '', type: 'relational', provider: '', comment: '', properties: {} },
    schema: { name: '', comment: '', properties: {} },
    table: {
      name: '',
      comment: '',
      columns: [],
      properties: {},
    },
    fileset: {
      name: '',
      comment: '',
      locations: [],
      properties: {},
    },
    topic: {
      name: '',
      comment: '',
      properties: {},
    },
    model: {
      name: '',
      comment: '',
      properties: {},
    },
    version: {
      // Link version for a model
      version: '',
      uri: '',
      aliases: [],
      comment: '',
      properties: {},
    },
  }

  if (kind === 'catalog' && metalake) {
    editTitle.value = `Create Catalog in ${metalake}`
  } else if (kind === 'schema' && metalake && catalog) {
    editTitle.value = `Create Schema in ${metalake}.${catalog}`
  } else if ((kind === 'table' || kind === 'fileset' || kind === 'topic' || kind === 'model') && metalake && catalog && schema) {
    editTitle.value = `Create ${kind} in ${metalake}.${catalog}.${schema}`
  } else if (kind === 'version' && metalake && catalog && schema && entity) {
    editTitle.value = `Link Version for ${metalake}.${catalog}.${schema}.${entity}`
  } else {
    editTitle.value = `Create ${kind}`
  }

  editJson.value = JSON.stringify(templates[kind], null, 2)
  editOpen.value = true
}

const openEdit = (kind: ResourceKind) => {
  editKind.value = kind
  editMode.value = 'edit'
  editDescription.value = 'Edit the JSON model; the UI will generate Gravitino updates where applicable.'

  const current =
    kind === 'metalake'
      ? metalakeDetail.value
      : kind === 'catalog'
        ? catalogDetail.value
        : kind === 'schema'
          ? schemaDetail.value
          : kind === 'version'
            ? versionDetail.value
            : entityDetail.value

  if (!current) {
    message.warning('No details loaded yet')
    return
  }

  editTitle.value = `Edit ${kind}`
  editJson.value = JSON.stringify(current, null, 2)
  editOpen.value = true
}

const submitEdit = async () => {
  const metalake = q.value.metalake
  const catalog = q.value.catalog
  const type = q.value.type
  const schema = q.value.schema
  const entity = selectedEntityName.value
  const version = q.value.version

  let payload: any
  try {
    payload = parseJson(editJson.value)
  } catch (e) {
    message.error('Invalid JSON')
    return
  }

  if (!payload) {
    message.error('Payload is empty')
    return
  }

  try {
    isLoading.value = true
    const kind = editKind.value
    const mode = editMode.value

    if (mode === 'create') {
      switch (kind) {
        case 'metalake':
          await api.createMetalake(payload)
          message.success('Metalake created')
          editOpen.value = false
          await refreshAll()
          if (payload.name) goToMetalake(payload.name)
          return

        case 'catalog':
          if (!metalake) throw new Error('metalake is required')
          await api.createCatalog(metalake, payload)
          message.success('Catalog created')
          editOpen.value = false
          await refreshMetalakeContext(metalake)
          if (payload.name && payload.type) goToCatalog(metalake, payload.name, payload.type)
          return

        case 'schema':
          if (!metalake || !catalog || !type) throw new Error('catalog context is required')
          await api.createSchema(metalake, catalog, payload)
          message.success('Schema created')
          editOpen.value = false
          await refreshCatalogContext(metalake, catalog, type)
          if (payload.name) goToSchema(metalake, catalog, type, payload.name)
          return

        case 'table':
          if (!metalake || !catalog || !schema || !type) throw new Error('schema context is required')
          await api.createTable(metalake, catalog, schema, payload)
          message.success('Table created')
          editOpen.value = false
          await refreshSchemaContext(metalake, catalog, type, schema)
          if (payload.name) goToEntity(metalake, catalog, type, schema, payload.name)
          return

        case 'fileset':
          if (!metalake || !catalog || !schema || !type) throw new Error('schema context is required')
          await api.createFileset(metalake, catalog, schema, payload)
          message.success('Fileset created')
          editOpen.value = false
          await refreshSchemaContext(metalake, catalog, type, schema)
          if (payload.name) goToEntity(metalake, catalog, type, schema, payload.name)
          return

        case 'topic':
          if (!metalake || !catalog || !schema || !type) throw new Error('schema context is required')
          await api.createTopic(metalake, catalog, schema, payload)
          message.success('Topic created')
          editOpen.value = false
          await refreshSchemaContext(metalake, catalog, type, schema)
          if (payload.name) goToEntity(metalake, catalog, type, schema, payload.name)
          return

        case 'model':
          if (!metalake || !catalog || !schema || !type) throw new Error('schema context is required')
          await api.registerModel(metalake, catalog, schema, payload)
          message.success('Model registered')
          editOpen.value = false
          await refreshSchemaContext(metalake, catalog, type, schema)
          if (payload.name) goToEntity(metalake, catalog, type, schema, payload.name)
          return

        case 'version':
          if (!metalake || !catalog || !schema || !entity) throw new Error('model context is required')
          await api.linkVersion(metalake, catalog, schema, entity, payload)
          message.success('Version linked')
          editOpen.value = false
          await refreshEntityDetails(metalake, catalog, 'model', schema, entity)
          if (payload.version) goToModelVersion(metalake, catalog, schema, entity, String(payload.version))
          return
      }
    } else {
      switch (kind) {
        case 'metalake': {
          const original = metalakeDetail.value
          const updates = genUpdates(original, payload)
          await api.updateMetalake(original?.name ?? metalake ?? payload.name, { updates })
          message.success('Metalake updated')
          editOpen.value = false
          await refreshAll()
          if (payload.name) goToMetalake(payload.name)
          return
        }

        case 'catalog': {
          if (!metalake || !catalog) throw new Error('catalog context is required')
          const original = catalogDetail.value
          const updates = genUpdates(original, payload)
          await api.updateCatalog(metalake, original?.name ?? catalog, { updates })
          message.success('Catalog updated')
          editOpen.value = false
          await refreshMetalakeContext(metalake)
          if (payload.name && (payload.type ?? type)) goToCatalog(metalake, payload.name, payload.type ?? (type as any))
          return
        }

        case 'schema': {
          if (!metalake || !catalog || !schema || !type) throw new Error('schema context is required')
          const original = schemaDetail.value
          const updates = genUpdates(original, payload)
          await api.updateSchema(metalake, catalog, original?.name ?? schema, { updates })
          message.success('Schema updated')
          editOpen.value = false
          await refreshCatalogContext(metalake, catalog, type)
          if (payload.name) goToSchema(metalake, catalog, type, payload.name)
          return
        }

        case 'table': {
          if (!metalake || !catalog || !schema || !entity || !type) throw new Error('table context is required')
          const updates = genUpdates(entityDetail.value, payload)
          await api.updateTable(metalake, catalog, schema, entity, { updates })
          message.success('Table updated')
          editOpen.value = false
          await refreshSchemaContext(metalake, catalog, type, schema)
          if (payload.name) goToEntity(metalake, catalog, type, schema, payload.name)
          return
        }

        case 'fileset': {
          if (!metalake || !catalog || !schema || !entity || !type) throw new Error('fileset context is required')
          const updates = genUpdates(entityDetail.value, payload)
          await api.updateFileset(metalake, catalog, schema, entity, { updates })
          message.success('Fileset updated')
          editOpen.value = false
          await refreshSchemaContext(metalake, catalog, type, schema)
          if (payload.name) goToEntity(metalake, catalog, type, schema, payload.name)
          return
        }

        case 'topic': {
          if (!metalake || !catalog || !schema || !entity || !type) throw new Error('topic context is required')
          const updates = genUpdates(entityDetail.value, payload)
          await api.updateTopic(metalake, catalog, schema, entity, { updates })
          message.success('Topic updated')
          editOpen.value = false
          await refreshSchemaContext(metalake, catalog, type, schema)
          if (payload.name) goToEntity(metalake, catalog, type, schema, payload.name)
          return
        }

        case 'model': {
          if (!metalake || !catalog || !schema || !entity || !type) throw new Error('model context is required')
          const updates = genUpdates(entityDetail.value, payload)
          await api.updateModel(metalake, catalog, schema, entity, { updates })
          message.success('Model updated')
          editOpen.value = false
          await refreshSchemaContext(metalake, catalog, type, schema)
          if (payload.name) goToEntity(metalake, catalog, type, schema, payload.name)
          return
        }

        case 'version': {
          if (!metalake || !catalog || !schema || !q.value.model || !version) throw new Error('version context is required')
          const updates = genUpdates(versionDetail.value, payload)
          await api.updateVersion(metalake, catalog, schema, q.value.model, String(version), { updates })
          message.success('Version updated')
          editOpen.value = false
          await refreshVersionDetails(metalake, catalog, schema, q.value.model, String(version))
          return
        }
      }
    }
  } catch (err: any) {
    message.error(err?.message || 'Operation failed')
  } finally {
    isLoading.value = false
  }
}

const openDelete = (kind: ResourceKind, ctx?: typeof deleteContext.value) => {
  deleteKind.value = kind
  deleteTitle.value = `Delete ${kind}?`
  deleteContext.value = ctx ?? null
  deleteOpen.value = true
}

const confirmDelete = async () => {
  const ctx = deleteContext.value
  const metalake = ctx?.metalake ?? q.value.metalake
  const catalog = ctx?.catalog ?? q.value.catalog
  const type = (ctx?.type ?? q.value.type) as any
  const schema = ctx?.schema ?? q.value.schema
  const entity = ctx?.entity ?? selectedEntityName.value
  const version = ctx?.version ?? q.value.version

  try {
    isLoading.value = true
    switch (deleteKind.value) {
      case 'metalake':
        if (!metalake) throw new Error('metalake is required')
        await api.deleteMetalake(metalake)
        message.success('Metalake deleted')
        deleteOpen.value = false
        deleteContext.value = null
        await refreshAll()
        goToMetalakeList()
        return
      case 'catalog':
        if (!metalake || !catalog) throw new Error('catalog context is required')
        await api.deleteCatalog(metalake, catalog)
        message.success('Catalog deleted')
        deleteOpen.value = false
        deleteContext.value = null
        await refreshMetalakeContext(metalake)
        goToMetalake(metalake)
        return
      case 'schema':
        if (!metalake || !catalog || !schema || !type) throw new Error('schema context is required')
        await api.deleteSchema(metalake, catalog, schema)
        message.success('Schema deleted')
        deleteOpen.value = false
        deleteContext.value = null
        await refreshCatalogContext(metalake, catalog, type)
        goToCatalog(metalake, catalog, type)
        return
      case 'table':
        if (!metalake || !catalog || !schema || !entity || !type) throw new Error('table context is required')
        await api.deleteTable(metalake, catalog, schema, entity)
        message.success('Table deleted')
        deleteOpen.value = false
        deleteContext.value = null
        await refreshSchemaContext(metalake, catalog, type, schema)
        goToSchema(metalake, catalog, type, schema)
        return
      case 'fileset':
        if (!metalake || !catalog || !schema || !entity || !type) throw new Error('fileset context is required')
        await api.deleteFileset(metalake, catalog, schema, entity)
        message.success('Fileset deleted')
        deleteOpen.value = false
        deleteContext.value = null
        await refreshSchemaContext(metalake, catalog, type, schema)
        goToSchema(metalake, catalog, type, schema)
        return
      case 'topic':
        if (!metalake || !catalog || !schema || !entity || !type) throw new Error('topic context is required')
        await api.deleteTopic(metalake, catalog, schema, entity)
        message.success('Topic deleted')
        deleteOpen.value = false
        deleteContext.value = null
        await refreshSchemaContext(metalake, catalog, type, schema)
        goToSchema(metalake, catalog, type, schema)
        return
      case 'model':
        if (!metalake || !catalog || !schema || !entity || !type) throw new Error('model context is required')
        await api.deleteModel(metalake, catalog, schema, entity)
        message.success('Model deleted')
        deleteOpen.value = false
        deleteContext.value = null
        await refreshSchemaContext(metalake, catalog, type, schema)
        goToSchema(metalake, catalog, type, schema)
        return
      case 'version':
        if (!metalake || !catalog || !schema || !q.value.model || !version) throw new Error('version context is required')
        await api.deleteVersion(metalake, catalog, schema, q.value.model, String(version))
        message.success('Version deleted')
        deleteOpen.value = false
        deleteContext.value = null
        await refreshEntityDetails(metalake, catalog, 'model', schema, q.value.model)
        goToEntity(metalake, catalog, 'model', schema, q.value.model)
        return
    }
  } catch (err: any) {
    message.error(err?.message || 'Delete failed')
  } finally {
    isLoading.value = false
  }
}
</script>

<template>
  <Page>
    <PageHeader>
      <h1 class="text-2xl font-bold">Catalog</h1>
      <template #description>
        <!-- intentionally empty: keep console header clean -->
      </template>
      <template #actions>
        <div v-if="q.metalake && !q.catalog" class="inline-flex items-center gap-2">
          <span class="text-sm text-muted-foreground">In use</span>
          <!-- Debug: {{ isResourceInUse(metalakeDetail || currentMetalakeObj) }} -->
          <Switch
            :key="`header-metalake-${q.metalake}-${isResourceInUse(metalakeDetail || currentMetalakeObj)}`"
            :checked="isResourceInUse(metalakeDetail || currentMetalakeObj)"
            :disabled="isLoading"
            @update:checked="toggleMetalakeInUse"
          />
        </div>

        <div v-if="q.catalog && q.type && !q.schema" class="inline-flex items-center gap-2">
          <span class="text-sm text-muted-foreground">In use</span>
          <Switch
            :key="`header-catalog-${q.catalog}-${isResourceInUse(catalogDetail || currentCatalogObj)}`"
            :checked="isResourceInUse(catalogDetail || currentCatalogObj)"
            :disabled="isLoading"
            @update:checked="(v: boolean) => toggleCatalogInUse(q.catalog || '', v)"
          />
        </div>

        <!-- Create Metalake button lives in the metalake list header (Gravitino-like) -->

        <Button
          v-else-if="q.metalake && !q.catalog"
          variant="outline"
          class="inline-flex items-center gap-2"
          @click="openCreate('catalog')"
        >
          <Icon name="ri:add-line" class="size-4" />
          <span>Create Catalog</span>
        </Button>
        <Button
          v-if="q.metalake && !q.catalog"
          variant="outline"
          class="inline-flex items-center gap-2"
          @click="() => (q.metalake ? tryOpenMetalakeEdit(q.metalake) : undefined)"
        >
          <Icon name="ri:edit-line" class="size-4" />
          <span>Edit Metalake</span>
        </Button>
        <Button
          v-if="q.metalake && !q.catalog"
          variant="outline"
          class="inline-flex items-center gap-2"
          @click="openDelete('metalake')"
        >
          <Icon name="ri:delete-bin-5-line" class="size-4" />
          <span>Delete Metalake</span>
        </Button>

        <Button
          v-if="q.catalog && q.type && !q.schema"
          variant="outline"
          class="inline-flex items-center gap-2"
          @click="openCreate('schema')"
        >
          <Icon name="ri:add-line" class="size-4" />
          <span>Create Schema</span>
        </Button>
        <Button
          v-if="q.catalog && q.type && !q.schema"
          variant="outline"
          class="inline-flex items-center gap-2"
          @click="openEdit('catalog')"
        >
          <Icon name="ri:edit-line" class="size-4" />
          <span>Edit Catalog</span>
        </Button>
        <Button
          v-if="q.catalog && q.type && !q.schema"
          variant="outline"
          class="inline-flex items-center gap-2"
          @click="openDelete('catalog')"
        >
          <Icon name="ri:delete-bin-5-line" class="size-4" />
          <span>Delete Catalog</span>
        </Button>

        <Button
          v-if="q.schema && q.type && !selectedEntityName && currentEntityKind"
          variant="outline"
          class="inline-flex items-center gap-2"
          @click="openCreate(currentEntityKind)"
        >
          <Icon name="ri:add-line" class="size-4" />
          <span>Create {{ typeLabel(q.type) }}</span>
        </Button>
        <Button
          v-if="q.schema && q.type && !selectedEntityName"
          variant="outline"
          class="inline-flex items-center gap-2"
          @click="openEdit('schema')"
        >
          <Icon name="ri:edit-line" class="size-4" />
          <span>Edit Schema</span>
        </Button>
        <Button
          v-if="q.schema && q.type && !selectedEntityName"
          variant="outline"
          class="inline-flex items-center gap-2"
          @click="openDelete('schema')"
        >
          <Icon name="ri:delete-bin-5-line" class="size-4" />
          <span>Delete Schema</span>
        </Button>

        <Button
          v-if="selectedEntityName && currentEntityKind && !(q.type === 'model' && q.version)"
          variant="outline"
          class="inline-flex items-center gap-2"
          @click="openEdit(currentEntityKind)"
        >
          <Icon name="ri:edit-line" class="size-4" />
          <span>Edit {{ typeLabel(q.type) }}</span>
        </Button>
        <Button
          v-if="selectedEntityName && currentEntityKind && !(q.type === 'model' && q.version)"
          variant="outline"
          class="inline-flex items-center gap-2"
          @click="openDelete(currentEntityKind)"
        >
          <Icon name="ri:delete-bin-5-line" class="size-4" />
          <span>Delete {{ typeLabel(q.type) }}</span>
        </Button>

        <Button
          v-if="q.type === 'model' && selectedEntityName && !q.version"
          variant="outline"
          class="inline-flex items-center gap-2"
          @click="openCreate('version')"
        >
          <Icon name="ri:git-branch-line" class="size-4" />
          <span>Link Version</span>
        </Button>
        <Button
          v-if="q.type === 'model' && q.version"
          variant="outline"
          class="inline-flex items-center gap-2"
          @click="openEdit('version')"
        >
          <Icon name="ri:edit-line" class="size-4" />
          <span>Edit Version</span>
        </Button>
        <Button
          v-if="q.type === 'model' && q.version"
          variant="outline"
          class="inline-flex items-center gap-2"
          @click="openDelete('version')"
        >
          <Icon name="ri:delete-bin-5-line" class="size-4" />
          <span>Delete Version</span>
        </Button>

        <Button variant="outline" class="inline-flex items-center gap-2" @click="refreshAll">
          <Icon name="ri:refresh-line" class="size-4" />
          <span>Refresh</span>
        </Button>
      </template>
    </PageHeader>

    <!-- Metalake entry (AI Data Lake -> Catalog is the explorer entry, not Gravitino Catalog only) -->
    <div v-if="!q.metalake" class="flex flex-col gap-4">
      <Card class="shadow-none">
        <CardContent class="py-6">
          <div class="flex items-center justify-between gap-3 mb-4">
            <div>
              <div class="text-sm font-medium">Metalakes</div>
              <div class="text-xs text-muted-foreground">Browse and manage metalakes.</div>
            </div>
            <div class="flex items-center gap-3">
              <Input v-model="metalakeNameFilter" class="w-[240px]" placeholder="Query Name" />
              <Button variant="outline" class="inline-flex items-center gap-2" @click="openMetalakeCreate">
                <Icon name="ri:add-line" class="size-4" />
                <span>Create Metalake</span>
              </Button>
            </div>
          </div>

          <Separator class="mb-4" />

          <div v-if="isLoading" class="text-sm text-muted-foreground">Loading…</div>
          <template v-else>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Metalake</TableHead>
                  <TableHead>Created by</TableHead>
                  <TableHead>Created at</TableHead>
                  <TableHead class="w-[110px]">In use</TableHead>
                  <TableHead class="w-[220px]">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                <TableRow v-for="m in filteredMetalakeRows" :key="m.name">
                  <TableCell>
                    <div class="flex items-center gap-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        class="px-2 cursor-pointer disabled:cursor-not-allowed"
                        :disabled="m.inUse === false"
                        @click="goToMetalake(m.name)"
                      >
                        <span class="font-medium">{{ m.name }}</span>
                      </Button>
                    </div>
                    <div v-if="m.comment" class="text-xs text-muted-foreground mt-1 line-clamp-1">{{ m.comment }}</div>
                  </TableCell>

                  <TableCell class="text-sm text-muted-foreground">{{ m.createdBy || '—' }}</TableCell>
                  <TableCell class="text-sm text-muted-foreground">{{ m.createdAt || '—' }}</TableCell>

                  <TableCell>
                    <Switch
                      :key="`list-metalake-${m.name}-${isResourceInUse(m)}`"
                      :checked="isResourceInUse(m)"
                      :disabled="isLoading"
                      @update:checked="(v: boolean) => toggleMetalakeInUseFromList(m.name, v)"
                    />
                  </TableCell>

                  <TableCell>
                    <div class="flex items-center gap-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        :disabled="m.inUse === false"
                        :class="m.inUse === false ? '' : 'cursor-pointer'"
                        @click="() => m.inUse !== false && tryOpenMetalakeEdit(m.name, m.inUse)"
                      >
                        <Icon name="ri:edit-line" class="size-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        :disabled="m.inUse === true"
                        :class="m.inUse === true ? '' : 'cursor-pointer'"
                        @click="() => m.inUse !== true && openDelete('metalake', { metalake: m.name })"
                      >
                        <Icon name="ri:delete-bin-5-line" class="size-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              </TableBody>
            </Table>

            <EmptyState
              v-if="filteredMetalakeRows.length === 0"
              title="No metalakes"
              description="No metalakes found from the Gravitino server."
            />
          </template>
        </CardContent>
      </Card>
    </div>

    <!-- Explorer layout -->
    <div v-else class="grid grid-cols-1 lg:grid-cols-[320px_1fr] gap-4 min-h-[70vh]">
      <!-- Left Tree -->
      <Card class="shadow-none overflow-hidden">
        <CardContent class="p-0">
          <div class="p-4 space-y-3 border-b">
            <div class="flex items-center justify-between gap-2">
              <Button variant="ghost" size="sm" class="inline-flex items-center gap-1" @click="goToMetalakeList">
                <Icon name="ri:arrow-left-line" class="size-4" />
                <span>Metalakes</span>
              </Button>
              <div class="w-[180px]">
                <Selector v-model="currentMetalake" :options="metalakeOptions" placeholder="Metalake" />
              </div>
            </div>
            <div v-if="metalakeDetail?.comment" class="text-xs text-muted-foreground truncate">
              {{ metalakeDetail.comment }}
            </div>
          </div>

          <ScrollArea class="h-[calc(100vh-260px)]">
            <div class="p-2">
              <div class="px-2 py-1 text-xs text-muted-foreground">Catalogs</div>

              <div v-if="isLoading" class="p-3 text-sm text-muted-foreground">Loading…</div>

              <div v-else class="space-y-1">
                <div v-for="c in catalogs" :key="`${c.name}:${c.type}`" class="select-none">
                  <div class="flex items-center gap-1 px-2 py-1 rounded-md" :class="q.catalog === c.name && q.type === c.type ? 'bg-muted/50' : ''">
                    <button
                      class="p-1 rounded hover:bg-muted/40 cursor-pointer disabled:cursor-not-allowed"
                      :disabled="getResourceInUse(c) === false"
                      @click="toggleCatalogOpen(c.name, c.type)"
                    >
                      <Icon
                        :name="openCatalogKeys[`${c.name}::${c.type}`] ? 'ri:arrow-down-s-line' : 'ri:arrow-right-s-line'"
                        class="size-4 text-muted-foreground"
                      />
                    </button>

                    <button
                      class="flex items-center gap-2 px-1 py-1 rounded hover:bg-muted/40 flex-1 min-w-0 cursor-pointer disabled:cursor-not-allowed"
                      :disabled="getResourceInUse(c) === false"
                      @click="goToCatalog(q.metalake || '', c.name, c.type)"
                    >
                      <Icon name="ri:folder-2-line" class="size-4 text-muted-foreground" />
                      <span class="truncate text-sm">{{ c.name }}</span>
                    </button>
                  </div>

                  <div v-if="openCatalogKeys[`${c.name}::${c.type}`]" class="ml-6 mt-1 space-y-1">
                    <div v-if="treeLoading[`schemas:${c.name}::${c.type}`]" class="px-3 py-1 text-sm text-muted-foreground">
                      Loading…
                    </div>
                    <div v-else>
                      <div v-for="s in treeSchemasByCatalogKey[`${c.name}::${c.type}`] || []" :key="s">
                        <div class="flex items-center gap-1 px-2 py-1 rounded-md" :class="q.schema === s && q.catalog === c.name ? 'bg-muted/50' : ''">
                          <button class="p-1 rounded hover:bg-muted/40" @click="toggleSchemaOpen(c.name, c.type, s)">
                            <Icon
                              :name="openSchemaKeys[`${c.name}::${c.type}::${s}`] ? 'ri:arrow-down-s-line' : 'ri:arrow-right-s-line'"
                              class="size-4 text-muted-foreground"
                            />
                          </button>
                          <button
                            class="flex items-center gap-2 px-1 py-1 rounded hover:bg-muted/40 flex-1 min-w-0 cursor-pointer"
                            @click="goToSchema(q.metalake || '', c.name, c.type, s)"
                          >
                            <Icon name="ri:folder-3-line" class="size-4 text-muted-foreground" />
                            <span class="truncate text-sm">{{ s }}</span>
                          </button>
                        </div>

                        <div v-if="openSchemaKeys[`${c.name}::${c.type}::${s}`]" class="ml-6 mt-1 space-y-1">
                          <div v-if="treeLoading[`entities:${c.name}::${c.type}::${s}`]" class="px-3 py-1 text-sm text-muted-foreground">
                            Loading…
                          </div>
                          <div v-else>
                            <button
                              v-for="e in treeEntitiesBySchemaKey[`${c.name}::${c.type}::${s}`] || []"
                              :key="e"
                              class="w-full flex items-center gap-2 px-3 py-2 rounded-md hover:bg-muted/40 transition cursor-pointer"
                              :class="selectedEntityName === e && q.schema === s && q.catalog === c.name ? 'bg-muted/50' : ''"
                              @click="goToEntity(q.metalake || '', c.name, c.type, s, e)"
                            >
                              <Icon name="ri:file-list-3-line" class="size-4 text-muted-foreground" />
                              <span class="truncate text-sm">{{ e }}</span>
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </ScrollArea>
        </CardContent>
      </Card>

      <!-- Right Content (Gravitino-like: list tab + details tab) -->
      <Card class="shadow-none flex-1">
        <CardContent class="py-4">
          <div class="flex items-center justify-between gap-3 mb-4">
            <div class="min-w-0">
              <div class="text-sm text-muted-foreground">{{ breadcrumbText }}</div>
            </div>
            <div class="flex items-center gap-2">
              <Button v-if="currentLevel === 'metalake'" variant="outline" class="inline-flex items-center gap-2" @click="openCreate('catalog')">
                <Icon name="ri:add-line" class="size-4" />
                <span>Create Catalog</span>
              </Button>
              <Button v-else-if="currentLevel === 'catalog'" variant="outline" class="inline-flex items-center gap-2" @click="openCreate('schema')">
                <Icon name="ri:add-line" class="size-4" />
                <span>Create Schema</span>
              </Button>
              <Button
                v-else-if="currentLevel === 'schema' && currentEntityKind"
                variant="outline"
                class="inline-flex items-center gap-2"
                @click="openCreate(currentEntityKind)"
              >
                <Icon name="ri:add-line" class="size-4" />
                <span>Create {{ typeLabel(q.type) }}</span>
              </Button>
              <Button
                v-else-if="currentLevel === 'entity' && q.type === 'model' && selectedEntityName"
                variant="outline"
                class="inline-flex items-center gap-2"
                @click="openCreate('version')"
              >
                <Icon name="ri:add-line" class="size-4" />
                <span>Create Version</span>
              </Button>

              <Button variant="outline" size="sm" class="inline-flex items-center gap-2" @click="copyIdentity">
                <Icon name="ri:file-copy-line" class="size-4" />
                <span>Copy</span>
              </Button>
            </div>
          </div>

          <Tabs :default-value="rightTabsDefault">
            <TabsList>
              <TabsTrigger value="list">{{ listTabLabel }}</TabsTrigger>
              <TabsTrigger value="details">Details</TabsTrigger>
            </TabsList>

            <TabsContent value="list" class="mt-4">
              <div v-if="isLoading" class="text-sm text-muted-foreground">Loading…</div>

              <template v-else>
                <!-- Metalake level: catalogs table -->
                <div v-if="currentLevel === 'metalake'" class="space-y-3">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Name</TableHead>
                        <TableHead class="w-[140px]">Type</TableHead>
                        <TableHead class="w-[120px]">In use</TableHead>
                        <TableHead class="w-[120px]">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      <TableRow v-for="c in catalogs" :key="`${c.name}:${c.type}`">
                        <TableCell>
                          <Button
                            variant="ghost"
                            size="sm"
                            class="px-2"
                            :disabled="getResourceInUse(c) === false"
                            @click="goToCatalog(q.metalake || '', c.name, c.type)"
                          >
                            <span class="font-medium">{{ c.name }}</span>
                          </Button>
                        </TableCell>
                        <TableCell class="text-sm text-muted-foreground">{{ typeLabel(c.type) }}</TableCell>
                        <TableCell>
                          <Switch
                            :key="`list-catalog-${c.name}-${isResourceInUse(c)}`"
                            :checked="isResourceInUse(c) === true"
                            :disabled="isLoading"
                            @update:checked="(v: boolean) => toggleCatalogInUse(c.name, v)"
                          />
                        </TableCell>
                        <TableCell>
                          <div class="flex items-center gap-2">
                            <Button variant="ghost" size="sm" @click="() => { goToCatalog(q.metalake || '', c.name, c.type); openEdit('catalog') }">
                              <Icon name="ri:edit-line" class="size-4" />
                            </Button>
                            <Button variant="ghost" size="sm" @click="() => { goToCatalog(q.metalake || '', c.name, c.type); openDelete('catalog') }">
                              <Icon name="ri:delete-bin-5-line" class="size-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    </TableBody>
                  </Table>
                </div>

                <!-- Catalog level: schemas table -->
                <div v-else-if="currentLevel === 'catalog'" class="space-y-3">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Name</TableHead>
                        <TableHead class="w-[120px]">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      <TableRow v-for="s in schemas" :key="s">
                        <TableCell>
                          <Button variant="ghost" size="sm" class="px-2" @click="goToSchema(q.metalake || '', q.catalog || '', q.type || '', s)">
                            <span class="font-medium">{{ s }}</span>
                          </Button>
                        </TableCell>
                        <TableCell>
                          <div class="flex items-center gap-2">
                            <Button variant="ghost" size="sm" @click="() => { goToSchema(q.metalake || '', q.catalog || '', q.type || '', s); openEdit('schema') }">
                              <Icon name="ri:edit-line" class="size-4" />
                            </Button>
                            <Button variant="ghost" size="sm" @click="() => { goToSchema(q.metalake || '', q.catalog || '', q.type || '', s); openDelete('schema') }">
                              <Icon name="ri:delete-bin-5-line" class="size-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    </TableBody>
                  </Table>
                </div>

                <!-- Schema level: entities table -->
                <div v-else-if="currentLevel === 'schema'" class="space-y-3">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Name</TableHead>
                        <TableHead class="w-[120px]">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      <TableRow v-for="e in entities" :key="e">
                        <TableCell>
                          <Button
                            variant="ghost"
                            size="sm"
                            class="px-2"
                            @click="goToEntity(q.metalake || '', q.catalog || '', q.type || '', q.schema || '', e)"
                          >
                            <span class="font-medium">{{ e }}</span>
                          </Button>
                        </TableCell>
                        <TableCell>
                          <div class="flex items-center gap-2">
                            <Button variant="ghost" size="sm" @click="() => { goToEntity(q.metalake || '', q.catalog || '', q.type || '', q.schema || '', e); openEdit(currentEntityKind!) }">
                              <Icon name="ri:edit-line" class="size-4" />
                            </Button>
                            <Button variant="ghost" size="sm" @click="() => { goToEntity(q.metalake || '', q.catalog || '', q.type || '', q.schema || '', e); openDelete(currentEntityKind!) }">
                              <Icon name="ri:delete-bin-5-line" class="size-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    </TableBody>
                  </Table>
                </div>

                <!-- Entity level: for relational table show columns -->
                <div v-else-if="currentLevel === 'entity' && q.type === 'relational'" class="space-y-3">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Name</TableHead>
                        <TableHead>Type</TableHead>
                        <TableHead>Nullable</TableHead>
                        <TableHead>Autoincrement</TableHead>
                        <TableHead>Default Value</TableHead>
                        <TableHead>Comment</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      <TableRow v-for="col in (entityDetail?.columns || [])" :key="col.name">
                        <TableCell class="font-medium">{{ col.name }}</TableCell>
                        <TableCell>
                          <Badge variant="secondary">{{ col.type || col.dataType || '—' }}</Badge>
                        </TableCell>
                        <TableCell class="text-sm text-muted-foreground">{{ String(col.nullable ?? col.isNullable ?? '—') }}</TableCell>
                        <TableCell class="text-sm text-muted-foreground">{{ String(col.autoIncrement ?? col.isAutoIncrement ?? '—') }}</TableCell>
                        <TableCell class="text-sm text-muted-foreground">{{ col.defaultValue ?? col.default ?? '—' }}</TableCell>
                        <TableCell class="text-sm text-muted-foreground">{{ col.comment ?? '—' }}</TableCell>
                      </TableRow>
                    </TableBody>
                  </Table>
                </div>

                <!-- Entity level: for model show versions -->
                <div v-else-if="currentLevel === 'entity' && q.type === 'model'" class="space-y-3">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Version</TableHead>
                        <TableHead class="w-[120px]">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      <TableRow v-for="v in modelVersions" :key="String(v)">
                        <TableCell>
                          <Button
                            variant="ghost"
                            size="sm"
                            class="px-2"
                            @click="goToModelVersion(q.metalake || '', q.catalog || '', q.schema || '', q.model || '', String(v))"
                          >
                            <span class="font-medium">{{ String(v) }}</span>
                          </Button>
                        </TableCell>
                        <TableCell>
                          <div class="flex items-center gap-2">
                            <Button
                              variant="ghost"
                              size="sm"
                              @click="() => { goToModelVersion(q.metalake || '', q.catalog || '', q.schema || '', q.model || '', String(v)); openEdit('version') }"
                            >
                              <Icon name="ri:edit-line" class="size-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              @click="() => { goToModelVersion(q.metalake || '', q.catalog || '', q.schema || '', q.model || '', String(v)); openDelete('version') }"
                            >
                              <Icon name="ri:delete-bin-5-line" class="size-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    </TableBody>
                  </Table>
                </div>

                <!-- Fallback -->
                <div v-else class="text-sm text-muted-foreground">Select an item from the left tree.</div>
              </template>
            </TabsContent>

            <TabsContent value="details" class="mt-4">
              <div class="space-y-3">
                <div class="flex items-center justify-between">
                  <div class="text-sm font-medium">Details</div>
                  <div class="inline-flex items-center gap-2">
                    <span class="text-sm text-muted-foreground">In use</span>
                    <span class="text-[10px] font-bold" :class="isResourceInUse(metalakeDetail || currentMetalakeObj) ? 'text-blue-600' : 'text-slate-400'">
                      {{ isResourceInUse(metalakeDetail || currentMetalakeObj) ? 'TRUE' : 'FALSE' }}
                    </span>
                    <Switch
                      v-if="currentLevel === 'metalake'"
                      :key="`metalake-${q.metalake}-${isResourceInUse(metalakeDetail || currentMetalakeObj)}`"
                      :checked="isResourceInUse(metalakeDetail || currentMetalakeObj)"
                      :disabled="false"
                      @update:checked="toggleMetalakeInUse"
                    />
                    <Switch
                      v-else-if="currentLevel === 'catalog'"
                      :checked="isResourceInUse(catalogDetail || currentCatalogObj)"
                      :disabled="isLoading"
                      @update:checked="(v: boolean) => toggleCatalogInUse(q.catalog || '', v)"
                    />
                  </div>
                </div>

                <div class="rounded-md border p-3 bg-muted/20">
                  <div v-if="detailsRows.length === 0" class="text-sm text-muted-foreground">No details loaded</div>
                  <div v-else class="space-y-2">
                    <div v-for="row in detailsRows" :key="row.label" class="flex items-start justify-between gap-4">
                      <div class="text-xs text-muted-foreground shrink-0">{{ row.label }}</div>
                      <div class="text-sm font-medium text-right break-all">{{ row.value }}</div>
                    </div>
                  </div>

                  <div class="mt-3 flex items-center justify-end">
                    <Button variant="ghost" size="sm" class="inline-flex items-center gap-2" @click="showRawDetailsJson = !showRawDetailsJson">
                      <Icon name="ri:code-s-slash-line" class="size-4" />
                      <span>{{ showRawDetailsJson ? 'Hide raw JSON' : 'Show raw JSON' }}</span>
                    </Button>
                  </div>

                  <pre v-if="showRawDetailsJson" class="mt-2 text-xs rounded-md bg-muted/40 border p-3 overflow-auto max-h-[420px]">{{
                    JSON.stringify(versionDetail || entityDetail || schemaDetail || catalogDetail || metalakeDetail, null, 2)
                  }}</pre>
                </div>
              </div>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>

    <!-- Create Metalake (structured form) -->
    <Dialog v-model:open="createMetalakeOpen">
      <DialogContent class="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Create Metalake</DialogTitle>
          <DialogDescription>Provide basic metalake information and optional properties.</DialogDescription>
        </DialogHeader>

        <div class="space-y-4">
          <div class="space-y-2">
            <div class="text-sm font-medium">Name</div>
            <Input v-model="createMetalakeName" placeholder="metalake_name" />
          </div>

          <div class="space-y-2">
            <div class="text-sm font-medium">Comment</div>
            <Textarea v-model="createMetalakeComment" placeholder="Optional description" />
          </div>

          <div class="space-y-2">
            <div class="flex items-center justify-between gap-2">
              <div class="text-sm font-medium">Properties</div>
              <Button
                variant="outline"
                size="sm"
                class="inline-flex items-center gap-2"
                @click="addMetalakePropRow"
              >
                <Icon name="ri:add-line" class="size-4" />
                <span>Add</span>
              </Button>
            </div>

            <div class="space-y-2">
              <div
                v-for="(row, idx) in createMetalakeProps"
                :key="idx"
                class="grid grid-cols-1 md:grid-cols-[1fr_1fr_auto] gap-2"
              >
                <Input v-model="row.key" placeholder="key" />
                <Input v-model="row.value" placeholder="value" />
                <Button
                  variant="ghost"
                  size="sm"
                  class="justify-self-start"
                  :disabled="createMetalakeProps.length <= 1"
                  @click="removeMetalakePropRow(idx)"
                >
                  <Icon name="ri:delete-bin-5-line" class="size-4" />
                </Button>
              </div>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" @click="createMetalakeOpen = false">Cancel</Button>
          <Button :disabled="isLoading" class="inline-flex items-center gap-2" @click="submitCreateMetalake">
            <Icon name="ri:add-line" class="size-4" />
            <span>Create</span>
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>

    <!-- Edit Metalake (structured form) -->
    <Dialog v-model:open="editMetalakeOpen">
      <DialogContent class="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Edit Metalake</DialogTitle>
          <DialogDescription>Update metalake metadata and properties.</DialogDescription>
        </DialogHeader>

        <div class="space-y-4">
          <div class="space-y-2">
            <div class="text-sm font-medium">Name</div>
            <Input v-model="editMetalakeName" placeholder="metalake_name" />
          </div>

          <div class="space-y-2">
            <div class="text-sm font-medium">Comment</div>
            <Textarea v-model="editMetalakeComment" placeholder="Optional description" />
          </div>

          <div class="space-y-2">
            <div class="flex items-center justify-between gap-2">
              <div class="text-sm font-medium">Properties</div>
              <Button
                variant="outline"
                size="sm"
                class="inline-flex items-center gap-2"
                @click="addEditMetalakePropRow"
              >
                <Icon name="ri:add-line" class="size-4" />
                <span>Add Property</span>
              </Button>
            </div>

            <div class="space-y-2">
              <div
                v-for="(row, idx) in editMetalakeProps"
                :key="idx"
                class="grid grid-cols-1 md:grid-cols-[1fr_1fr_auto] gap-2"
              >
                <Input v-model="row.key" placeholder="Key" :disabled="row.key === 'in-use' || row.disabled" />
                <Input v-model="row.value" placeholder="Value" :disabled="row.key === 'in-use' || row.disabled" />
                <Button
                  variant="ghost"
                  size="sm"
                  class="justify-self-start"
                  :disabled="editMetalakeProps.length <= 1 || row.key === 'in-use' || row.disabled"
                  @click="removeEditMetalakePropRow(idx)"
                >
                  <Icon name="ri:delete-bin-5-line" class="size-4" />
                </Button>
              </div>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" @click="editMetalakeOpen = false">Cancel</Button>
          <Button :disabled="isLoading" class="inline-flex items-center gap-2" @click="submitEditMetalake">
            <Icon name="ri:save-3-line" class="size-4" />
            <span>Update</span>
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>

    <!-- Shared JSON editor dialog (create/edit) -->
    <Dialog v-model:open="editOpen">
      <DialogContent class="sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>{{ editTitle }}</DialogTitle>
          <DialogDescription v-if="editDescription">{{ editDescription }}</DialogDescription>
        </DialogHeader>
        <div class="space-y-2">
          <JsonEditor v-model="editJson" />
          <p class="text-xs text-muted-foreground">
            Tip: Use the format button to pretty-print JSON.
          </p>
        </div>
        <DialogFooter>
          <Button variant="outline" @click="editOpen = false">Cancel</Button>
          <Button :disabled="isLoading" class="inline-flex items-center gap-2" @click="submitEdit">
            <Icon v-if="editMode === 'create'" name="ri:add-line" class="size-4" />
            <Icon v-else name="ri:save-3-line" class="size-4" />
            <span>{{ editMode === 'create' ? 'Create' : 'Save' }}</span>
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>

    <!-- Shared delete confirm -->
    <AlertDialog v-model:open="deleteOpen">
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{{ deleteTitle }}</AlertDialogTitle>
          <AlertDialogDescription>
            This operation cannot be undone.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction @click="confirmDelete">Delete</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  </Page>
</template>
