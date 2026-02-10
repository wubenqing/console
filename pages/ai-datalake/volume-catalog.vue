<script lang="ts" setup>
import DataTable from '@/components/data-table/data-table.vue'
import DataTablePagination from '@/components/data-table/data-table-pagination.vue'
import { useDataTable } from '@/components/data-table/useDataTable'
import Page from '@/components/page.vue'
import PageHeader from '@/components/page-header.vue'
import Selector, { type SelectOption } from '@/components/selector.vue'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Separator } from '@/components/ui/separator'
import { useMessage } from '@/lib/ui/message'
import type { ColumnDef } from '@tanstack/vue-table'
import { computed, onMounted, ref, watch } from 'vue'
import { Icon } from '#components'

type ColumnInfo = {
  name: string
  dataType: string
  isNullable: boolean
}

type Condition = {
  column: string
  operator: string
  value?: string
}

type ConditionGroup = {
  conditions: Condition[]
}

type QueryCondition = {
  column: string
  operator: string
  value?: string
  relation: 'AND' | 'OR'
}

const message = useMessage()

const schemaColumns = ref<ColumnInfo[]>([])
const schemaLoading = ref(false)
const queryLoading = ref(false)
const queryError = ref('')

const panelActive = ref(false)
const pendingRelation = ref<'OR' | 'AND' | null>(null)
const pendingGroupIndex = ref<number | null>(null)
const selectedColumn = ref<string | null>(null)
const selectedOperator = ref<string>('=')
const selectedValue = ref('')

const conditionGroups = ref<ConditionGroup[]>([])
const results = ref<Record<string, unknown>[]>([])
const resultColumns = ref<string[]>([])
const totalRows = ref(0)
const queryInitialized = ref(false)

const getOperatorsByDataType = (dataType: string): SelectOption[] => {
  const typeUpper = dataType.toUpperCase()

  // 数字类型
  if (
    ['BIGINT', 'INTEGER', 'SMALLINT', 'DECIMAL', 'NUMERIC', 'REAL', 'DOUBLE PRECISION', 'INT'].some(t =>
      typeUpper.includes(t)
    )
  ) {
    return [
      { label: '=', value: '=' },
      { label: '!=', value: '!=' },
      { label: '>', value: '>' },
      { label: '>=', value: '>=' },
      { label: '<', value: '<' },
      { label: '<=', value: '<=' },
      { label: 'IS NULL', value: 'IS NULL' },
      { label: 'IS NOT NULL', value: 'IS NOT NULL' },
    ]
  }

  // 文本类型
  if (['TEXT', 'VARCHAR', 'CHAR', 'STRING'].some(t => typeUpper.includes(t))) {
    return [
      { label: '=', value: '=' },
      { label: '!=', value: '!=' },
      { label: 'LIKE', value: 'LIKE' },
      { label: 'ILIKE', value: 'ILIKE' },
      { label: 'IN', value: 'IN' },
      { label: 'IS NULL', value: 'IS NULL' },
      { label: 'IS NOT NULL', value: 'IS NOT NULL' },
    ]
  }

  // 时间类型
  if (['TIMESTAMPTZ', 'TIMESTAMP', 'DATE', 'TIME'].some(t => typeUpper.includes(t))) {
    return [
      { label: '=', value: '=' },
      { label: '!=', value: '!=' },
      { label: '>', value: '>' },
      { label: '>=', value: '>=' },
      { label: '<', value: '<' },
      { label: '<=', value: '<=' },
      { label: 'IS NULL', value: 'IS NULL' },
      { label: 'IS NOT NULL', value: 'IS NOT NULL' },
    ]
  }

  // 默认
  return [
    { label: '=', value: '=' },
    { label: '!=', value: '!=' },
    { label: 'IS NULL', value: 'IS NULL' },
    { label: 'IS NOT NULL', value: 'IS NOT NULL' },
  ]
}

const columnOptions = computed<SelectOption[]>(() =>
  schemaColumns.value.map(column => ({
    label: `${column.name} (${column.dataType})`,
    value: column.name,
  }))
)

const operatorOptions = computed<SelectOption[]>(() => {
  if (!selectedColumn.value) return []
  const column = schemaColumns.value.find(c => c.name === selectedColumn.value)
  return column ? getOperatorsByDataType(column.dataType) : []
})

const isValueRequired = computed(() => !['IS NULL', 'IS NOT NULL'].includes(selectedOperator.value))

