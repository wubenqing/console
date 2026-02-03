import { getVolumeCatalogColumns, getVolumeCatalogConfig } from '@/server/utils/volume-catalog'

export default defineEventHandler(async () => {
  const config = getVolumeCatalogConfig()
  const columns = await getVolumeCatalogColumns()

  return {
    table: {
      schema: config.schema,
      name: config.table,
    },
    columns,
  }
})
