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
  const directProp =
    resource?.properties?.['in-use'] ||
    resource?.metalake?.properties?.['in-use'] ||
    resource?.catalog?.properties?.['in-use']

  const propParsed = parseInUse(propRaw || directProp)

  // 3. Fallback to top-level fields
  const rawFallback = resource?.inUse ?? resource?.in_use ?? resource?.metalake?.inUse
  const fallbackParsed = parseInUse(rawFallback)

  const finalResult = propParsed ?? fallbackParsed

  return finalResult
}

const isResourceInUse = (resource: any): boolean => {
  return getResourceInUse(resource) === true
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
    resource?.audit?.creator,
    resource?.auditInfo?.creator,
    resource?.audit?.createdBy,
    resource?.auditInfo?.createdBy,
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

const getLastModifiedBy = (resource: any): string | undefined => {
  if (!resource) return undefined
  return pickFirstString(
    resource?.audit?.lastModifier,
    resource?.auditInfo?.lastModifier,
    resource?.audit?.lastModifiedBy,
    resource?.auditInfo?.lastModifiedBy,
    resource?.audit?.updatedBy,
    resource?.auditInfo?.updatedBy,
    resource?.lastModifiedBy,
    resource?.updatedBy
  )
}

const getLastModifiedAt = (resource: any): string | undefined => {
  if (!resource) return undefined
  return (
    formatTime(resource?.audit?.lastModifiedTime) ??
    formatTime(resource?.auditInfo?.lastModifiedTime) ??
    formatTime(resource?.audit?.updateTime) ??
    formatTime(resource?.auditInfo?.updateTime) ??
    formatTime(resource?.lastModifiedAt) ??
    formatTime(resource?.updatedAt) ??
    formatTime(resource?.updateTime)
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

const navigateToBreadcrumb = (params: {
  metalake?: string
  catalog?: string
  schema?: string
  entity?: string
  type?: string
}) => {
  const query: any = {}
  if (params.metalake) query.metalake = params.metalake
  if (params.catalog) query.catalog = params.catalog
  if (params.schema) query.schema = params.schema
  if (params.entity) query.entity = params.entity
  if (params.type) query.type = params.type
  goTo(query)
}

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
    // Only refresh the metalakes list without navigating away
    const res = await api.getMetalakes()
    metalakes.value = res.metalakes || []
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

const loadSchemasForCatalog = async (metalake: string, catalogName: string, type: string, forceRefresh = false) => {
  const cKey = catalogKeyOf(catalogName, type)
  if (!forceRefresh && treeSchemasByCatalogKey.value[cKey]) return
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
    metalakes.value = [...metalakes.value.slice(0, idx), updated, ...metalakes.value.slice(idx + 1)]
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

  const previous = [...catalogs.value]

  // Optimistically update local state
  const idx = catalogs.value.findIndex(c => c?.name === catalogName)
  if (idx !== -1) {
    const current = catalogs.value[idx]
    const updated = {
      ...current,
      inUse: next,
      properties: { ...(current.properties || {}), 'in-use': String(next) },
    }
    catalogs.value = [...catalogs.value.slice(0, idx), updated, ...catalogs.value.slice(idx + 1)]
  }

  try {
    isLoading.value = true
    await api.switchCatalogInUse(metalake, catalogName, next)
    message.success('Updated in-use')

    const { catalog, type } = q.value
    if (!next && catalog === catalogName && type) {
      goToMetalake(metalake)
    }
  } catch (err: any) {
    // Revert optimistic update on failure
    catalogs.value = previous
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
    const res = await api.getMetalake(name)
    const metalake = res?.metalake ?? res
    editMetalakeOriginal.value = metalake
    editMetalakeName.value = metalake?.name ?? name
    editMetalakeComment.value = metalake?.comment ?? ''
    editMetalakeProps.value = propsObjectToRows(metalake?.properties)
    editMetalakeOpen.value = true
  } catch {
    message.error('Failed to load metalake details')
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

    // Clear left tree cache to force reload
    treeSchemasByCatalogKey.value = {}
    treeEntitiesBySchemaKey.value = {}

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

    // Clear tree cache to force reload when user expands the tree
    const sKey = `${catalog}::${type}::${schema}`
    treeEntitiesBySchemaKey.value = Object.fromEntries(
      Object.entries(treeEntitiesBySchemaKey.value).filter(([k]) => k !== sKey)
    )
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
      // Always refresh catalog list when metalake changes to ensure we always have the latest data
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
      return 'Table'
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

const currentLevel = computed<'metalake-list' | 'metalake' | 'catalog' | 'schema' | 'entity' | 'version'>(() => {
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

  // For catalog detail, show Type and Provider at the beginning (like Gravitino)
  if (currentLevel.value === 'catalog') {
    const type = pickFirstString(target?.type)
    if (type) rows.push({ label: 'Type', value: typeLabel(type) })

    const provider = pickFirstString(target?.provider)
    if (provider) rows.push({ label: 'Provider', value: provider })
  }

  const comment = pickFirstString(target?.comment)
  if (comment) rows.push({ label: 'Comment', value: comment })

  // When we render an interactive switch in the Details header (metalake/catalog),
  // avoid duplicating it as a static row.
  const inUse = getResourceInUse(target)
  if (inUse != null && currentLevel.value !== 'metalake' && currentLevel.value !== 'catalog') {
    rows.push({ label: 'In use', value: String(inUse) })
  }

  // For non-catalog levels, show provider and type after comment if available
  if (currentLevel.value !== 'catalog') {
    const provider = pickFirstString(target?.provider)
    if (provider) rows.push({ label: 'Provider', value: provider })

    const type = pickFirstString(target?.type)
    if (type) rows.push({ label: 'Type', value: typeLabel(type) })
  }

  const createdBy = getCreatedBy(target)
  if (createdBy) rows.push({ label: 'Created by', value: createdBy })

  const createdAt = getCreatedAt(target)
  if (createdAt) rows.push({ label: 'Created at', value: createdAt })

  const lastModifiedBy = getLastModifiedBy(target)
  if (lastModifiedBy) rows.push({ label: 'Last modified by', value: lastModifiedBy })

  const lastModifiedAt = getLastModifiedAt(target)
  if (lastModifiedAt) rows.push({ label: 'Last modified at', value: lastModifiedAt })

  const properties = target?.properties
  if (properties && typeof properties === 'object') {
    rows.push({ label: 'Properties', value: String(Object.keys(properties).length) })
  }

  return rows
})

const showRawDetailsJson = ref(false)

const breadcrumbItems = computed(() => {
  const items: Array<{
    label: string
    params: { metalake?: string; catalog?: string; schema?: string; entity?: string; type?: string }
  }> = []

  if (q.value.metalake) {
    items.push({
      label: q.value.metalake,
      params: { metalake: q.value.metalake },
    })
  }

  if (q.value.catalog) {
    items.push({
      label: q.value.catalog,
      params: { metalake: q.value.metalake, catalog: q.value.catalog, type: q.value.type },
    })
  }

  if (q.value.schema) {
    items.push({
      label: q.value.schema,
      params: { metalake: q.value.metalake, catalog: q.value.catalog, schema: q.value.schema, type: q.value.type },
    })
  }

  if (selectedEntityName.value) {
    items.push({
      label: selectedEntityName.value,
      params: {
        metalake: q.value.metalake,
        catalog: q.value.catalog,
        schema: q.value.schema,
        entity: selectedEntityName.value,
        type: q.value.type,
      },
    })
  }

  return items
})

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
      if (q.value.type === 'fileset') return 'Files'
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

const rightTab = ref<'list' | 'details'>('list')

const filesetFilesLoading = ref(false)
const filesetFiles = ref<any[]>([])
const filesetFilesPath = ref('/')
const filesetFilesPathHistory = ref<string[]>(['/'])

const resetFilesetFilesState = () => {
  filesetFiles.value = []
  filesetFilesPath.value = '/'
  filesetFilesPathHistory.value = ['/']
}

const setFilesetPath = (path: string) => {
  filesetFilesPath.value = path
  if (!filesetFilesPathHistory.value.includes(path)) {
    filesetFilesPathHistory.value = [...filesetFilesPathHistory.value, path]
  }
}

const goFilesetBack = () => {
  if (filesetFilesPathHistory.value.length <= 1) return
  const nextHistory = filesetFilesPathHistory.value.slice(0, -1)
  filesetFilesPathHistory.value = nextHistory
  filesetFilesPath.value = nextHistory[nextHistory.length - 1]!
}

const openFilesetFolder = (file: any) => {
  if (!file?.isDir) return
  const base = filesetFilesPath.value === '/' ? '' : filesetFilesPath.value
  setFilesetPath(`${base}/${file?.name || ''}`.replace(/\/+/g, '/'))
}

const formatFileSize = (size?: number) => {
  const n = Number(size)
  if (!Number.isFinite(n) || n <= 0) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB']
  const i = Math.floor(Math.log(n) / Math.log(k))
  return `${(n / Math.pow(k, i)).toFixed(2)} ${sizes[i]}`
}

const formatFileTime = (value: unknown) => {
  return formatTime(value) ?? '—'
}

const filesetBreadcrumbs = computed(() => {
  const parts = filesetFilesPath.value.split('/').filter(Boolean)
  const crumbs = ['/', ...parts.map((_, idx) => `/${parts.slice(0, idx + 1).join('/')}`)]
  return crumbs
})

const loadFilesetFiles = async () => {
  const metalake = q.value.metalake
  const catalog = q.value.catalog
  const schema = q.value.schema
  const fileset = selectedEntityName.value
  if (!metalake || !catalog || !schema || !fileset) return

  try {
    filesetFilesLoading.value = true
    const res: any = await api.listFilesetFiles(metalake, catalog, schema, fileset, filesetFilesPath.value || '/')
    const files = res?.files ?? res?.fileInfos ?? res?.items ?? []
    filesetFiles.value = Array.isArray(files) ? files : []
  } catch (err: any) {
    filesetFiles.value = []
    message.error(err?.message || 'Failed to load files')
  } finally {
    filesetFilesLoading.value = false
  }
}

watch(
  () => [currentLevel.value, q.value.type, selectedEntityName.value],
  () => {
    if (currentLevel.value === 'entity' && q.value.type === 'fileset' && selectedEntityName.value) {
      resetFilesetFilesState()
      if (rightTab.value === 'list') {
        loadFilesetFiles()
      }
      return
    }
    resetFilesetFilesState()
  }
)

watch(
  () => [filesetFilesPath.value, rightTab.value],
  () => {
    if (rightTab.value !== 'list') return
    if (currentLevel.value === 'entity' && q.value.type === 'fileset' && selectedEntityName.value) {
      loadFilesetFiles()
    }
  }
)

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

type ResourceKind = 'metalake' | 'catalog' | 'schema' | 'table' | 'fileset' | 'topic' | 'model' | 'version'

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

// --- Create Catalog form (Gravitino-style structured form) ---

// Provider definitions (matching Gravitino's provider system exactly)
// For fileset type: NO provider selection (fixed as 'hadoop')
// For model type: NO provider selection
// For relational and messaging: provider selection required

interface PropDef {
  key: string
  value: string
  required: boolean
  description?: string
  select?: string[]
  defaultValue?: string
  parentField?: string
  hide?: string[]
}

interface ProviderDef {
  label: string
  value: string
  defaultProps: PropDef[]
}

const providers: ProviderDef[] = [
  {
    label: 'Apache Doris',
    value: 'jdbc-doris',
    defaultProps: [
      { key: 'jdbc-driver', value: '', required: true, description: 'e.g. com.mysql.jdbc.Driver' },
      { key: 'jdbc-url', value: '', required: true, description: 'e.g. jdbc:mysql://localhost:9030' },
      { key: 'jdbc-user', value: '', required: true },
      { key: 'jdbc-password', value: '', required: true },
    ],
  },
  {
    label: 'Apache Hive',
    value: 'hive',
    defaultProps: [{ key: 'metastore.uris', value: '', required: true, description: 'The Apache Hive metastore URIs' }],
  },
  {
    label: 'Apache Hudi',
    value: 'lakehouse-hudi',
    defaultProps: [
      {
        key: 'catalog-backend',
        value: 'hms',
        defaultValue: 'hms',
        required: true,
        select: ['hms'],
        description: 'Apache Hudi catalog type choose properties',
      },
      { key: 'uri', value: '', required: true, description: 'Apache Hudi catalog uri config' },
    ],
  },
  {
    label: 'Apache Iceberg',
    value: 'lakehouse-iceberg',
    defaultProps: [
      {
        key: 'catalog-backend',
        value: 'hive',
        defaultValue: 'hive',
        required: true,
        select: ['hive', 'jdbc', 'rest'],
        description: 'Apache Iceberg catalog type choose properties',
      },
      { key: 'uri', value: '', required: true, description: 'Apache Iceberg catalog uri config' },
      { key: 'warehouse', value: '', required: false, description: 'Apache Iceberg catalog warehouse config' },
      {
        key: 'jdbc-driver',
        value: '',
        required: true,
        parentField: 'catalog-backend',
        hide: ['hive', 'rest'],
        description:
          '"com.mysql.jdbc.Driver" or "com.mysql.cj.jdbc.Driver" for MySQL, "org.postgresql.Driver" for PostgreSQL',
      },
      { key: 'jdbc-user', value: '', required: true, parentField: 'catalog-backend', hide: ['hive', 'rest'] },
      { key: 'jdbc-password', value: '', required: true, parentField: 'catalog-backend', hide: ['hive', 'rest'] },
      {
        key: 'authentication.type',
        value: 'simple',
        defaultValue: 'simple',
        required: false,
        description:
          'The type of authentication for Paimon catalog backend, currently Gravitino only supports Kerberos and simple',
        select: ['simple', 'Kerberos'],
      },
      {
        key: 'authentication.kerberos.principal',
        value: '',
        required: true,
        description: 'The principal of the Kerberos authentication.',
        parentField: 'authentication.type',
        hide: ['simple'],
      },
      {
        key: 'authentication.kerberos.keytab-uri',
        value: '',
        required: true,
        description: 'The URI of The keytab for the Kerberos authentication.',
        parentField: 'authentication.type',
        hide: ['simple'],
      },
    ],
  },
  {
    label: 'Apache Paimon',
    value: 'lakehouse-paimon',
    defaultProps: [
      {
        key: 'catalog-backend',
        value: 'filesystem',
        defaultValue: 'filesystem',
        required: true,
        select: ['filesystem', 'hive', 'jdbc'],
      },
      {
        key: 'uri',
        value: '',
        required: true,
        description: 'e.g. thrift://127.0.0.1:9083 or jdbc:postgresql://127.0.0.1:5432/db_name',
        parentField: 'catalog-backend',
        hide: ['filesystem'],
      },
      {
        key: 'warehouse',
        value: '',
        required: true,
        description: 'e.g. file:///user/hive/warehouse-paimon/ or hdfs://namespace/hdfs/path',
      },
      {
        key: 'jdbc-driver',
        value: '',
        required: true,
        parentField: 'catalog-backend',
        hide: ['hive', 'filesystem'],
        description:
          '"com.mysql.jdbc.Driver" or "com.mysql.cj.jdbc.Driver" for MySQL, "org.postgresql.Driver" for PostgreSQL',
      },
      { key: 'jdbc-user', value: '', required: true, parentField: 'catalog-backend', hide: ['hive', 'filesystem'] },
      { key: 'jdbc-password', value: '', required: true, parentField: 'catalog-backend', hide: ['hive', 'filesystem'] },
      {
        key: 'authentication.type',
        value: 'simple',
        defaultValue: 'simple',
        required: false,
        description:
          'The type of authentication for Paimon catalog backend, currently Gravitino only supports Kerberos and simple',
        select: ['simple', 'Kerberos'],
      },
      {
        key: 'authentication.kerberos.principal',
        value: '',
        required: true,
        description: 'The principal of the Kerberos authentication.',
        parentField: 'authentication.type',
        hide: ['simple'],
      },
      {
        key: 'authentication.kerberos.keytab-uri',
        value: '',
        required: true,
        description: 'The URI of The keytab for the Kerberos authentication.',
        parentField: 'authentication.type',
        hide: ['simple'],
      },
    ],
  },
  {
    label: 'Lakehouse Generic',
    value: 'lakehouse-generic',
    defaultProps: [],
  },
  {
    label: 'MySQL',
    value: 'jdbc-mysql',
    defaultProps: [
      {
        key: 'jdbc-driver',
        value: '',
        required: true,
        description: 'e.g. com.mysql.jdbc.Driver or com.mysql.cj.jdbc.Driver',
      },
      { key: 'jdbc-url', value: '', required: true, description: 'e.g. jdbc:mysql://localhost:3306' },
      { key: 'jdbc-user', value: '', required: true },
      { key: 'jdbc-password', value: '', required: true },
    ],
  },
  {
    label: 'OceanBase',
    value: 'jdbc-oceanbase',
    defaultProps: [
      {
        key: 'jdbc-driver',
        value: '',
        required: true,
        description: 'e.g. com.mysql.jdbc.Driver or com.mysql.cj.jdbc.Driver or com.oceanbase.jdbc.Driver',
      },
      {
        key: 'jdbc-url',
        value: '',
        required: true,
        description: 'e.g. jdbc:mysql://localhost:2881 or jdbc:oceanbase://localhost:2881',
      },
      { key: 'jdbc-user', value: '', required: true },
      { key: 'jdbc-password', value: '', required: true },
    ],
  },
  {
    label: 'PostgreSQL',
    value: 'jdbc-postgresql',
    defaultProps: [
      { key: 'jdbc-driver', value: '', required: true, description: 'e.g. org.postgresql.Driver' },
      {
        key: 'jdbc-url',
        value: '',
        required: true,
        description: 'e.g. jdbc:postgresql://localhost:5432/your_database',
      },
      { key: 'jdbc-user', value: '', required: true },
      { key: 'jdbc-password', value: '', required: true },
      { key: 'jdbc-database', value: '', required: true },
    ],
  },
  {
    label: 'StarRocks',
    value: 'jdbc-starrocks',
    defaultProps: [
      { key: 'jdbc-driver', value: '', required: true, description: 'e.g. com.mysql.jdbc.Driver' },
      { key: 'jdbc-url', value: '', required: true, description: 'e.g. jdbc:mysql://localhost:9030' },
      { key: 'jdbc-user', value: '', required: true },
      { key: 'jdbc-password', value: '', required: true },
    ],
  },
]

const messagingProviders: ProviderDef[] = [
  {
    label: 'Apache Kafka',
    value: 'kafka',
    defaultProps: [
      {
        key: 'bootstrap.servers',
        value: '',
        required: true,
        description: 'The Apache Kafka brokers to connect to, allowing for multiple brokers separated by commas',
      },
    ],
  },
]

// For fileset: No provider selection, no default props shown until user adds
const filesetDefaultProps: PropDef[] = []

const createCatalogOpen = ref(false)
const createCatalogName = ref('')
const createCatalogType = ref('relational')
const createCatalogProvider = ref('hive') // Default to first relational provider
const createCatalogComment = ref('')
const createCatalogProps = ref<
  Array<{
    key: string
    value: string
    required?: boolean
    description?: string
    select?: string[]
    parentField?: string
    hide?: string[]
  }>
>([])

// Computed: whether provider selection should be shown (not for fileset/model)
const showProviderSelect = computed(() => {
  return createCatalogType.value === 'relational' || createCatalogType.value === 'messaging'
})

// Computed: available providers based on type
const availableProviders = computed((): ProviderDef[] => {
  switch (createCatalogType.value) {
    case 'relational':
      return providers
    case 'messaging':
      return messagingProviders
    default:
      return []
  }
})

// Helper: check if a property should be hidden based on parentField
const shouldHideProp = (prop: { parentField?: string; hide?: string[] }) => {
  if (!prop.parentField || !prop.hide) return false
  const parentProp = createCatalogProps.value.find(p => p.key === prop.parentField)
  if (!parentProp) return true // Parent not found, hide
  return prop.hide.includes(parentProp.value)
}

const catalogBackendValue = computed(() => createCatalogProps.value.find(p => p.key === 'catalog-backend')?.value)

const updateWarehouseRequired = () => {
  if (createCatalogProvider.value !== 'lakehouse-iceberg') return
  const backend = catalogBackendValue.value
  const required = backend === 'hive' || backend === 'jdbc'
  createCatalogProps.value = createCatalogProps.value.map(p => (p.key === 'warehouse' ? { ...p, required } : p))
}

// Watch for provider change to update properties
watch(
  createCatalogProvider,
  newProvider => {
    if (!showProviderSelect.value) return
    const provider = availableProviders.value.find(p => p.value === newProvider)
    if (provider && provider.defaultProps) {
      createCatalogProps.value = provider.defaultProps.map(p => ({
        key: p.key,
        value: p.defaultValue || p.value,
        required: p.required,
        description: p.description,
        select: p.select,
        parentField: p.parentField,
        hide: p.hide,
      }))
    } else {
      createCatalogProps.value = []
    }
    updateWarehouseRequired()
  },
  { immediate: true }
)

watch(catalogBackendValue, () => {
  updateWarehouseRequired()
})

// Watch for type change to reset provider and properties
watch(createCatalogType, newType => {
  switch (newType) {
    case 'relational':
      createCatalogProvider.value = 'hive'
      break
    case 'messaging':
      createCatalogProvider.value = 'kafka'
      break
    case 'fileset':
      createCatalogProvider.value = ''
      createCatalogProps.value = filesetDefaultProps.map(p => ({
        key: p.key,
        value: p.value,
        required: p.required,
        description: p.description,
      }))
      break
    case 'model':
      createCatalogProvider.value = ''
      createCatalogProps.value = []
      break
  }
})

const catalogPropsObject = computed(() => {
  const obj: Record<string, string> = {}
  for (const row of createCatalogProps.value) {
    const k = row.key?.trim()
    if (!k) continue
    // Skip hidden fields
    if (shouldHideProp(row)) continue
    // Skip empty non-required fields
    if (!row.required && !row.value?.trim()) continue
    obj[k] = row.value ?? ''
  }
  return obj
})

const isCatalogFormValid = computed(() => {
  if (!createCatalogName.value.trim()) return false
  // Provider not required for fileset and model types
  if (showProviderSelect.value && !createCatalogProvider.value) return false

  // Check required properties (only visible ones)
  for (const prop of createCatalogProps.value) {
    if (shouldHideProp(prop)) continue
    if (prop.required && !prop.value?.trim()) {
      return false
    }
  }

  return true
})

const addCatalogPropRow = () => {
  createCatalogProps.value = [...createCatalogProps.value, { key: '', value: '', required: false }]
}

const removeCatalogPropRow = (idx: number) => {
  // Don't allow removing required props
  const prop = createCatalogProps.value[idx]
  if (prop?.required) return
  createCatalogProps.value = createCatalogProps.value.filter((_, i) => i !== idx)
}

const submitCreateCatalog = async () => {
  const name = createCatalogName.value.trim()
  const metalake = q.value.metalake
  if (!name) {
    message.error('Name is required')
    return
  }
  // Provider required only for relational and messaging
  if (showProviderSelect.value && !createCatalogProvider.value) {
    message.error('Provider is required')
    return
  }
  if (!metalake) {
    message.error('Metalake context is required')
    return
  }

  // Validate required properties (only visible ones)
  const missingRequired = createCatalogProps.value.find(p => !shouldHideProp(p) && p.required && !p.value?.trim())
  if (missingRequired) {
    message.error(`Required property "${missingRequired.key}" is missing`)
    return
  }

  try {
    isLoading.value = true
    await api.createCatalog(metalake, {
      name,
      type: createCatalogType.value,
      provider: createCatalogProvider.value || undefined,
      comment: createCatalogComment.value,
      properties: catalogPropsObject.value,
    })
    message.success('Catalog created')
    createCatalogOpen.value = false
    await refreshMetalakeContext(metalake)
    goToCatalog(metalake, name, createCatalogType.value)
  } catch (err: any) {
    message.error(err?.message || 'Failed to create catalog')
  } finally {
    isLoading.value = false
  }
}

// --- Create Schema form (Gravitino-style structured form) ---
const createSchemaOpen = ref(false)
const createSchemaName = ref('')
const createSchemaComment = ref('')
const createSchemaProps = ref<Array<{ key: string; value: string }>>([{ key: '', value: '' }])

const schemaPropsObject = computed(() => {
  const obj: Record<string, string> = {}
  for (const row of createSchemaProps.value) {
    const k = row.key?.trim()
    if (!k) continue
    obj[k] = row.value ?? ''
  }
  return obj
})

const addSchemaPropRow = () => {
  createSchemaProps.value = [...createSchemaProps.value, { key: '', value: '' }]
}

const removeSchemaPropRow = (idx: number) => {
  if (createSchemaProps.value.length <= 1) return
  createSchemaProps.value = createSchemaProps.value.filter((_, i) => i !== idx)
}

const submitCreateSchema = async () => {
  const name = createSchemaName.value.trim()
  const metalake = q.value.metalake
  const catalog = q.value.catalog
  const type = q.value.type
  if (!name) {
    message.error('Name is required')
    return
  }
  if (!metalake || !catalog || !type) {
    message.error('Catalog context is required')
    return
  }

  try {
    isLoading.value = true
    await api.createSchema(metalake, catalog, {
      name,
      comment: createSchemaComment.value,
      properties: schemaPropsObject.value,
    })
    message.success('Schema created')
    createSchemaOpen.value = false
    await refreshCatalogContext(metalake, catalog, type)
    // Stay on catalog page, don't navigate
    // Force refresh left tree with forceRefresh=true
    await loadSchemasForCatalog(metalake, catalog, type, true)
  } catch (err: any) {
    message.error(err?.message || 'Failed to create schema')
  } finally {
    isLoading.value = false
  }
}

// Column type mapping by provider (from Gravitino initial.js)
const relationalColumnTypeMap: Record<string, string[]> = {
  'lakehouse-iceberg': [
    'binary',
    'boolean',
    'date',
    'decimal',
    'double',
    'fixed',
    'float',
    'integer',
    'long',
    'string',
    'time',
    'timestamp',
    'timestamp_tz',
    'uuid',
  ],
  hive: [
    'binary',
    'boolean',
    'byte',
    'char',
    'date',
    'decimal',
    'double',
    'float',
    'integer',
    'interval_day',
    'interval_year',
    'long',
    'short',
    'string',
    'timestamp',
    'varchar',
  ],
  'jdbc-mysql': [
    'binary',
    'byte',
    'byte unsigned',
    'char',
    'date',
    'decimal',
    'double',
    'float',
    'integer',
    'integer unsigned',
    'long',
    'long unsigned',
    'short',
    'short unsigned',
    'string',
    'time',
    'timestamp',
    'varchar',
  ],
  'jdbc-postgresql': [
    'binary',
    'boolean',
    'char',
    'date',
    'decimal',
    'double',
    'float',
    'integer',
    'long',
    'short',
    'string',
    'time',
    'timestamp',
    'timestamp_tz',
    'varchar',
  ],
  'jdbc-starrocks': [
    'binary',
    'boolean',
    'byte',
    'char',
    'date',
    'decimal',
    'double',
    'float',
    'integer',
    'long',
    'short',
    'string',
    'timestamp',
    'varchar',
  ],
  'jdbc-doris': [
    'boolean',
    'byte',
    'char',
    'date',
    'decimal',
    'double',
    'float',
    'integer',
    'long',
    'short',
    'string',
    'timestamp',
    'varchar',
  ],
  'lakehouse-paimon': [
    'binary',
    'boolean',
    'byte',
    'char',
    'date',
    'decimal',
    'double',
    'fixed',
    'float',
    'integer',
    'long',
    'short',
    'string',
    'time',
    'timestamp',
    'timestamp_tz',
    'varchar',
  ],
  'lakehouse-generic': [
    'binary',
    'boolean',
    'byte',
    'date',
    'decimal',
    'double',
    'fixed',
    'float',
    'integer',
    'interval_day',
    'interval_year',
    'long',
    'short',
    'string',
    'time',
    'timestamp',
  ],
  'jdbc-oceanbase': [
    'binary',
    'byte',
    'byte unsigned',
    'char',
    'date',
    'decimal',
    'double',
    'float',
    'integer',
    'integer unsigned',
    'long',
    'long unsigned',
    'short',
    'short unsigned',
    'string',
    'time',
    'timestamp',
    'varchar',
  ],
}

// Table property info by provider (from Gravitino initial.js)
const relationalTablePropInfo: Record<
  string,
  {
    immutable: string[]
    defaultProps?: Array<{ key: string; value: string; required?: boolean; description?: string; disabled?: boolean }>
  }
> = {
  'lakehouse-generic': {
    immutable: ['format', 'location'],
    defaultProps: [
      {
        key: 'location',
        value: '',
        required: true,
        description: 'The storage location of the table. Required if not set in catalog or schema.',
      },
      {
        key: 'format',
        value: 'lance',
        required: false,
        description: "The table format. Currently only 'lance' is supported.",
        disabled: true,
      },
    ],
  },
  'lakehouse-iceberg': {
    immutable: ['location', 'provider', 'format', 'format-version'],
  },
  hive: {
    immutable: [
      'format',
      'input-format',
      'location',
      'output-format',
      'serde-name',
      'serde-lib',
      'serde.parameter',
      'table-type',
    ],
  },
  'lakehouse-paimon': {
    immutable: ['merge-engine', 'rowkind.field', 'sequence.field'],
  },
  'jdbc-mysql': {
    immutable: ['auto-increment-offset', 'engine'],
  },
}

const getColumnTypesForProvider = (provider: string | undefined): string[] => {
  if (!provider) return []
  return relationalColumnTypeMap[provider] || []
}

const getTablePropInfo = (provider: string | undefined) => {
  if (!provider) return { immutable: [], defaultProps: [] }
  return relationalTablePropInfo[provider] || { immutable: [], defaultProps: [] }
}

// --- Create Table form (Gravitino-style structured form) ---
const createTableOpen = ref(false)
const createTableName = ref('')
const createTableComment = ref('')
const createTableColumns = ref<Array<{ name: string; type: string; nullable: boolean; comment: string }>>([
  { name: '', type: '', nullable: true, comment: '' },
])
const createTableProps = ref<
  Array<{ key: string; value: string; disabled?: boolean; required?: boolean; description?: string }>
>([
  { key: 'location', value: '' },
  { key: 'format', value: 'lance' },
])

const tablePropsObject = computed(() => {
  const obj: Record<string, string> = {}
  for (const row of createTableProps.value) {
    const k = row.key?.trim()
    if (!k) continue
    obj[k] = row.value ?? ''
  }
  return obj
})

const addTableColumn = () => {
  createTableColumns.value = [...createTableColumns.value, { name: '', type: '', nullable: true, comment: '' }]
}

const removeTableColumn = (idx: number) => {
  if (createTableColumns.value.length <= 1) return
  createTableColumns.value = createTableColumns.value.filter((_, i) => i !== idx)
}

const addTablePropRow = () => {
  createTableProps.value = [...createTableProps.value, { key: '', value: '' }]
}

const removeTablePropRow = (idx: number) => {
  if (createTableProps.value.length <= 1) return
  createTableProps.value = createTableProps.value.filter((_, i) => i !== idx)
}

const submitCreateTable = async () => {
  const name = createTableName.value.trim()
  const metalake = q.value.metalake
  const catalog = q.value.catalog
  const schema = q.value.schema
  const type = q.value.type
  if (!name) {
    message.error('Name is required')
    return
  }
  if (!metalake || !catalog || !schema || !type) {
    message.error('Schema context is required')
    return
  }

  // Validate columns
  const columns = createTableColumns.value.filter(c => c.name.trim() && c.type.trim())
  if (columns.length === 0) {
    message.error('At least one column is required')
    return
  }

  try {
    isLoading.value = true
    await api.createTable(metalake, catalog, schema, {
      name,
      comment: createTableComment.value,
      columns: columns.map(c => ({
        name: c.name,
        type: c.type,
        nullable: c.nullable,
        comment: c.comment,
      })),
      properties: tablePropsObject.value,
    })
    message.success('Table created')
    createTableOpen.value = false
    await refreshSchemaContext(metalake, catalog, type, schema)
    await loadEntitiesForSchema(metalake, catalog, type, schema)
    // Stay on schema page, don't navigate
  } catch (err: any) {
    message.error(err?.message || 'Failed to create table')
  } finally {
    isLoading.value = false
  }
}

// --- Create Fileset form (Gravitino-style structured form) ---
const createFilesetOpen = ref(false)
const createFilesetName = ref('')
const createFilesetType = ref('Managed')
const createFilesetComment = ref('')
const createFilesetLocations = ref<Array<{ name: string; location: string }>>([{ name: '', location: '' }])
const createFilesetProps = ref<Array<{ key: string; value: string }>>([{ key: '', value: '' }])

const filesetPropsObject = computed(() => {
  const obj: Record<string, string> = {}
  for (const row of createFilesetProps.value) {
    const k = row.key?.trim()
    if (!k) continue
    obj[k] = row.value ?? ''
  }
  return obj
})

const addFilesetLocation = () => {
  const idx = createFilesetLocations.value.length + 1
  createFilesetLocations.value = [...createFilesetLocations.value, { name: `Name ${idx}`, location: `Location ${idx}` }]
}

const removeFilesetLocation = (idx: number) => {
  if (createFilesetLocations.value.length <= 1) return
  createFilesetLocations.value = createFilesetLocations.value.filter((_, i) => i !== idx)
}

const addFilesetPropRow = () => {
  createFilesetProps.value = [...createFilesetProps.value, { key: '', value: '' }]
}

const removeFilesetPropRow = (idx: number) => {
  if (createFilesetProps.value.length <= 1) return
  createFilesetProps.value = createFilesetProps.value.filter((_, i) => i !== idx)
}

const submitCreateFileset = async () => {
  const name = createFilesetName.value.trim()
  const metalake = q.value.metalake
  const catalog = q.value.catalog
  const schema = q.value.schema
  const type = q.value.type
  if (!name) {
    message.error('Name is required')
    return
  }
  if (!metalake || !catalog || !schema || !type) {
    message.error('Schema context is required')
    return
  }

  try {
    isLoading.value = true

    // Convert storage locations array to object format: { "name": "location", ... }
    const storageLocations: Record<string, string> = {}
    for (const loc of createFilesetLocations.value) {
      const locName = loc.name?.trim()
      const locPath = loc.location?.trim()
      if (locName && locPath) {
        storageLocations[locName] = locPath
      }
    }

    // Build properties including default-location-name
    const properties = { ...filesetPropsObject.value }
    const firstLocationName = createFilesetLocations.value[0]?.name?.trim()
    if (firstLocationName) {
      properties['default-location-name'] = firstLocationName
    }

    await api.createFileset(metalake, catalog, schema, {
      name,
      type: createFilesetType.value,
      storageLocations,
      comment: createFilesetComment.value,
      properties,
    })
    message.success('Fileset created')
    createFilesetOpen.value = false
    await refreshSchemaContext(metalake, catalog, type, schema)
    // Force tree to reload with updated filesets
    await loadEntitiesForSchema(metalake, catalog, type, schema)
  } catch (err: any) {
    message.error(err?.message || 'Failed to create fileset')
  } finally {
    isLoading.value = false
  }
}

const openCreate = (kind: ResourceKind) => {
  // For catalog, schema, table, fileset, use Gravitino-style structured forms
  if (kind === 'catalog') {
    createCatalogName.value = ''
    createCatalogType.value = 'relational'
    createCatalogProvider.value = ''
    createCatalogComment.value = ''
    createCatalogProps.value = [{ key: '', value: '' }]
    createCatalogOpen.value = true
    return
  }

  if (kind === 'schema') {
    createSchemaName.value = ''
    createSchemaComment.value = ''
    createSchemaProps.value = [{ key: '', value: '' }]
    createSchemaOpen.value = true
    return
  }

  if (kind === 'table') {
    createTableName.value = ''
    createTableComment.value = ''
    createTableColumns.value = [{ name: '', type: '', nullable: true, comment: '' }]

    // Get current catalog provider to set default props
    const catalog = catalogs.value.find(c => c.name === q.value.catalog)
    const provider = catalog?.provider
    const propInfo = getTablePropInfo(provider)

    // Initialize properties with default props from provider config
    if (propInfo.defaultProps && propInfo.defaultProps.length > 0) {
      createTableProps.value = propInfo.defaultProps.map(p => ({
        key: p.key,
        value: p.value,
        disabled: p.disabled,
        required: p.required,
        description: p.description,
      }))
    } else {
      createTableProps.value = [{ key: '', value: '' }]
    }

    createTableOpen.value = true
    return
  }

  if (kind === 'fileset') {
    createFilesetName.value = ''
    createFilesetType.value = 'Managed'
    createFilesetComment.value = ''
    createFilesetLocations.value = [{ name: '', location: '' }]
    createFilesetProps.value = [{ key: '', value: '' }]
    createFilesetOpen.value = true
    return
  }

  // For other types (topic, model, version), continue using JSON editor
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

  // Title generation for JSON editor mode (only topic, model, version now)
  if (kind === 'topic' || kind === 'model') {
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

  const metalake = q.value.metalake
  const catalog = q.value.catalog
  const type = q.value.type
  const schema = q.value.schema
  const entity = selectedEntityName.value

  // For structured dialogs, always try to load fresh details from API
  if (kind === 'catalog') {
    if (metalake && catalog) {
      void openCatalogEdit(metalake, catalog)
      return
    }
  }

  if (kind === 'schema') {
    if (metalake && catalog && schema) {
      void openSchemaEdit(metalake, catalog, schema)
      return
    }
  }

  if (kind === 'table') {
    if (metalake && catalog && schema && entity) {
      void openTableEdit(metalake, catalog, schema, entity)
      return
    }
  }

  if (kind === 'fileset') {
    if (metalake && catalog && schema && entity) {
      void openFilesetEdit(metalake, catalog, schema, entity)
      return
    }
  }

  if (!current) {
    message.warning('No details loaded yet')
    return
  }

  editTitle.value = `Edit ${kind}`
  editJson.value = JSON.stringify(current, null, 2)
  editOpen.value = true
}

// --- Schema edit form (Gravitino-like) ---
const editSchemaOpen = ref(false)
const editSchemaOriginal = ref<any | null>(null)
const editSchemaName = ref('')
const editSchemaComment = ref('')
const editSchemaProps = ref<Array<{ key: string; value: string }>>([{ key: '', value: '' }])

const editSchemaPropsObject = computed(() => {
  const obj: Record<string, string> = {}
  for (const row of editSchemaProps.value) {
    const k = row.key?.trim()
    if (!k) continue
    obj[k] = row.value ?? ''
  }
  return obj
})

async function openSchemaEdit(metalake: string, catalog: string, schema: string) {
  try {
    isLoading.value = true
    const res = await api.getSchema(metalake, catalog, schema)
    const s = res?.schema ?? res
    if (!s) {
      message.warning('No details loaded yet')
      return
    }
    editSchemaOriginal.value = s
    editSchemaName.value = s?.name ?? schema
    editSchemaComment.value = s?.comment ?? ''
    editSchemaProps.value = s?.properties
      ? Object.entries(s.properties).map(([key, value]) => ({ key, value: String(value) }))
      : [{ key: '', value: '' }]
    editSchemaOpen.value = true
  } catch {
    message.error('Failed to load schema details')
  } finally {
    isLoading.value = false
  }
}

async function submitEditSchema() {
  const original = editSchemaOriginal.value
  const metalake = q.value.metalake
  const catalog = q.value.catalog
  const type = q.value.type
  if (!original || !metalake || !catalog || !type) return

  const next = {
    name: editSchemaName.value.trim(),
    comment: editSchemaComment.value,
    properties: editSchemaPropsObject.value,
  }
  if (!next.name) {
    message.error('Name is required')
    return
  }

  try {
    isLoading.value = true
    const updates = genUpdates(original, next)
    await api.updateSchema(metalake, catalog, original?.name ?? next.name, { updates })
    message.success('Schema updated')
    editSchemaOpen.value = false
    await refreshCatalogContext(metalake, catalog, type)
  } catch (err: any) {
    message.error(err?.message || 'Failed to update schema')
  } finally {
    isLoading.value = false
  }
}

// --- Table edit form (Gravitino-like) ---
const editTableOpen = ref(false)
const editTableOriginal = ref<any | null>(null)
const editTableName = ref('')
const editTableComment = ref('')
const editTableColumns = ref<Array<{ name: string; type: string; nullable: boolean; comment: string }>>([
  { name: '', type: '', nullable: true, comment: '' },
])
const editTableProps = ref<Array<{ key: string; value: string }>>([{ key: '', value: '' }])

const editTablePropsObject = computed(() => {
  const obj: Record<string, string> = {}
  for (const row of editTableProps.value) {
    const k = row.key?.trim()
    if (!k) continue
    obj[k] = row.value ?? ''
  }
  return obj
})

async function openTableEdit(metalake: string, catalog: string, schema: string, table: string) {
  try {
    const res = await api.getTable(metalake, catalog, schema, table)
    const t = res?.table ?? res
    if (!t) {
      message.warning('No details loaded yet')
      return
    }
    editTableOriginal.value = t
    editTableName.value = t?.name ?? table
    editTableComment.value = t?.comment ?? ''
    editTableColumns.value = t?.columns?.length ? t.columns : [{ name: '', type: '', nullable: true, comment: '' }]
    editTableProps.value = t?.properties
      ? Object.entries(t.properties).map(([key, value]) => ({ key, value: String(value) }))
      : [{ key: '', value: '' }]
    editTableOpen.value = true
  } catch {
    message.error('Failed to load table details')
  }
}

async function submitEditTable() {
  const original = editTableOriginal.value
  const metalake = q.value.metalake
  const catalog = q.value.catalog
  const type = q.value.type
  const schema = q.value.schema
  if (!original || !metalake || !catalog || !type || !schema) return

  const next = {
    name: editTableName.value.trim(),
    comment: editTableComment.value,
    properties: editTablePropsObject.value,
  }
  if (!next.name) {
    message.error('Name is required')
    return
  }

  try {
    isLoading.value = true
    const updates = genUpdates(original, next)
    await api.updateTable(metalake, catalog, schema, original?.name ?? next.name, { updates })
    message.success('Table updated')
    editTableOpen.value = false
  } catch (err: any) {
    message.error(err?.message || 'Failed to update table')
  } finally {
    isLoading.value = false
  }
}

// --- Fileset edit form (Gravitino-like) ---
const editFilesetOpen = ref(false)
const editFilesetOriginal = ref<any | null>(null)
const editFilesetName = ref('')
const editFilesetType = ref('Managed')
const editFilesetComment = ref('')
const editFilesetLocations = ref<Array<{ name: string; location: string }>>([{ name: '', location: '' }])
const editFilesetProps = ref<Array<{ key: string; value: string }>>([{ key: '', value: '' }])

const editFilesetPropsObject = computed(() => {
  const obj: Record<string, string> = {}
  for (const row of editFilesetProps.value) {
    const k = row.key?.trim()
    if (!k) continue
    obj[k] = row.value ?? ''
  }
  return obj
})

async function openFilesetEdit(metalake: string, catalog: string, schema: string, fileset: string) {
  try {
    isLoading.value = true
    const res = await api.getFileset(metalake, catalog, schema, fileset)
    const f = res?.fileset ?? res
    if (!f) {
      message.warning('No details loaded yet')
      return
    }
    editFilesetOriginal.value = f
    editFilesetName.value = f?.name ?? fileset
    editFilesetType.value = f?.type ?? 'Managed'
    editFilesetComment.value = f?.comment ?? ''
    editFilesetLocations.value = f?.storageLocations
      ? Object.entries(f.storageLocations).map(([name, location]) => ({ name, location: String(location) }))
      : [{ name: '', location: '' }]
    editFilesetProps.value = f?.properties
      ? Object.entries(f.properties).map(([key, value]) => ({ key, value: String(value) }))
      : [{ key: '', value: '' }]
    editFilesetOpen.value = true
  } catch {
    message.error('Failed to load fileset details')
  } finally {
    isLoading.value = false
  }
}

async function submitEditFileset() {
  const original = editFilesetOriginal.value
  const metalake = q.value.metalake
  const catalog = q.value.catalog
  const schema = q.value.schema
  if (!original || !metalake || !catalog || !schema) return

  const next = {
    name: editFilesetName.value.trim(),
    type: editFilesetType.value,
    comment: editFilesetComment.value,
    storageLocations: editFilesetLocations.value.reduce(
      (acc, loc) => {
        if (loc.name && loc.location) {
          acc[loc.name] = loc.location
        }
        return acc
      },
      {} as Record<string, string>
    ),
    properties: editFilesetPropsObject.value,
  }
  if (!next.name) {
    message.error('Name is required')
    return
  }

  try {
    isLoading.value = true
    const updates = genUpdates(original, next)
    await api.updateFileset(metalake, catalog, schema, original?.name ?? next.name, { updates })
    message.success('Fileset updated')
    editFilesetOpen.value = false
    await refreshSchemaContext(metalake, catalog, q.value.type!, schema)
    await loadEntitiesForSchema(metalake, catalog, q.value.type!, schema)
  } catch (err: any) {
    message.error(err?.message || 'Failed to update fileset')
  } finally {
    isLoading.value = false
  }
}

// --- Catalog edit form (Gravitino-like) ---
const editCatalogOpen = ref(false)
const editCatalogOriginal = ref<any | null>(null)
const editCatalogName = ref('')
const editCatalogComment = ref('')
const editCatalogProps = ref<Array<{ key: string; value: string; disabled?: boolean }>>([{ key: '', value: '' }])

async function openCatalogEdit(metalake: string, catalog: string) {
  try {
    isLoading.value = true
    const res = await api.getCatalog(metalake, catalog)
    const c = res?.catalog ?? res
    if (!c) {
      message.warning('No details loaded yet')
      return
    }
    catalogDetail.value = c
    editCatalogOriginal.value = c
    editCatalogName.value = c?.name ?? catalog
    editCatalogComment.value = c?.comment ?? ''
    editCatalogProps.value = propsObjectToRows(c?.properties)
    editCatalogOpen.value = true
  } catch {
    message.error('Failed to load catalog details')
  } finally {
    isLoading.value = false
  }
}

async function submitEditCatalog() {
  const original = editCatalogOriginal.value
  const metalake = q.value.metalake
  if (!original || !metalake) return

  const next = {
    name: editCatalogName.value.trim(),
    comment: editCatalogComment.value,
    properties: propsRowsToObject(editCatalogProps.value),
  }
  if (!next.name) {
    message.error('Name is required')
    return
  }

  try {
    isLoading.value = true
    const updates = genUpdates(original, next)
    await api.updateCatalog(metalake, original?.name ?? next.name, { updates })
    message.success('Catalog updated')
    editCatalogOpen.value = false
    await refreshMetalakeContext(metalake)
    // If renamed, keep user on the updated route
    if (original?.name && next.name && original.name !== next.name) {
      goToCatalog(metalake, next.name, q.value.type || original?.type || 'relational')
    } else if (q.value.catalog) {
      await refreshCatalogContext(metalake, q.value.catalog, q.value.type || original?.type || 'relational')
    }
  } catch (err: any) {
    message.error(err?.message || 'Failed to update catalog')
  } finally {
    isLoading.value = false
  }
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
          if (!metalake || !catalog || !schema || !q.value.model || !version)
            throw new Error('version context is required')
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
        catalogs.value = catalogs.value.filter(c => c.name !== catalog)
        goToMetalake(metalake)
        return
      case 'schema':
        if (!metalake || !catalog || !schema || !type) throw new Error('schema context is required')
        await api.deleteSchema(metalake, catalog, schema)
        message.success('Schema deleted')
        deleteOpen.value = false
        deleteContext.value = null
        await refreshCatalogContext(metalake, catalog, type)
        schemas.value = schemas.value.filter(s => s !== schema)
        // Force refresh left tree
        await loadSchemasForCatalog(metalake, catalog, type, true)
        goToCatalog(metalake, catalog, type)
        return
      case 'table':
        if (!metalake || !catalog || !schema || !entity || !type) throw new Error('table context is required')
        await api.deleteTable(metalake, catalog, schema, entity)
        message.success('Table deleted')
        deleteOpen.value = false
        deleteContext.value = null
        await refreshSchemaContext(metalake, catalog, type, schema)
        entities.value = entities.value.filter(e => getResourceName(e) !== entity)
        goToSchema(metalake, catalog, type, schema)
        return
      case 'fileset':
        if (!metalake || !catalog || !schema || !entity || !type) throw new Error('fileset context is required')
        await api.deleteFileset(metalake, catalog, schema, entity)
        message.success('Fileset deleted')
        deleteOpen.value = false
        deleteContext.value = null
        await refreshSchemaContext(metalake, catalog, type, schema)
        entities.value = entities.value.filter(e => getResourceName(e) !== entity)
        await loadEntitiesForSchema(metalake, catalog, type, schema)
        // Only navigate if currently viewing the deleted fileset
        if (selectedEntityName.value === entity) {
          goToSchema(metalake, catalog, type, schema)
        }
        return
      case 'topic':
        if (!metalake || !catalog || !schema || !entity || !type) throw new Error('topic context is required')
        await api.deleteTopic(metalake, catalog, schema, entity)
        message.success('Topic deleted')
        deleteOpen.value = false
        deleteContext.value = null
        await refreshSchemaContext(metalake, catalog, type, schema)
        entities.value = entities.value.filter(e => getResourceName(e) !== entity)
        goToSchema(metalake, catalog, type, schema)
        return
      case 'model':
        if (!metalake || !catalog || !schema || !entity || !type) throw new Error('model context is required')
        await api.deleteModel(metalake, catalog, schema, entity)
        message.success('Model deleted')
        deleteOpen.value = false
        deleteContext.value = null
        await refreshSchemaContext(metalake, catalog, type, schema)
        entities.value = entities.value.filter(e => getResourceName(e) !== entity)
        goToSchema(metalake, catalog, type, schema)
        return
      case 'version':
        if (!metalake || !catalog || !schema || !q.value.model || !version)
          throw new Error('version context is required')
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
      <div class="flex items-center gap-2">
        <Button
          v-if="currentLevel !== 'metalake-list'"
          variant="outline"
          size="sm"
          class="px-2 inline-flex items-center gap-2"
          @click="goToMetalakeList"
        >
          <Icon name="ri:arrow-left-line" class="size-4" />
          <span>Back Metalakes</span>
        </Button>
      </div>
      <template #description>
        <!-- intentionally empty: keep console header clean -->
      </template>
      <template #actions>
        <!-- Metalake page (Gravitino-like): keep header clean and focused -->
        <template v-if="q.metalake && !q.catalog">
          <Button variant="outline" class="inline-flex items-center gap-2" @click="openCreate('catalog')">
            <Icon name="ri:add-line" class="size-4" />
            <span>Create Catalog</span>
          </Button>
          <Button variant="outline" class="inline-flex items-center gap-2" @click="refreshAll">
            <Icon name="ri:refresh-line" class="size-4" />
            <span>Refresh</span>
          </Button>
        </template>

        <!-- Other levels keep existing actions (create/edit/delete + switches) -->
        <template v-else>
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
            v-if="q.schema && q.type && !selectedEntityName && currentEntityKind"
            variant="outline"
            class="inline-flex items-center gap-2"
            @click="openCreate(currentEntityKind)"
          >
            <Icon name="ri:add-line" class="size-4" />
            <span>Create {{ typeLabel(q.type) }}</span>
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
          <div v-if="metalakeDetail?.comment" class="p-4 border-b">
            <div class="text-xs text-muted-foreground truncate">
              {{ metalakeDetail.comment }}
            </div>
          </div>

          <ScrollArea class="h-[calc(100vh-260px)]">
            <div class="p-2">
              <div v-if="isLoading" class="p-3 text-sm text-muted-foreground">Loading…</div>

              <div v-else class="space-y-1">
                <div v-for="c in catalogs" :key="`${c.name}:${c.type}`" class="select-none">
                  <div
                    class="flex items-center gap-1 px-2 py-1 rounded-md"
                    :class="q.catalog === c.name && q.type === c.type ? 'bg-muted/50' : ''"
                  >
                    <button
                      class="p-1 rounded hover:bg-muted/40 cursor-pointer disabled:cursor-not-allowed"
                      :disabled="getResourceInUse(c) === false"
                      @click="toggleCatalogOpen(c.name, c.type)"
                    >
                      <Icon
                        :name="
                          openCatalogKeys[`${c.name}::${c.type}`] ? 'ri:arrow-down-s-line' : 'ri:arrow-right-s-line'
                        "
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
                    <div
                      v-if="treeLoading[`schemas:${c.name}::${c.type}`]"
                      class="px-3 py-1 text-sm text-muted-foreground"
                    >
                      Loading…
                    </div>
                    <div v-else>
                      <div v-for="s in treeSchemasByCatalogKey[`${c.name}::${c.type}`] || []" :key="s">
                        <div
                          class="flex items-center gap-1 px-2 py-1 rounded-md"
                          :class="q.schema === s && q.catalog === c.name ? 'bg-muted/50' : ''"
                        >
                          <button class="p-1 rounded hover:bg-muted/40" @click="toggleSchemaOpen(c.name, c.type, s)">
                            <Icon
                              :name="
                                openSchemaKeys[`${c.name}::${c.type}::${s}`]
                                  ? 'ri:arrow-down-s-line'
                                  : 'ri:arrow-right-s-line'
                              "
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
                          <div
                            v-if="treeLoading[`entities:${c.name}::${c.type}::${s}`]"
                            class="px-3 py-1 text-sm text-muted-foreground"
                          >
                            Loading…
                          </div>
                          <div v-else>
                            <button
                              v-for="e in treeEntitiesBySchemaKey[`${c.name}::${c.type}::${s}`] || []"
                              :key="e"
                              class="w-full flex items-center gap-2 px-3 py-2 rounded-md hover:bg-muted/40 transition cursor-pointer"
                              :class="
                                selectedEntityName === e && q.schema === s && q.catalog === c.name ? 'bg-muted/50' : ''
                              "
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
            <div class="min-w-0 flex items-center gap-1 flex-wrap">
              <template v-for="(item, index) in breadcrumbItems" :key="index">
                <button
                  class="text-sm text-primary hover:underline cursor-pointer"
                  @click="navigateToBreadcrumb(item.params)"
                >
                  {{ item.label }}
                </button>
                <span v-if="index < breadcrumbItems.length - 1" class="text-sm text-muted-foreground">/</span>
              </template>
            </div>
          </div>

          <Tabs v-model="rightTab" :default-value="rightTabsDefault">
            <TabsList class="w-full justify-start rounded-none bg-transparent p-0 border-b">
              <TabsTrigger
                value="list"
                class="rounded-none px-4 py-3 data-[state=active]:bg-transparent data-[state=active]:shadow-none border-b-2 border-transparent data-[state=active]:border-primary"
              >
                {{ listTabLabel }}
              </TabsTrigger>
              <TabsTrigger
                value="details"
                class="rounded-none px-4 py-3 data-[state=active]:bg-transparent data-[state=active]:shadow-none border-b-2 border-transparent data-[state=active]:border-primary"
              >
                Details
              </TabsTrigger>
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
                        <TableHead class="w-[120px]">In-use</TableHead>
                        <TableHead class="w-[180px] text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      <TableRow v-for="c in catalogs" :key="`${c.name}:${c.type}`">
                        <TableCell>
                          <div class="flex items-center gap-3">
                            <button
                              class="inline-flex items-center gap-2 min-w-0 rounded px-2 py-1 hover:bg-muted/40 transition cursor-pointer disabled:cursor-not-allowed"
                              :disabled="getResourceInUse(c) === false"
                              @click="goToCatalog(q.metalake || '', c.name, c.type)"
                            >
                              <Icon name="ri:folder-2-line" class="size-4 text-muted-foreground" />
                              <span class="font-medium truncate">{{ c.name }}</span>
                              <Badge variant="secondary" class="ml-1">{{ typeLabel(c.type) }}</Badge>
                            </button>
                          </div>
                        </TableCell>

                        <TableCell>
                          <Switch
                            :key="`list-catalog-${c.name}-${isResourceInUse(c)}`"
                            :checked="isResourceInUse(c) === true"
                            :disabled="isLoading"
                            @update:checked="(v: boolean) => toggleCatalogInUse(c.name, v)"
                          />
                        </TableCell>

                        <TableCell class="text-right">
                          <div class="inline-flex items-center justify-end gap-1">
                            <Button
                              variant="ghost"
                              size="icon-sm"
                              :disabled="getResourceInUse(c) === false"
                              @click="() => openCatalogEdit(q.metalake || '', c.name)"
                            >
                              <Icon name="ri:edit-line" class="size-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon-sm"
                              :disabled="getResourceInUse(c) === true"
                              @click="
                                () => {
                                  goToCatalog(q.metalake || '', c.name, c.type)
                                  openDelete('catalog', { metalake: q.metalake, catalog: c.name, type: c.type })
                                }
                              "
                            >
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
                          <Button
                            variant="ghost"
                            size="sm"
                            class="px-2"
                            @click="goToSchema(q.metalake || '', q.catalog || '', q.type || '', s)"
                          >
                            <span class="font-medium">{{ s }}</span>
                          </Button>
                        </TableCell>
                        <TableCell>
                          <div class="flex items-center gap-2">
                            <Button
                              variant="ghost"
                              size="sm"
                              @click="() => openSchemaEdit(q.metalake || '', q.catalog || '', s)"
                            >
                              <Icon name="ri:edit-line" class="size-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              @click="
                                () => {
                                  goToSchema(q.metalake || '', q.catalog || '', q.type || '', s)
                                  openDelete('schema')
                                }
                              "
                            >
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
                            <Button
                              variant="ghost"
                              size="sm"
                              @click="
                                () => {
                                  if (currentEntityKind === 'table')
                                    openTableEdit(q.metalake || '', q.catalog || '', q.schema || '', e)
                                  else if (currentEntityKind === 'fileset')
                                    openFilesetEdit(q.metalake || '', q.catalog || '', q.schema || '', e)
                                }
                              "
                            >
                              <Icon name="ri:edit-line" class="size-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              @click="
                                () => {
                                  goToEntity(q.metalake || '', q.catalog || '', q.type || '', q.schema || '', e)
                                  openDelete(currentEntityKind!)
                                }
                              "
                            >
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
                      <TableRow v-for="col in entityDetail?.columns || []" :key="col.name">
                        <TableCell class="font-medium">{{ col.name }}</TableCell>
                        <TableCell>
                          <Badge variant="secondary">{{ col.type || col.dataType || '—' }}</Badge>
                        </TableCell>
                        <TableCell class="text-sm text-muted-foreground">{{
                          String(col.nullable ?? col.isNullable ?? '—')
                        }}</TableCell>
                        <TableCell class="text-sm text-muted-foreground">{{
                          String(col.autoIncrement ?? col.isAutoIncrement ?? '—')
                        }}</TableCell>
                        <TableCell class="text-sm text-muted-foreground">{{
                          col.defaultValue ?? col.default ?? '—'
                        }}</TableCell>
                        <TableCell class="text-sm text-muted-foreground">{{ col.comment ?? '—' }}</TableCell>
                      </TableRow>
                    </TableBody>
                  </Table>
                </div>

                <!-- Entity level: for fileset show files -->
                <div v-else-if="currentLevel === 'entity' && q.type === 'fileset'" class="space-y-3">
                  <div class="flex items-center gap-1 flex-wrap">
                    <template v-for="(crumb, idx) in filesetBreadcrumbs" :key="crumb">
                      <button
                        class="text-sm text-primary hover:underline cursor-pointer"
                        @click="setFilesetPath(crumb)"
                      >
                        {{ idx === 0 ? 'Root' : crumb.split('/').pop() }}
                      </button>
                      <span v-if="idx < filesetBreadcrumbs.length - 1" class="text-sm text-muted-foreground">/</span>
                    </template>
                  </div>

                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Name</TableHead>
                        <TableHead>Type</TableHead>
                        <TableHead>Size</TableHead>
                        <TableHead>Last Modified</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      <TableRow v-if="filesetFilesLoading">
                        <TableCell colSpan="4" class="text-sm text-muted-foreground">Loading…</TableCell>
                      </TableRow>
                      <TableRow v-else-if="!filesetFiles.length">
                        <TableCell colSpan="4" class="text-sm text-muted-foreground text-center"
                          >No files found in this directory</TableCell
                        >
                      </TableRow>
                      <template v-else>
                        <TableRow
                          v-for="(file, idx) in filesetFiles"
                          :key="`${file?.name || ''}-${idx}`"
                          class="cursor-pointer"
                          @click="openFilesetFolder(file)"
                        >
                          <TableCell>
                            <div class="flex items-center gap-2">
                              <Icon
                                :name="file?.isDir ? 'ri:folder-2-line' : 'ri:file-2-line'"
                                class="size-4 text-muted-foreground"
                              />
                              <span class="truncate">{{ file?.name || '—' }}</span>
                            </div>
                          </TableCell>
                          <TableCell>
                            <Badge variant="secondary">{{ file?.isDir ? 'Directory' : 'File' }}</Badge>
                          </TableCell>
                          <TableCell class="text-sm text-muted-foreground">
                            {{ file?.isDir ? '—' : formatFileSize(file?.size) }}
                          </TableCell>
                          <TableCell class="text-sm text-muted-foreground">
                            {{ formatFileTime(file?.lastModified) }}
                          </TableCell>
                        </TableRow>
                      </template>
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
                            @click="
                              goToModelVersion(
                                q.metalake || '',
                                q.catalog || '',
                                q.schema || '',
                                q.model || '',
                                String(v)
                              )
                            "
                          >
                            <span class="font-medium">{{ String(v) }}</span>
                          </Button>
                        </TableCell>
                        <TableCell>
                          <div class="flex items-center gap-2">
                            <Button
                              variant="ghost"
                              size="sm"
                              @click="
                                () => {
                                  goToModelVersion(
                                    q.metalake || '',
                                    q.catalog || '',
                                    q.schema || '',
                                    q.model || '',
                                    String(v)
                                  )
                                  openEdit('version')
                                }
                              "
                            >
                              <Icon name="ri:edit-line" class="size-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              @click="
                                () => {
                                  goToModelVersion(
                                    q.metalake || '',
                                    q.catalog || '',
                                    q.schema || '',
                                    q.model || '',
                                    String(v)
                                  )
                                  openDelete('version')
                                }
                              "
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
              <div v-if="detailsRows.length === 0" class="text-sm text-muted-foreground">No details loaded</div>
              <div v-else class="space-y-6">
                <!-- Type and Provider in first row -->
                <div class="grid grid-cols-2 gap-6">
                  <div v-if="detailsTarget?.type" class="col-span-1">
                    <div class="text-sm text-muted-foreground font-medium mb-2">Type</div>
                    <div class="text-sm text-foreground">{{ detailsTarget.type }}</div>
                  </div>
                  <div v-if="detailsTarget?.provider" class="col-span-1">
                    <div class="text-sm text-muted-foreground font-medium mb-2">Provider</div>
                    <div class="text-sm text-foreground">{{ detailsTarget.provider }}</div>
                  </div>
                </div>

                <!-- Storage Location(s) for fileset -->
                <div v-if="q.type === 'fileset' && detailsTarget?.storageLocation" class="col-span-1">
                  <div class="text-sm text-muted-foreground font-medium mb-2">Storage location</div>
                  <div class="text-sm text-foreground break-words">{{ detailsTarget?.storageLocation }}</div>
                </div>

                <div v-if="q.type === 'fileset' && detailsTarget?.storageLocations" class="col-span-1">
                  <div class="text-sm text-muted-foreground font-medium mb-2">Storage Location(s)</div>
                  <div class="border rounded-md overflow-hidden">
                    <Table class="text-xs">
                      <TableHeader class="bg-muted">
                        <TableRow class="border-b">
                          <TableHead class="py-2 px-3 text-left font-medium">Name</TableHead>
                          <TableHead class="py-2 px-3 text-left font-medium">Location</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        <TableRow
                          v-for="([name, location], idx) in Object.entries(detailsTarget?.storageLocations || {})"
                          :key="`${name}-${idx}`"
                          class="border-b last:border-0 hover:bg-muted/50"
                        >
                          <TableCell class="py-2 px-3 font-mono text-xs truncate max-w-xs" :title="String(name)">{{
                            String(name)
                          }}</TableCell>
                          <TableCell class="py-2 px-3 font-mono text-xs truncate max-w-sm" :title="String(location)">{{
                            String(location)
                          }}</TableCell>
                        </TableRow>
                      </TableBody>
                    </Table>
                  </div>
                </div>

                <!-- Comment full width -->
                <div class="col-span-1">
                  <div class="text-sm text-muted-foreground font-medium mb-2">Comment</div>
                  <div class="text-sm text-foreground break-words">
                    {{ pickFirstString(detailsTarget?.comment) || 'N/A' }}
                  </div>
                </div>

                <!-- Created and Last Modified info -->
                <div class="grid grid-cols-2 gap-6">
                  <div class="col-span-1">
                    <div class="text-sm text-muted-foreground font-medium mb-2">Created by</div>
                    <div class="text-sm text-foreground">{{ getCreatedBy(detailsTarget) || 'N/A' }}</div>
                  </div>
                  <div class="col-span-1">
                    <div class="text-sm text-muted-foreground font-medium mb-2">Created at</div>
                    <div class="text-sm text-foreground">{{ getCreatedAt(detailsTarget) || 'N/A' }}</div>
                  </div>
                </div>

                <div class="grid grid-cols-2 gap-6">
                  <div class="col-span-1">
                    <div class="text-sm text-muted-foreground font-medium mb-2">Last modified by</div>
                    <div class="text-sm text-foreground">{{ getLastModifiedBy(detailsTarget) || 'N/A' }}</div>
                  </div>
                  <div class="col-span-1">
                    <div class="text-sm text-muted-foreground font-medium mb-2">Last modified at</div>
                    <div class="text-sm text-foreground">{{ getLastModifiedAt(detailsTarget) || 'N/A' }}</div>
                  </div>
                </div>

                <!-- Properties Section (full width, always show) -->
                <div class="col-span-1">
                  <div class="text-sm text-muted-foreground font-medium mb-2">Properties</div>
                  <div class="border rounded-md overflow-hidden">
                    <Table class="text-xs">
                      <TableHeader class="bg-muted">
                        <TableRow class="border-b">
                          <TableHead class="py-2 px-3 text-left font-medium">Key</TableHead>
                          <TableHead class="py-2 px-3 text-left font-medium">Value</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        <TableRow
                          v-for="[key, value] in Object.entries(detailsTarget?.properties || {})"
                          :key="key"
                          class="border-b last:border-0 hover:bg-muted/50"
                        >
                          <TableCell class="py-2 px-3 font-mono text-xs truncate max-w-xs" :title="key">{{
                            key
                          }}</TableCell>
                          <TableCell class="py-2 px-3 font-mono text-xs truncate max-w-sm" :title="String(value)">{{
                            String(value)
                          }}</TableCell>
                        </TableRow>
                      </TableBody>
                    </Table>
                  </div>
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
              <Button variant="outline" size="sm" class="inline-flex items-center gap-2" @click="addMetalakePropRow">
                <Icon name="ri:add-line" class="size-4" />
                <span>Add Property</span>
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
          <Button :disabled="isLoading" @click="submitCreateMetalake">Create</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>

    <!-- Create Catalog (Gravitino-style structured form with dynamic providers) -->
    <Dialog v-model:open="createCatalogOpen">
      <DialogContent class="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Create Catalog</DialogTitle>
        </DialogHeader>

        <div class="space-y-4">
          <div class="space-y-2">
            <div class="text-sm font-medium">Name <span class="text-red-500">*</span></div>
            <Input
              v-model="createCatalogName"
              placeholder="Name"
              :class="{ 'border-red-500': !createCatalogName.trim() }"
            />
          </div>

          <div class="space-y-2">
            <div class="text-sm font-medium">Type <span class="text-red-500">*</span></div>
            <select
              v-model="createCatalogType"
              class="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            >
              <option value="relational">Relational</option>
              <option value="fileset">Fileset</option>
              <option value="messaging">Messaging</option>
              <option value="model">Model</option>
            </select>
          </div>

          <!-- Provider selection only for relational and messaging -->
          <div v-if="showProviderSelect" class="space-y-2">
            <div class="text-sm font-medium">Provider <span class="text-red-500">*</span></div>
            <select
              v-model="createCatalogProvider"
              class="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              :class="{ 'border-red-500': !createCatalogProvider }"
            >
              <option v-for="p in availableProviders" :key="p.value" :value="p.value">
                {{ p.label }}
              </option>
            </select>
          </div>

          <div class="space-y-2">
            <div class="text-sm font-medium">Comment</div>
            <Textarea v-model="createCatalogComment" placeholder="Comment" />
          </div>

          <!-- Properties section -->
          <div class="space-y-3">
            <div class="flex items-center justify-between gap-2">
              <div class="text-sm font-medium">Properties</div>
              <Button variant="outline" size="sm" class="inline-flex items-center gap-2" @click="addCatalogPropRow">
                <Icon name="ri:add-line" class="size-4" />
                <span>Add Property</span>
              </Button>
            </div>

            <!-- Provider-specific properties -->
            <template v-for="(prop, idx) in createCatalogProps" :key="idx">
              <div v-if="!shouldHideProp(prop)" class="space-y-1">
                <div class="flex items-center gap-2">
                  <!-- Key field (disabled for required props) -->
                  <Input
                    v-model="prop.key"
                    :disabled="prop.required"
                    placeholder="Key"
                    class="flex-1"
                    :class="{ 'border-red-500': !prop.key?.trim() }"
                  />

                  <!-- Value field: select or input -->
                  <template v-if="prop.select && prop.select.length > 0">
                    <select
                      v-model="prop.value"
                      class="flex h-10 flex-1 rounded-md border border-input bg-background px-3 py-2 text-sm"
                      :class="{ 'border-red-500': prop.required && !prop.value?.trim() }"
                    >
                      <option v-for="opt in prop.select" :key="opt" :value="opt">{{ opt }}</option>
                    </select>
                  </template>
                  <template v-else>
                    <Input
                      v-model="prop.value"
                      :placeholder="prop.required ? 'Required' : 'Value'"
                      :type="prop.key === 'jdbc-password' ? 'password' : 'text'"
                      class="flex-1"
                      :class="{ 'border-red-500': prop.required && !prop.value?.trim() }"
                    />
                  </template>

                  <!-- Remove button for non-required props -->
                  <Button v-if="!prop.required" variant="ghost" size="sm" @click="removeCatalogPropRow(idx)">
                    <Icon name="ri:delete-bin-5-line" class="size-4" />
                  </Button>
                  <div v-else class="w-8" />
                </div>

                <!-- Description text (red if required and empty) -->
                <div
                  v-if="prop.description"
                  class="text-xs pl-1"
                  :class="prop.required && !prop.value?.trim() ? 'text-red-500' : 'text-muted-foreground'"
                >
                  {{ prop.description }}
                </div>
              </div>
            </template>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" @click="createCatalogOpen = false">Cancel</Button>
          <Button :disabled="isLoading || !isCatalogFormValid" @click="submitCreateCatalog">Create</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>

    <!-- Create Schema (Gravitino-style structured form) -->
    <Dialog v-model:open="createSchemaOpen">
      <DialogContent class="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Create Schema</DialogTitle>
        </DialogHeader>

        <div class="space-y-4">
          <div class="space-y-2">
            <div class="text-sm font-medium">Name</div>
            <Input v-model="createSchemaName" placeholder="Name" />
          </div>

          <div class="space-y-2">
            <div class="text-sm font-medium">Comment</div>
            <Textarea v-model="createSchemaComment" placeholder="Comment" />
          </div>

          <div class="space-y-2">
            <div class="flex items-center justify-between gap-2">
              <div class="text-sm font-medium">Properties</div>
              <Button variant="outline" size="sm" class="inline-flex items-center gap-2" @click="addSchemaPropRow">
                <Icon name="ri:add-line" class="size-4" />
                <span>Add Property</span>
              </Button>
            </div>
            <div class="space-y-2">
              <div v-for="(row, idx) in createSchemaProps" :key="idx" class="grid grid-cols-[1fr_1fr_auto] gap-2">
                <Input v-model="row.key" placeholder="Key" />
                <Input v-model="row.value" placeholder="Value" />
                <Button
                  variant="ghost"
                  size="sm"
                  :disabled="createSchemaProps.length <= 1"
                  @click="removeSchemaPropRow(idx)"
                >
                  <Icon name="ri:delete-bin-5-line" class="size-4" />
                </Button>
              </div>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" @click="createSchemaOpen = false">CANCEL</Button>
          <Button :disabled="isLoading" @click="submitCreateSchema">CREATE</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>

    <!-- Create Table (Gravitino-style structured form) -->
    <Dialog v-model:open="createTableOpen">
      <DialogContent class="sm:max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Create Table</DialogTitle>
        </DialogHeader>

        <div class="space-y-4">
          <div class="space-y-2">
            <div class="text-sm font-medium">Name</div>
            <Input v-model="createTableName" placeholder="Name" />
          </div>

          <div class="space-y-2">
            <div class="text-sm font-medium">Comment</div>
            <Textarea v-model="createTableComment" placeholder="Comment" />
          </div>

          <div class="space-y-2">
            <div class="text-sm font-medium">Columns</div>
            <div class="space-y-2">
              <div v-for="(col, idx) in createTableColumns" :key="idx" class="space-y-2">
                <div class="grid grid-cols-[2fr_2fr_1fr_2fr_auto] gap-2 items-start">
                  <div>
                    <Input v-model="col.name" placeholder="Name" :class="{ 'border-red-500': !col.name.trim() }" />
                    <div v-if="!col.name.trim()" class="text-xs text-red-500 mt-1">Name is required</div>
                  </div>
                  <div>
                    <select
                      v-model="col.type"
                      class="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                      :class="{ 'border-red-500': !col.type }"
                    >
                      <option value="">Type</option>
                      <option
                        v-for="t in getColumnTypesForProvider(catalogs.find(c => c.name === q.catalog)?.provider)"
                        :key="t"
                        :value="t"
                      >
                        {{ t }}
                      </option>
                    </select>
                    <div v-if="!col.type" class="text-xs text-red-500 mt-1">Type is required</div>
                  </div>
                  <div class="flex items-center gap-2 h-10">
                    <input type="checkbox" v-model="col.nullable" class="size-4" />
                    <span class="text-sm">Nullable</span>
                  </div>
                  <Input v-model="col.comment" placeholder="Comment" />
                  <Button
                    variant="ghost"
                    size="sm"
                    @click="removeTableColumn(idx)"
                    :disabled="createTableColumns.length <= 1"
                  >
                    <Icon name="ri:delete-bin-5-line" class="size-4" />
                  </Button>
                </div>
              </div>
            </div>
            <Button variant="outline" size="sm" class="inline-flex items-center gap-2" @click="addTableColumn">
              <Icon name="ri:add-line" class="size-4" />
              <span>Add Column</span>
            </Button>
          </div>

          <div class="space-y-2">
            <div class="flex items-center justify-between gap-2">
              <div class="text-sm font-medium">Properties</div>
              <Button variant="outline" size="sm" class="inline-flex items-center gap-2" @click="addTablePropRow">
                <Icon name="ri:add-line" class="size-4" />
                <span>Add Property</span>
              </Button>
            </div>
            <div class="space-y-2">
              <div v-for="(row, idx) in createTableProps" :key="idx" class="space-y-1">
                <div class="grid grid-cols-[1fr_1fr_auto] gap-2">
                  <Input
                    v-model="row.key"
                    placeholder="Key"
                    :disabled="
                      row.disabled ||
                      getTablePropInfo(catalogs.find(c => c.name === q.catalog)?.provider).immutable.includes(row.key)
                    "
                  />
                  <Input
                    v-model="row.value"
                    placeholder="Value"
                    :class="{ 'border-red-500': row.required && !row.value }"
                    :disabled="row.disabled"
                  />
                  <Button
                    variant="ghost"
                    size="sm"
                    :disabled="createTableProps.length <= 1 || row.disabled"
                    @click="removeTablePropRow(idx)"
                  >
                    <Icon name="ri:delete-bin-5-line" class="size-4" />
                  </Button>
                </div>
                <div
                  v-if="row.description"
                  class="text-xs"
                  :class="row.required && !row.value ? 'text-red-500' : 'text-muted-foreground'"
                >
                  {{ row.description }} {{ row.required && !row.value ? '(Required)' : '' }}
                </div>
              </div>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" @click="createTableOpen = false">Cancel</Button>
          <Button :disabled="isLoading" @click="submitCreateTable">Create</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>

    <!-- Create Fileset (Gravitino-style structured form) -->
    <Dialog v-model:open="createFilesetOpen">
      <DialogContent class="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Create Fileset</DialogTitle>
        </DialogHeader>

        <div class="space-y-4">
          <div class="space-y-2">
            <div class="text-sm font-medium">Name</div>
            <Input v-model="createFilesetName" placeholder="Name" />
          </div>

          <div class="space-y-2">
            <div class="text-sm font-medium">Type</div>
            <select
              v-model="createFilesetType"
              class="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            >
              <option value="Managed">Managed</option>
              <option value="External">External</option>
            </select>
          </div>

          <div class="space-y-2">
            <div class="text-sm font-medium">Storage Locations</div>
            <div class="space-y-2">
              <div v-for="(loc, idx) in createFilesetLocations" :key="idx" class="grid grid-cols-[1fr_1fr] gap-2">
                <Input v-model="loc.name" placeholder="Name 1" />
                <Input v-model="loc.location" placeholder="Location 1" />
              </div>
            </div>
            <div class="text-xs text-muted-foreground">
              It is optional if the fileset is 'Managed' type and a storage location is already specified at the parent
              catalog or schema level.
            </div>
            <div class="text-xs text-muted-foreground">
              It becomes mandatory if the fileset type is 'External' or no storage location is defined at the parent
              level.
            </div>
          </div>

          <div class="space-y-2">
            <div class="text-sm font-medium">Comment</div>
            <Textarea v-model="createFilesetComment" placeholder="Comment" />
          </div>

          <div class="space-y-2">
            <div class="flex items-center justify-between gap-2">
              <div class="text-sm font-medium">Properties</div>
              <Button variant="outline" size="sm" class="inline-flex items-center gap-2" @click="addFilesetPropRow">
                <Icon name="ri:add-line" class="size-4" />
                <span>Add Property</span>
              </Button>
            </div>
            <div class="space-y-2">
              <div v-for="(row, idx) in createFilesetProps" :key="idx" class="grid grid-cols-[1fr_1fr_auto] gap-2">
                <Input v-model="row.key" placeholder="Key" />
                <Input v-model="row.value" placeholder="Value" />
                <Button
                  variant="ghost"
                  size="sm"
                  :disabled="createFilesetProps.length <= 1"
                  @click="removeFilesetPropRow(idx)"
                >
                  <Icon name="ri:delete-bin-5-line" class="size-4" />
                </Button>
              </div>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" @click="createFilesetOpen = false">CANCEL</Button>
          <Button :disabled="isLoading" @click="submitCreateFileset">CREATE</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>

    <!-- Edit Schema (structured form, Gravitino-like) -->
    <Dialog v-model:open="editSchemaOpen">
      <DialogContent class="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Edit Schema</DialogTitle>
          <DialogDescription>Update schema metadata and properties.</DialogDescription>
        </DialogHeader>

        <div class="space-y-4">
          <div class="space-y-2">
            <div class="text-sm font-medium">Name</div>
            <Input v-model="editSchemaName" placeholder="schema_name" disabled />
          </div>

          <div class="space-y-2">
            <div class="text-sm font-medium">Comment</div>
            <Textarea v-model="editSchemaComment" placeholder="Optional comment" />
          </div>

          <div class="space-y-2">
            <div class="flex items-center justify-between gap-2">
              <div class="text-sm font-medium">Properties</div>
              <Button
                variant="outline"
                size="sm"
                class="inline-flex items-center gap-2"
                @click="() => (editSchemaProps = [...editSchemaProps, { key: '', value: '' }])"
              >
                <Icon name="ri:add-line" class="size-4" />
                <span>Add Property</span>
              </Button>
            </div>

            <div class="space-y-2">
              <div v-for="(row, idx) in editSchemaProps" :key="idx" class="grid grid-cols-[1fr_1fr_auto] gap-2">
                <Input v-model="row.key" placeholder="Key" />
                <Input v-model="row.value" placeholder="Value" />
                <Button
                  variant="ghost"
                  size="sm"
                  class="justify-self-start"
                  :disabled="editSchemaProps.length <= 1"
                  @click="() => (editSchemaProps = editSchemaProps.filter((_, i) => i !== idx))"
                >
                  <Icon name="ri:delete-bin-5-line" class="size-4" />
                </Button>
              </div>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" @click="editSchemaOpen = false">Cancel</Button>
          <Button :disabled="isLoading" class="inline-flex items-center gap-2" @click="submitEditSchema">
            <Icon name="ri:save-3-line" class="size-4" />
            <span>Update</span>
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>

    <!-- Edit Table (structured form, Gravitino-like) -->
    <Dialog v-model:open="editTableOpen">
      <DialogContent class="sm:max-w-4xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Edit Table</DialogTitle>
          <DialogDescription>Update table metadata and properties.</DialogDescription>
        </DialogHeader>

        <div class="space-y-4">
          <div class="space-y-2">
            <div class="text-sm font-medium">Name</div>
            <Input v-model="editTableName" placeholder="table_name" disabled />
          </div>

          <div class="space-y-2">
            <div class="text-sm font-medium">Comment</div>
            <Textarea v-model="editTableComment" placeholder="Optional comment" />
          </div>

          <div class="space-y-2">
            <div class="text-sm font-medium">Columns (Read-only)</div>
            <div class="border rounded-md">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Nullable</TableHead>
                    <TableHead>Comment</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  <TableRow v-for="(col, idx) in editTableColumns" :key="idx">
                    <TableCell>{{ col.name }}</TableCell>
                    <TableCell>{{ col.type }}</TableCell>
                    <TableCell>{{ col.nullable ? 'Yes' : 'No' }}</TableCell>
                    <TableCell>{{ col.comment }}</TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </div>
            <p class="text-xs text-muted-foreground">Column structure cannot be modified through this dialog</p>
          </div>

          <div class="space-y-2">
            <div class="flex items-center justify-between gap-2">
              <div class="text-sm font-medium">Properties</div>
              <Button
                variant="outline"
                size="sm"
                class="inline-flex items-center gap-2"
                @click="() => (editTableProps = [...editTableProps, { key: '', value: '' }])"
              >
                <Icon name="ri:add-line" class="size-4" />
                <span>Add Property</span>
              </Button>
            </div>

            <div class="space-y-2">
              <div v-for="(row, idx) in editTableProps" :key="idx" class="grid grid-cols-[1fr_1fr_auto] gap-2">
                <Input v-model="row.key" placeholder="Key" />
                <Input v-model="row.value" placeholder="Value" />
                <Button
                  variant="ghost"
                  size="sm"
                  class="justify-self-start"
                  :disabled="editTableProps.length <= 1"
                  @click="() => (editTableProps = editTableProps.filter((_, i) => i !== idx))"
                >
                  <Icon name="ri:delete-bin-5-line" class="size-4" />
                </Button>
              </div>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" @click="editTableOpen = false">Cancel</Button>
          <Button :disabled="isLoading" class="inline-flex items-center gap-2" @click="submitEditTable">
            <Icon name="ri:save-3-line" class="size-4" />
            <span>Update</span>
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>

    <!-- Edit Fileset (structured form, Gravitino-like) -->
    <Dialog v-model:open="editFilesetOpen">
      <DialogContent class="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Edit Fileset</DialogTitle>
          <DialogDescription>Update fileset metadata and properties.</DialogDescription>
        </DialogHeader>

        <div class="space-y-4">
          <div class="space-y-2">
            <div class="text-sm font-medium">Name</div>
            <Input v-model="editFilesetName" placeholder="fileset_name" disabled />
          </div>

          <div class="space-y-2">
            <div class="text-sm font-medium">Type</div>
            <Input v-model="editFilesetType" placeholder="Type" disabled />
          </div>

          <div class="space-y-2">
            <div class="text-sm font-medium">Storage Locations</div>
            <div class="space-y-2">
              <div v-for="(loc, idx) in editFilesetLocations" :key="idx" class="grid grid-cols-[1fr_1fr] gap-2">
                <Input v-model="loc.name" placeholder="Name" />
                <Input v-model="loc.location" placeholder="Location" />
              </div>
            </div>
          </div>

          <div class="space-y-2">
            <div class="text-sm font-medium">Comment</div>
            <Textarea v-model="editFilesetComment" placeholder="Optional comment" />
          </div>

          <div class="space-y-2">
            <div class="flex items-center justify-between gap-2">
              <div class="text-sm font-medium">Properties</div>
              <Button
                variant="outline"
                size="sm"
                class="inline-flex items-center gap-2"
                @click="() => (editFilesetProps = [...editFilesetProps, { key: '', value: '' }])"
              >
                <Icon name="ri:add-line" class="size-4" />
                <span>Add Property</span>
              </Button>
            </div>

            <div class="space-y-2">
              <div v-for="(row, idx) in editFilesetProps" :key="idx" class="grid grid-cols-[1fr_1fr_auto] gap-2">
                <Input v-model="row.key" placeholder="Key" />
                <Input v-model="row.value" placeholder="Value" />
                <Button
                  variant="ghost"
                  size="sm"
                  class="justify-self-start"
                  :disabled="editFilesetProps.length <= 1"
                  @click="() => (editFilesetProps = editFilesetProps.filter((_, i) => i !== idx))"
                >
                  <Icon name="ri:delete-bin-5-line" class="size-4" />
                </Button>
              </div>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" @click="editFilesetOpen = false">Cancel</Button>
          <Button :disabled="isLoading" class="inline-flex items-center gap-2" @click="submitEditFileset">
            <Icon name="ri:save-3-line" class="size-4" />
            <span>Update</span>
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>

    <!-- Edit Catalog (structured form, Gravitino-like) -->
    <Dialog v-model:open="editCatalogOpen">
      <DialogContent class="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Edit Catalog</DialogTitle>
          <DialogDescription>Update catalog metadata and properties.</DialogDescription>
        </DialogHeader>

        <div class="space-y-4">
          <div class="space-y-2">
            <div class="text-sm font-medium">Name</div>
            <Input v-model="editCatalogName" placeholder="catalog_name" />
          </div>

          <div class="space-y-2">
            <div class="text-sm font-medium">Comment</div>
            <Textarea v-model="editCatalogComment" placeholder="Optional description" />
          </div>

          <div class="space-y-2">
            <div class="flex items-center justify-between gap-2">
              <div class="text-sm font-medium">Properties</div>
              <Button
                variant="outline"
                size="sm"
                class="inline-flex items-center gap-2"
                @click="() => (editCatalogProps = [...editCatalogProps, { key: '', value: '' }])"
              >
                <Icon name="ri:add-line" class="size-4" />
                <span>Add Property</span>
              </Button>
            </div>

            <div class="space-y-2">
              <div
                v-for="(row, idx) in editCatalogProps"
                :key="idx"
                class="grid grid-cols-1 md:grid-cols-[1fr_1fr_auto] gap-2"
              >
                <Input v-model="row.key" placeholder="Key" :disabled="row.key === 'in-use' || row.disabled" />
                <Input v-model="row.value" placeholder="Value" :disabled="row.key === 'in-use' || row.disabled" />
                <Button
                  variant="ghost"
                  size="sm"
                  class="justify-self-start"
                  :disabled="editCatalogProps.length <= 1 || row.key === 'in-use' || row.disabled"
                  @click="() => (editCatalogProps = editCatalogProps.filter((_, i) => i !== idx))"
                >
                  <Icon name="ri:delete-bin-5-line" class="size-4" />
                </Button>
              </div>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" @click="editCatalogOpen = false">Cancel</Button>
          <Button :disabled="isLoading" class="inline-flex items-center gap-2" @click="submitEditCatalog">
            <Icon name="ri:save-3-line" class="size-4" />
            <span>Update</span>
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>

    <!-- Edit Metalake Dialog -->
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
          <p class="text-xs text-muted-foreground">Tip: Use the format button to pretty-print JSON.</p>
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
          <AlertDialogDescription> This operation cannot be undone. </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction @click="confirmDelete">Delete</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  </Page>
</template>
