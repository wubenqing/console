<script setup lang="ts" generic="TData">
import { Button } from '@/components/ui/button'

import { cn } from '@/lib/utils'
import type { Table } from '@tanstack/vue-table'
import { computed } from 'vue'
import Selector from '~/components/selector.vue'

const { t } = useI18n()

const props = withDefaults(
  defineProps<{
    table: Table<TData>
    pageSizeOptions?: number[]
    class?: string
    pageCountOverride?: number
  }>(),
  {
    pageSizeOptions: () => [10, 20, 50, 100],
    class: undefined,
    pageCountOverride: undefined,
  }
)

const pagination = computed(() => props.table.getState().pagination)
const currentPage = computed(() => pagination.value.pageIndex + 1)
const pageCount = computed(() => {
  // Use override if provided (for manual pagination), otherwise use table's pageCount
  if (props.pageCountOverride !== undefined) {
    return props.pageCountOverride
  }
  // Ensure reactivity: recompute when pagination changes.
  pagination.value.pageIndex
  pagination.value.pageSize
  return props.table.getPageCount()
})
const displayPageCount = computed(() => Math.max(pageCount.value, 1))
const displayCurrentPage = computed(() => Math.min(currentPage.value, displayPageCount.value))
const canPrevious = computed(() => {
  // When pageCountOverride is provided, manually compute based on pageIndex
  if (props.pageCountOverride !== undefined) {
    return pagination.value.pageIndex > 0
  }
  pagination.value.pageIndex
  return props.table.getCanPreviousPage()
})
const canNext = computed(() => {
  // When pageCountOverride is provided, manually compute based on pageIndex and pageCount
  if (props.pageCountOverride !== undefined) {
    return pagination.value.pageIndex < pageCount.value - 1
  }
  pagination.value.pageIndex
  pagination.value.pageSize
  return props.table.getCanNextPage()
})

const handlePageSizeChange = (value: number | string | boolean | null) => {
  if (typeof value === 'number') {
    props.table.setPageSize(value)
  } else if (typeof value === 'string') {
    const parsed = Number.parseInt(value, 10)
    if (!Number.isNaN(parsed)) {
      props.table.setPageSize(parsed)
    }
  }
}

const handleNextPage = () => {
  console.log('[Pagination] Next button clicked, current pageIndex:', pagination.value.pageIndex)
  const newIndex = pagination.value.pageIndex + 1
  console.log('[Pagination] Setting pageIndex to:', newIndex)
  props.table.setPageIndex(newIndex)
}

const handlePrevPage = () => {
  console.log('[Pagination] Prev button clicked, current pageIndex:', pagination.value.pageIndex)
  const newIndex = pagination.value.pageIndex - 1
  console.log('[Pagination] Setting pageIndex to:', newIndex)
  props.table.setPageIndex(newIndex)
}

const handleFirstPage = () => {
  console.log('[Pagination] First button clicked')
  props.table.setPageIndex(0)
}

const handleLastPage = () => {
  const lastIndex = Math.max(displayPageCount.value - 1, 0)
  console.log('[Pagination] Last button clicked, target:', lastIndex)
  props.table.setPageIndex(lastIndex)
}
</script>

<template>
  <div :class="cn('flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between', props.class)">
    <div class="flex items-center gap-3">
      <span class="text-sm text-muted-foreground">
        {{ t('Rows per page') }}
      </span>
      <Selector
        :options="pageSizeOptions.map(option => ({ label: String(option), value: option }))"
        :model-value="pagination.pageSize"
        class="w-24"
        @update:model-value="handlePageSizeChange"
      />
    </div>

    <div class="flex items-center gap-2">
      <span class="text-sm text-muted-foreground">
        {{ t('Page {current} of {total}', { current: displayCurrentPage, total: displayPageCount }) }}
      </span>
      <div class="flex items-center gap-2">
        <Button variant="outline" size="sm" :disabled="!canPrevious" @click="handleFirstPage">
          {{ t('First') }}
        </Button>
        <Button variant="outline" size="sm" :disabled="!canPrevious" @click="handlePrevPage">
          {{ t('Prev') }}
        </Button>
        <Button variant="outline" size="sm" :disabled="!canNext" @click="handleNextPage">
          {{ t('Next') }}
        </Button>
        <Button variant="outline" size="sm" :disabled="!canNext" @click="handleLastPage">
          {{ t('Last') }}
        </Button>
      </div>
    </div>
  </div>
</template>