const canAddCondition = computed(() => {
  if (!selectedColumn.value || !selectedOperator.value) return false
  if (!isValueRequired.value) return true
  return selectedValue.value.trim().length > 0
})

const formatCellValue = (value: unknown): string => {
  if (value === null || value === undefined) return ''
  if (typeof value === 'string') return value
  if (typeof value === 'number' || typeof value === 'boolean') return String(value)
  if (value instanceof Date) return value.toLocaleString()
  try {
    return JSON.stringify(value)
  } catch {
    return String(value)
  }
}

const tableColumns = computed<ColumnDef<Record<string, unknown>>[]>(() =>
  resultColumns.value.map(column => ({
    accessorKey: column,
    header: column,
    cell: info => formatCellValue(info.getValue()),
  }))
)

const { table, pagination, sorting, computedPageCount } = useDataTable({
  data: results,
  columns: tableColumns,
  pageSize: 50,
  rowCount: totalRows,
  manualPagination: true,
  manualSorting: true,
})

const fetchSchema = async () => {
  schemaLoading.value = true
  queryError.value = ''

  try {
    const response = await $fetch<{ columns: ColumnInfo[] }>('/api/volume-catalog/schema')
    schemaColumns.value = response.columns || []
  } catch (error: any) {
    const messageText = error?.statusMessage || error?.message || 'Failed to load schema.'
    queryError.value = messageText
    message.error(messageText)
  } finally {
    schemaLoading.value = false
  }
}

const refreshSchema = async () => {
  await fetchSchema()
  conditionGroups.value = []
  results.value = []
  resultColumns.value = []
  totalRows.value = 0
  queryInitialized.value = false
  pagination.value = { ...pagination.value, pageIndex: 0 }
  sorting.value = []
  panelActive.value = false
  pendingRelation.value = null
  pendingGroupIndex.value = null
  selectedColumn.value = null
  selectedOperator.value = '='
  selectedValue.value = ''
}

const addCondition = () => {
  if (!panelActive.value || !pendingRelation.value) return
  if (!canAddCondition.value || !selectedColumn.value) return

  const newCondition: Condition = {
    column: selectedColumn.value,
    operator: selectedOperator.value,
    value: isValueRequired.value ? selectedValue.value.trim() : undefined,
  }

  if (pendingRelation.value === 'AND') {
    const targetIndex = pendingGroupIndex.value
    if (targetIndex === null || !conditionGroups.value[targetIndex]) return
    conditionGroups.value[targetIndex]!.conditions.push(newCondition)
  } else {
    conditionGroups.value.push({
      conditions: [newCondition],
    })
  }

  // 清除所有输入框状态
  selectedColumn.value = null
  selectedOperator.value = '='
  selectedValue.value = ''
  panelActive.value = false
  pendingRelation.value = null
  pendingGroupIndex.value = null
}

const clearConditionInput = () => {
  selectedColumn.value = null
  selectedOperator.value = '='
  selectedValue.value = ''
}

const activatePanel = (relation: 'OR' | 'AND', groupIndex?: number) => {
  panelActive.value = true
  pendingRelation.value = relation
  pendingGroupIndex.value = relation === 'AND' && groupIndex !== undefined ? groupIndex : null
}

const removeCondition = (groupIndex: number, conditionIndex: number) => {
  const group = conditionGroups.value[groupIndex]
  if (group) {
    group.conditions.splice(conditionIndex, 1)

    // 如果条件组为空，删除整个条件组
    if (group.conditions.length === 0) {
      conditionGroups.value.splice(groupIndex, 1)
    }
  }
}

