declare module 'pg' {
  export interface FieldDef {
    name: string
    tableID: number
    columnID: number
    dataTypeID: number
    dataTypeSize: number
    dataTypeModifier: number
    format: string
  }

  export interface QueryResult<T = any> {
    rows: T[]
    fields: FieldDef[]
    command: string
    rowCount: number | null
    oid: number | undefined
  }

  export interface PoolConfig {
    user?: string
    password?: string
    host?: string
    port?: number
    database?: string
    ssl?: boolean | any
    max?: number
    idleTimeoutMillis?: number
    connectionTimeoutMillis?: number
  }

  export class Pool {
    constructor(config?: PoolConfig)
    query<T = any>(sql: string, values?: any[]): Promise<QueryResult<T>>
    connect(): Promise<PoolClient>
    end(): Promise<void>
  }

  export interface PoolClient {
    query<T = any>(sql: string, values?: any[]): Promise<QueryResult<T>>
    release(): void
  }
}
