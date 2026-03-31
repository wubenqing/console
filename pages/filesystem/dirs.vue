<template>
  <Page>
    <PageHeader>
      <h1 class="text-2xl font-bold">{{ t('Directory Management') }}</h1>
      <template #actions>
        <SearchInput v-model="searchTerm" :placeholder="t('Search Directory')" clearable class="max-w-xs" />
        <Select v-model="statusFilter">
          <SelectTrigger class="w-[160px]">
            <SelectValue :placeholder="t('All Status')" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{{ t('All Status') }}</SelectItem>
            <SelectItem value="active">{{ t('Has Mounts') }}</SelectItem>
            <SelectItem value="idle">{{ t('No Mounts') }}</SelectItem>
          </SelectContent>
        </Select>
        <Button variant="outline" @click="showCreate = true">
          <Icon name="ri:add-line" class="size-4" />
          <span>{{ t('Create') }}</span>
        </Button>
        <Button variant="outline" @click="refresh">
          <Icon name="ri:refresh-line" class="size-4" />
          <span>{{ t('Refresh') }}</span>
        </Button>
      </template>
    </PageHeader>

    <DataTable
      :table="table"
      :is-loading="loading"
      :empty-title="t('No Directories')"
      :empty-description="t('Create a directory to get started.')"
    />

    <FilesystemCreateDirDialog v-model="showCreate" @created="refresh" />
    <FilesystemEditDirDialog v-model="showEdit" :dir-name="selectedDir" @updated="refresh" />
  </Page>
</template>

<script setup lang="ts">
import { Icon } from '#components'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import DataTable from '@/components/data-table/data-table.vue'
import { useDataTable } from '@/components/data-table/useDataTable'
import Page from '@/components/page.vue'
import PageHeader from '@/components/page-header.vue'
import type { DirectorySummary } from '~/types/filesystem'
import type { ColumnDef } from '@tanstack/vue-table'
import { h, onMounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useFilesystem } from '~/composables/useFilesystem'

const { t } = useI18n()
const message = useMessage()
const dialog = useDialog()
const { listDirectories, deleteDirectory } = useFilesystem()

const loading = ref(false)
const dirsData = ref<DirectorySummary[]>([])
const searchTerm = ref('')
const statusFilter = ref('all')

// Create dialog
const showCreate = ref(false)

// Edit dialog
const showEdit = ref(false)
const selectedDir = ref('')

function openEdit(name: string) {
  selectedDir.value = name
  showEdit.value = true
}

function getStatusLabel(status: string) {
  if (status === 'active') return t('Has Mounts')
  if (status === 'inactive' || status === 'idle') return t('No Mounts')
  return status
}

const columns: ColumnDef<DirectorySummary>[] = [
  {
    accessorKey: 'name',
    header: () => t('Directory Name'),
    cell: ({ row }) => h('span', { class: 'font-medium' }, row.original.name),
    filterFn: 'includesString',
  },
  {
    accessorKey: 'mountedCount',
    header: () => t('Mounted Count'),
    cell: ({ row }) => String(row.original.mountedCount),
  },
  {
    accessorKey: 'createdAt',
    header: () => t('Created Time'),
  },
  {
    accessorKey: 'statusSummary',
    header: () => t('Status'),
    cell: ({ row }) =>
      h(
        'span',
        {
          class: row.original.statusSummary === 'active' ? 'text-green-600 font-medium' : 'text-muted-foreground',
        },
        getStatusLabel(row.original.statusSummary)
      ),
    filterFn: (row, columnId, filterValue) => {
      if (!filterValue || filterValue === 'all') return true
      return row.getValue<string>(columnId) === filterValue
    },
  },
  {
    id: 'actions',
    header: () => t('Actions'),
    enableSorting: false,
    cell: ({ row }) =>
      h('div', { class: 'flex items-center gap-2' }, [
        h(Button, { variant: 'outline', size: 'sm', onClick: () => openEdit(row.original.name) }, () => [
          h(Icon, { name: 'ri:edit-2-line', class: 'size-4' }),
          h('span', t('Edit')),
        ]),
        h(Button, { variant: 'outline', size: 'sm', onClick: () => confirmDelete(row.original.name) }, () => [
          h(Icon, { name: 'ri:delete-bin-5-line', class: 'size-4' }),
          h('span', t('Delete')),
        ]),
      ]),
  },
]

const { table } = useDataTable<DirectorySummary>({
  data: dirsData,
  columns,
  getRowId: row => row.name,
})

async function refresh() {
  loading.value = true
  try {
    dirsData.value = await listDirectories()
  } catch {
    dirsData.value = []
  } finally {
    loading.value = false
  }
}

function confirmDelete(name: string) {
  dialog.error({
    title: t('Warning'),
    content: t('Are you sure you want to delete this directory?'),
    positiveText: t('Confirm'),
    negativeText: t('Cancel'),
    onPositiveClick: () => handleDelete(name),
  })
}

async function handleDelete(name: string) {
  try {
    await deleteDirectory(name)
    message.success(t('Delete Success'))
    await refresh()
  } catch (err: any) {
    message.error(err?.data?.statusMessage || err?.message || t('Delete Failed'))
  }
}

watch(searchTerm, value => {
  table.getColumn('name')?.setFilterValue(value || undefined)
})

watch(statusFilter, value => {
  table.getColumn('statusSummary')?.setFilterValue(value === 'all' ? undefined : value)
})

onMounted(() => {
  refresh()
})
</script>