const runQuery = async () => {
  queryLoading.value = true
  queryError.value = ''

  try {
    // 转换条件格式
    const conditions: QueryCondition[] = []
    conditionGroups.value.forEach((group, groupIndex) => {
      group.conditions.forEach((condition, conditionIndex) => {
        conditions.push({
          ...condition,
          relation: conditionIndex === 0 && groupIndex > 0 ? 'OR' : 'AND',
        })
      })
    })

    const { pageIndex, pageSize } = pagination.value
    const sortState = sorting.value?.[0]

    const response = await $fetch<{ columns: string[]; rows: Record<string, unknown>[]; total: number }>(
      '/api/volume-catalog/query',
      {
        method: 'POST',
        body: {
          conditions,
          limit: pageSize,
          offset: pageIndex * pageSize,
          sort: sortState ? { column: sortState.id, direction: sortState.desc ? 'desc' : 'asc' } : undefined,
        },
      }
    )

    const parsedTotal = Number(response?.total ?? 0)
    totalRows.value = Number.isFinite(parsedTotal) && parsedTotal >= 0 ? parsedTotal : 0

    console.log('[Volume Catalog] Query completed:', {
      total: response?.total,
      parsedTotal,
      totalRows: totalRows.value,
      pageSize: pagination.value.pageSize,
      expectedPageCount: Math.ceil(totalRows.value / pagination.value.pageSize),
      currentPageIndex: pagination.value.pageIndex,
      rowCount: results.value.length,
    })

    resultColumns.value = (response.columns || []).filter(col => col !== 'last_seen_generation')
    results.value = response.rows || []
    queryInitialized.value = true
  } catch (error: any) {
    const messageText = error?.statusMessage || error?.message || 'Query failed.'
    queryError.value = messageText
    message.error(messageText)
  } finally {
    queryLoading.value = false
  }
}

watch(
  () => pagination.value.pageIndex,
  (newIndex, oldIndex) => {
    console.log('[Volume Catalog] pageIndex changed:', { oldIndex, newIndex, queryInitialized: queryInitialized.value })
    if (!queryInitialized.value) return
    if (queryLoading.value) return
    if (conditionGroups.value.length === 0) return
    runQuery()
  }
)

watch(
  () => pagination.value.pageSize,
  (newSize, oldSize) => {
    console.log('[Volume Catalog] pageSize changed:', { oldSize, newSize, queryInitialized: queryInitialized.value })
    if (!queryInitialized.value) return
    if (newSize !== oldSize && pagination.value.pageIndex !== 0) {
      pagination.value = { ...pagination.value, pageIndex: 0 }
    }
  }
)

watch(
  () => JSON.stringify(sorting.value),
  (newSort, oldSort) => {
    console.log('[Volume Catalog] sorting changed:', { oldSort, newSort, queryInitialized: queryInitialized.value })
    if (!queryInitialized.value) return
    if (queryLoading.value) return
    if (conditionGroups.value.length === 0) return
    if (newSort === oldSort) return
    runQuery()
  }
)

const handleNewQuery = () => {
  queryInitialized.value = false
  totalRows.value = 0
  sorting.value = []
  pagination.value = { ...pagination.value, pageIndex: 0 }
  runQuery()
}

onMounted(() => {
  fetchSchema()
})
</script>

