import { createError, readBody } from 'h3'
import { type FieldDef } from 'pg'
import { getVolumeCatalogColumns, getVolumeCatalogConfig, getVolumeCatalogPool } from '@/server/utils/volume-catalog'

const ALLOWED_OPERATORS = new Set(['=', '!=', '<', '<=', '>', '>=', 'LIKE', 'ILIKE', 'IN', 'IS NULL', 'IS NOT NULL'])

const isEmpty = (value: unknown): boolean => value === undefined || value === null || value === ''

export default defineEventHandler(async event => {
  const body = await readBody(event)
  const conditions = Array.isArray(body?.conditions) ? body.conditions : []
  const limitInput = Number(body?.limit ?? 200)
  const limit = Number.isFinite(limitInput) ? Math.min(Math.max(limitInput, 1), 1000) : 200
  const offsetInput = Number(body?.offset ?? 0)
  const offset = Number.isFinite(offsetInput) ? Math.max(offsetInput, 0) : 0

  const config = getVolumeCatalogConfig()
  const columns = await getVolumeCatalogColumns()
  const allowedColumns = new Set(columns.map(column => column.name))

  const whereParts: string[] = []
  const values: Array<string | number> = []

  for (let index = 0; index < conditions.length; index += 1) {
    const condition = conditions[index] ?? {}
    const column = String(condition.column || '').trim()

    if (!column || !allowedColumns.has(column)) {
      throw createError({
        statusCode: 400,
        statusMessage: `Invalid column name: ${column || 'unknown'}`,
      })
    }

    const operator = String(condition.operator || '')
      .toUpperCase()
      .trim()
    if (!ALLOWED_OPERATORS.has(operator)) {
      throw createError({
        statusCode: 400,
        statusMessage: `Invalid operator: ${operator || 'unknown'}`,
      })
    }

    const relation = String(condition.relation || 'AND').toUpperCase() === 'OR' ? 'OR' : 'AND'

    if (index > 0) {
      whereParts.push(relation)
    }

    const columnSql = `"${column}"`

    if (operator === 'IS NULL' || operator === 'IS NOT NULL') {
      whereParts.push(`${columnSql} ${operator}`)
      continue
    }

    if (operator === 'IN') {
      const rawValue = condition.value
      const list = Array.isArray(rawValue)
        ? rawValue
        : typeof rawValue === 'string'
          ? rawValue
              .split(',')
              .map((item: string) => item.trim())
              .filter(Boolean)
          : !isEmpty(rawValue)
            ? [rawValue]
            : []

      if (!list.length) {
        throw createError({
          statusCode: 400,
          statusMessage: `IN operator requires a non-empty value list for ${column}.`,
        })
      }

      const placeholders = list.map(value => {
        values.push(value)
        return `$${values.length}`
      })

      whereParts.push(`${columnSql} IN (${placeholders.join(', ')})`)
      continue
    }

    if (isEmpty(condition.value)) {
      throw createError({
        statusCode: 400,
        statusMessage: `Value is required for ${column} ${operator}.`,
      })
    }

    values.push(condition.value)
    whereParts.push(`${columnSql} ${operator} $${values.length}`)
  }

  const whereClause = whereParts.length ? `WHERE ${whereParts.join(' ')}` : ''

  const pool = getVolumeCatalogPool()

  const countSql = `
    SELECT COUNT(*) as total
    FROM "${config.schema}"."${config.table}"
    ${whereClause}
  `
  const countResult = await pool.query(countSql, values)
  const totalRaw = countResult.rows?.[0]?.total
  const totalParsed = Number(totalRaw)
  const total = Number.isFinite(totalParsed) && totalParsed >= 0 ? totalParsed : 0

  let orderByClause = ''
  if (body?.sort?.column && allowedColumns.has(body.sort.column)) {
    const direction = String(body.sort.direction).toUpperCase() === 'DESC' ? 'DESC' : 'ASC'
    orderByClause = `ORDER BY "${body.sort.column}" ${direction}`
  }

  values.push(limit)
  values.push(offset)

  const sql = `
    SELECT *
    FROM "${config.schema}"."${config.table}"
    ${whereClause}
    ${orderByClause}
    LIMIT $${values.length - 1} OFFSET $${values.length}
  `
  const result = await pool.query(sql, values)

  return {
    columns: result.fields.map((field: FieldDef) => field.name),
    rows: result.rows,
    total,
  }
})
