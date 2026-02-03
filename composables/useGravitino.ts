import { createSharedComposable } from '@vueuse/core'

export const useGravitino = createSharedComposable(() => {
  const apiBase = '/api/gravitino' // Proxy path

  const enc = (value: string) => encodeURIComponent(value)

  const fetcher = async <T>(url: string, options: any = {}) => {
    try {
      const res: any = await $fetch<T>(url, {
        baseURL: apiBase,
        ...options,
        headers: {
          Accept: 'application/vnd.gravitino.v1+json',
          ...options.headers,
        },
      })

      if (res && res.code === 0 && res.result) {
        return res.result
      }
      return res
    } catch (error) {
      console.error(`[Gravitino API Error] ${url}:`, error)
      throw error
    }
  }

  // --- Metalakes ---
  const getMetalakes = () => fetcher<{ metalakes: any[] }>('/metalakes?details=true')
  const getMetalake = (name: string) => fetcher<{ metalake: any }>(`/metalakes/${enc(name)}`)
  const createMetalake = (data: any) => fetcher('/metalakes', { method: 'POST', body: data })
  const updateMetalake = (name: string, data: any) => fetcher(`/metalakes/${enc(name)}`, { method: 'PUT', body: data })
  const deleteMetalake = (name: string, force = false) =>
    fetcher(`/metalakes/${enc(name)}?force=${force}`, { method: 'DELETE' })

  const switchMetalakeInUse = (name: string, isInUse: boolean) =>
    fetcher(`/metalakes/${enc(name)}`, { method: 'PATCH', body: { inUse: isInUse } })

  // --- Catalogs ---
  const getCatalogs = (metalake: string) =>
    fetcher<{ catalogs: any[] }>(`/metalakes/${enc(metalake)}/catalogs?details=true`)

  const getCatalog = (metalake: string, catalog: string) =>
    fetcher<{ catalog: any }>(`/metalakes/${enc(metalake)}/catalogs/${enc(catalog)}`)

  const createCatalog = (metalake: string, data: any) =>
    fetcher(`/metalakes/${enc(metalake)}/catalogs`, { method: 'POST', body: data })

  const updateCatalog = (metalake: string, catalog: string, data: any) =>
    fetcher(`/metalakes/${enc(metalake)}/catalogs/${enc(catalog)}`, { method: 'PUT', body: data })

  const deleteCatalog = (metalake: string, catalog: string, force = false) =>
    fetcher(`/metalakes/${enc(metalake)}/catalogs/${enc(catalog)}?force=${force}`, { method: 'DELETE' })

  const switchCatalogInUse = (metalake: string, catalog: string, isInUse: boolean) =>
    fetcher(`/metalakes/${enc(metalake)}/catalogs/${enc(catalog)}`, { method: 'PATCH', body: { inUse: isInUse } })

  // --- Schemas ---
  const getSchemas = (metalake: string, catalog: string) =>
    fetcher<{ identifiers: any[] }>(`/metalakes/${enc(metalake)}/catalogs/${enc(catalog)}/schemas`)

  const getSchema = (metalake: string, catalog: string, schema: string) =>
    fetcher<{ schema: any }>(`/metalakes/${enc(metalake)}/catalogs/${enc(catalog)}/schemas/${enc(schema)}`)

  const createSchema = (metalake: string, catalog: string, data: any) =>
    fetcher(`/metalakes/${enc(metalake)}/catalogs/${enc(catalog)}/schemas`, {
      method: 'POST',
      body: { ...data, properties: data.properties || {} },
    })

  const updateSchema = (metalake: string, catalog: string, schema: string, data: any) =>
    fetcher(`/metalakes/${enc(metalake)}/catalogs/${enc(catalog)}/schemas/${enc(schema)}`, {
      method: 'PUT',
      body: data,
    })

  const deleteSchema = (metalake: string, catalog: string, schema: string, cascade = false) =>
    fetcher(`/metalakes/${enc(metalake)}/catalogs/${enc(catalog)}/schemas/${enc(schema)}?cascade=${cascade}`, {
      method: 'DELETE',
    })

  // --- Tables ---
  const getTables = (metalake: string, catalog: string, schema: string) =>
    fetcher<{ identifiers: any[] }>(
      `/metalakes/${enc(metalake)}/catalogs/${enc(catalog)}/schemas/${enc(schema)}/tables`
    )

  const getTable = (metalake: string, catalog: string, schema: string, table: string) =>
    fetcher<{ table: any }>(
      `/metalakes/${enc(metalake)}/catalogs/${enc(catalog)}/schemas/${enc(schema)}/tables/${enc(table)}`
    )

  const createTable = (metalake: string, catalog: string, schema: string, data: any) =>
    fetcher(`/metalakes/${enc(metalake)}/catalogs/${enc(catalog)}/schemas/${enc(schema)}/tables`, {
      method: 'POST',
      body: data,
    })

  const updateTable = (metalake: string, catalog: string, schema: string, table: string, data: any) =>
    fetcher(`/metalakes/${enc(metalake)}/catalogs/${enc(catalog)}/schemas/${enc(schema)}/tables/${enc(table)}`, {
      method: 'PUT',
      body: data,
    })

  const deleteTable = (metalake: string, catalog: string, schema: string, table: string, purge = false) =>
    fetcher(
      `/metalakes/${enc(metalake)}/catalogs/${enc(catalog)}/schemas/${enc(schema)}/tables/${enc(table)}?purge=${purge}`,
      { method: 'DELETE' }
    )

  // --- Filesets ---
  const getFilesets = (metalake: string, catalog: string, schema: string) =>
    fetcher<{ identifiers: any[] }>(
      `/metalakes/${enc(metalake)}/catalogs/${enc(catalog)}/schemas/${enc(schema)}/filesets`
    )

  const getFileset = (metalake: string, catalog: string, schema: string, fileset: string) =>
    fetcher<{ fileset: any }>(
      `/metalakes/${enc(metalake)}/catalogs/${enc(catalog)}/schemas/${enc(schema)}/filesets/${enc(fileset)}`
    )

  const listFilesetFiles = (
    metalake: string,
    catalog: string,
    schema: string,
    fileset: string,
    subPath = '/',
    locationName?: string
  ) => {
    const params = new URLSearchParams()
    if (subPath) params.append('sub_path', subPath)
    if (locationName) params.append('location_name', locationName)

    const query = params.toString()
    return fetcher(
      `/metalakes/${enc(metalake)}/catalogs/${enc(catalog)}/schemas/${enc(schema)}/filesets/${enc(fileset)}/files${
        query ? `?${query}` : ''
      }`
    )
  }

  const createFileset = (metalake: string, catalog: string, schema: string, data: any) =>
    fetcher(`/metalakes/${enc(metalake)}/catalogs/${enc(catalog)}/schemas/${enc(schema)}/filesets`, {
      method: 'POST',
      body: data,
    })

  const updateFileset = (metalake: string, catalog: string, schema: string, fileset: string, data: any) =>
    fetcher(`/metalakes/${enc(metalake)}/catalogs/${enc(catalog)}/schemas/${enc(schema)}/filesets/${enc(fileset)}`, {
      method: 'PUT',
      body: data,
    })

  const deleteFileset = (metalake: string, catalog: string, schema: string, fileset: string) =>
    fetcher(`/metalakes/${enc(metalake)}/catalogs/${enc(catalog)}/schemas/${enc(schema)}/filesets/${enc(fileset)}`, {
      method: 'DELETE',
    })

  // --- Topics ---
  const getTopics = (metalake: string, catalog: string, schema: string) =>
    fetcher<{ identifiers: any[] }>(
      `/metalakes/${enc(metalake)}/catalogs/${enc(catalog)}/schemas/${enc(schema)}/topics`
    )

  const getTopic = (metalake: string, catalog: string, schema: string, topic: string) =>
    fetcher<{ topic: any }>(
      `/metalakes/${enc(metalake)}/catalogs/${enc(catalog)}/schemas/${enc(schema)}/topics/${enc(topic)}`
    )

  const createTopic = (metalake: string, catalog: string, schema: string, data: any) =>
    fetcher(`/metalakes/${enc(metalake)}/catalogs/${enc(catalog)}/schemas/${enc(schema)}/topics`, {
      method: 'POST',
      body: data,
    })

  const updateTopic = (metalake: string, catalog: string, schema: string, topic: string, data: any) =>
    fetcher(`/metalakes/${enc(metalake)}/catalogs/${enc(catalog)}/schemas/${enc(schema)}/topics/${enc(topic)}`, {
      method: 'PUT',
      body: data,
    })

  const deleteTopic = (metalake: string, catalog: string, schema: string, topic: string) =>
    fetcher(`/metalakes/${enc(metalake)}/catalogs/${enc(catalog)}/schemas/${enc(schema)}/topics/${enc(topic)}`, {
      method: 'DELETE',
    })

  // --- Models & Versions ---
  const getModels = (metalake: string, catalog: string, schema: string) =>
    fetcher<{ identifiers: any[] }>(
      `/metalakes/${enc(metalake)}/catalogs/${enc(catalog)}/schemas/${enc(schema)}/models`
    )

  const getModel = (metalake: string, catalog: string, schema: string, model: string) =>
    fetcher<{ model: any }>(
      `/metalakes/${enc(metalake)}/catalogs/${enc(catalog)}/schemas/${enc(schema)}/models/${enc(model)}`
    )

  const registerModel = (metalake: string, catalog: string, schema: string, data: any) =>
    fetcher(`/metalakes/${enc(metalake)}/catalogs/${enc(catalog)}/schemas/${enc(schema)}/models`, {
      method: 'POST',
      body: data,
    })

  const updateModel = (metalake: string, catalog: string, schema: string, model: string, data: any) =>
    fetcher(`/metalakes/${enc(metalake)}/catalogs/${enc(catalog)}/schemas/${enc(schema)}/models/${enc(model)}`, {
      method: 'PUT',
      body: data,
    })

  const deleteModel = (metalake: string, catalog: string, schema: string, model: string) =>
    fetcher(`/metalakes/${enc(metalake)}/catalogs/${enc(catalog)}/schemas/${enc(schema)}/models/${enc(model)}`, {
      method: 'DELETE',
    })

  const getModelVersions = (metalake: string, catalog: string, schema: string, model: string) =>
    fetcher<{ identifiers: any[] }>(
      `/metalakes/${enc(metalake)}/catalogs/${enc(catalog)}/schemas/${enc(schema)}/models/${enc(model)}/versions`
    )

  const getVersion = (metalake: string, catalog: string, schema: string, model: string, version: string | number) =>
    fetcher(
      `/metalakes/${enc(metalake)}/catalogs/${enc(catalog)}/schemas/${enc(schema)}/models/${enc(model)}/versions/${version}`
    )

  const linkVersion = (metalake: string, catalog: string, schema: string, model: string, data: any) =>
    fetcher(
      `/metalakes/${enc(metalake)}/catalogs/${enc(catalog)}/schemas/${enc(schema)}/models/${enc(model)}/versions`,
      { method: 'POST', body: data }
    )

  const updateVersion = (
    metalake: string,
    catalog: string,
    schema: string,
    model: string,
    version: string | number,
    data: any
  ) =>
    fetcher(
      `/metalakes/${enc(metalake)}/catalogs/${enc(catalog)}/schemas/${enc(schema)}/models/${enc(model)}/versions/${version}`,
      { method: 'PUT', body: data }
    )

  const deleteVersion = (metalake: string, catalog: string, schema: string, model: string, version: string | number) =>
    fetcher(
      `/metalakes/${enc(metalake)}/catalogs/${enc(catalog)}/schemas/${enc(schema)}/models/${enc(model)}/versions/${version}`,
      { method: 'DELETE' }
    )

  return {
    getMetalakes,
    getMetalake,
    createMetalake,
    updateMetalake,
    deleteMetalake,
    switchMetalakeInUse,

    getCatalogs,
    getCatalog,
    createCatalog,
    updateCatalog,
    deleteCatalog,
    switchCatalogInUse,

    getSchemas,
    getSchema,
    createSchema,
    updateSchema,
    deleteSchema,

    getTables,
    getTable,
    createTable,
    updateTable,
    deleteTable,

    getFilesets,
    getFileset,
    listFilesetFiles,
    createFileset,
    updateFileset,
    deleteFileset,

    getTopics,
    getTopic,
    createTopic,
    updateTopic,
    deleteTopic,

    getModels,
    getModel,
    registerModel,
    updateModel,
    deleteModel,

    getModelVersions,
    getVersion,
    linkVersion,
    updateVersion,
    deleteVersion,
  }
})
