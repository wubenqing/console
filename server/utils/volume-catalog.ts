import { createError } from 'h3'
import { Pool, type FieldDef, type QueryResult } from 'pg'

export interface VolumeCatalogColumn {
  name: string
  dataType: string
  isNullable: boolean
}

export interface VolumeCatalogCondition {
  column: string
  operator: string
  value?: string | string[] | number | null
  relation?: 'AND' | 'OR'
}

interface VolumeCatalogConfig {
  host: string
  port: number
  user: string
  password: string
  database: string
  schema: string
  table: string
}

interface ColumnCache {
  schema: string
  table: string
  fetchedAt: number
  columns: VolumeCatalogColumn[]
}

const IDENTIFIER_REGEX = /^[a-zA-Z_][a-zA-Z0-9_]*$/
const COLUMN_CACHE_TTL = 5 * 60 * 1000

const assertIdentifier = (value: string, label: string) => {
  if (!IDENTIFIER_REGEX.test(value)) {
    throw createError({
      statusCode: 400,
      statusMessage: `Invalid ${label}: ${value}`,
    })
  }
}

export const getVolumeCatalogConfig = (): VolumeCatalogConfig => {
  const config = useRuntimeConfig().volumeCatalog as VolumeCatalogConfig

  if (!config?.host || !config?.user || !config?.database || !config?.table) {
    throw createError({
      statusCode: 500,
      statusMessage: 'Volume Catalog database configuration is missing.',
    })
  }

  const schema = config.schema || 'public'

  assertIdentifier(schema, 'schema')
  assertIdentifier(config.table, 'table')

  return {
    ...config,
    schema,
  }
}

export const getVolumeCatalogPool = (): Pool => {
  const poolKey = '__volumeCatalogPool__'
  const globalAny = globalThis as typeof globalThis & {
    [poolKey]?: Pool
  }

  if (!globalAny[poolKey]) {
    const config = getVolumeCatalogConfig()
    globalAny[poolKey] = new Pool({
      host: config.host,
      port: config.port,
      user: config.user,
      password: config.password,
      database: config.database,
    })
  }

  return globalAny[poolKey]
}

const getColumnCache = (): ColumnCache | undefined => {
  const cacheKey = '__volumeCatalogColumnCache__'
  const globalAny = globalThis as typeof globalThis & {
    [cacheKey]?: ColumnCache
  }

  return globalAny[cacheKey]
}

const setColumnCache = (cache: ColumnCache) => {
  const cacheKey = '__volumeCatalogColumnCache__'
  const globalAny = globalThis as typeof globalThis & {
    [cacheKey]?: ColumnCache
  }

  globalAny[cacheKey] = cache
}

export const getVolumeCatalogColumns = async (): Promise<VolumeCatalogColumn[]> => {
  const config = getVolumeCatalogConfig()
  const cached = getColumnCache()

  if (
    cached &&
    cached.schema === config.schema &&
    cached.table === config.table &&
    Date.now() - cached.fetchedAt < COLUMN_CACHE_TTL
  ) {
    return cached.columns
  }

  const pool = getVolumeCatalogPool()

  const result = await pool.query(
    `
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns
      WHERE table_schema = $1 AND table_name = $2
      ORDER BY ordinal_position
    `,
    [config.schema, config.table]
  )

  const columns: VolumeCatalogColumn[] = result.rows.map((row: any) => ({
    name: row.column_name as string,
    dataType: row.data_type as string,
    isNullable: (row.is_nullable as string) === 'YES',
  }))

  setColumnCache({
    schema: config.schema,
    table: config.table,
    fetchedAt: Date.now(),
    columns,
  })

  return columns
}