<template>
  <Page class="overflow-x-hidden">
    <PageHeader>
      <div>
        <h1 class="text-xl font-semibold">Volume Catalog</h1>
      </div>
      <template #actions>
        <Button size="sm" variant="outline" :disabled="schemaLoading" @click="refreshSchema">
          <Icon name="ri:refresh-line" class="mr-2 size-4" />
          Reset
        </Button>
      </template>
    </PageHeader>

    <Card>
      <CardHeader class="flex flex-row items-center justify-between gap-4">
        <CardTitle>Query Panel</CardTitle>
      </CardHeader>
      <CardContent class="space-y-6">
        <div class="grid gap-4 lg:grid-cols-12" :class="{ 'opacity-50 pointer-events-none': !panelActive }">
          <div class="space-y-2 lg:col-span-4">
            <Label>Column Name</Label>
            <Selector
              v-model="selectedColumn"
              :options="columnOptions"
              :disabled="!panelActive || schemaLoading || columnOptions.length === 0"
              placeholder="Select column"
            />
          </div>
          <div class="space-y-2 lg:col-span-3">
            <Label>Operator</Label>
            <Selector
              v-model="selectedOperator"
              :options="operatorOptions"
              :disabled="!panelActive"
              placeholder="Select operator"
            />
          </div>
          <div class="space-y-2 lg:col-span-3">
            <Label>Value</Label>
            <Input v-model="selectedValue" :disabled="!panelActive || !isValueRequired" placeholder="Enter value" />
          </div>
        </div>

        <div class="flex justify-end gap-2">
          <Button variant="ghost" size="sm" :disabled="!panelActive || !selectedColumn" @click="clearConditionInput">
            <Icon name="ri:delete-bin-line" class="size-4" />
          </Button>
          <Button :disabled="!panelActive || !canAddCondition" @click="addCondition">Add</Button>
        </div>

        <Separator />

        <div class="flex items-center justify-between gap-3">
          <div class="flex items-center gap-2">
            <h3 class="text-sm font-medium">Conditions</h3>
            <span class="text-xs text-muted-foreground"
              >({{ conditionGroups.reduce((sum, g) => sum + g.conditions.length, 0) }})</span
            >
          </div>
        </div>
        <div class="rounded-md bg-muted/30 px-3 py-2">
          <ul class="space-y-1 text-xs text-muted-foreground">
            <li class="flex items-center gap-2">
              <span class="text-[10px]">◆</span>
              <span>Conditions between different groups: OR</span>
            </li>
            <li class="flex items-center gap-2">
              <span class="text-[10px]">◆</span>
              <span>Conditions within the same group: AND</span>
            </li>
          </ul>
        </div>
        <div class="mt-2">
          <Button
            variant="outline"
            size="sm"
            :disabled="schemaLoading || columnOptions.length === 0"
            @click="activatePanel('OR')"
          >
            <Icon name="ri:add-line" class="mr-1 size-4" />
            Condition Group
          </Button>
        </div>

        <div v-if="conditionGroups.length" class="space-y-4">
          <template v-for="(group, groupIndex) in conditionGroups" :key="`group-${groupIndex}`">
            <!-- OR Condition Group -->
            <div class="space-y-2 rounded-lg border border-dashed border-muted-foreground/30 p-4">
              <!-- Group header with AND button -->
              <div class="flex items-center gap-2">
                <span class="text-xs font-medium text-muted-foreground">Group {{ groupIndex + 1 }}</span>
                <Button
                  variant="outline"
                  size="sm"
                  :disabled="schemaLoading || columnOptions.length === 0"
                  @click="activatePanel('AND', groupIndex)"
                >
                  <Icon name="ri:add-line" class="mr-1 size-4" />
                  AND
                </Button>
              </div>

              <div class="space-y-2">
                <template
                  v-for="(condition, conditionIndex) in group.conditions"
                  :key="`condition-${groupIndex}-${conditionIndex}`"
                >
                  <!-- AND separator -->
                  <div v-if="conditionIndex > 0" class="text-xs font-semibold text-muted-foreground">AND</div>

                  <!-- Condition -->
                  <div class="flex flex-wrap items-center gap-2 rounded-md bg-muted/50 px-3 py-2">
                    <Badge variant="secondary">{{ condition.column }}</Badge>
                    <Badge variant="outline">{{ condition.operator }}</Badge>
                    <span class="text-sm">{{ condition.value || '-' }}</span>
                    <Button
                      variant="ghost"
                      size="sm"
                      class="ml-auto h-6 w-6 p-0"
                      @click="removeCondition(groupIndex, conditionIndex)"
                    >
                      <Icon name="ri:delete-bin-line" class="size-4" />
                    </Button>
                  </div>
                </template>
              </div>
            </div>

            <!-- OR separator and button -->
            <div
              v-if="groupIndex < conditionGroups.length - 1"
              class="flex items-center justify-center gap-2 text-xs font-semibold text-muted-foreground"
            >
              <div class="flex-1 border-t border-muted-foreground/30"></div>
              OR
              <div class="flex-1 border-t border-muted-foreground/30"></div>
            </div>
          </template>
        </div>

        <div class="flex flex-col gap-3">
          <p v-if="queryError" class="text-sm text-destructive">{{ queryError }}</p>

          <!-- Create query button -->
          <Button :disabled="queryLoading || conditionGroups.length === 0" class="self-start" @click="handleNewQuery">
            Create a new query
          </Button>
        </div>
      </CardContent>
    </Card>

    <Card v-if="queryLoading || results.length > 0" class="mt-4 w-full max-w-screen-2xl mx-auto">
      <CardHeader>
        <CardTitle>Query Results</CardTitle>
      </CardHeader>
      <CardContent class="p-0 w-full">
        <div class="h-[480px] overflow-x-auto rounded-md border border-b-0 rounded-b-none">
          <DataTable
            :table="table"
            :is-loading="queryLoading"
            empty-title=""
            empty-description=""
            table-class="min-w-max"
          />
        </div>
        <DataTablePagination :table="table" :page-count-override="computedPageCount" class="border rounded-b-md p-4" />
      </CardContent>
    </Card>
  </Page>
</template>
