<template>
  <Page>
    <PageHeader>
      <h1 class="text-2xl font-bold">创建通用数据集</h1>
    </PageHeader>

    <div class="p-6 bg-white rounded-lg shadow-sm border">
      <div class="p-6 bg-white rounded-lg shadow-sm border">
        <!-- 基本信息 -->
        <div class="mb-8">
          <h3 class="text-lg font-medium mb-4 flex items-center">
            <Icon icon="mdi:information-outline" class="w-5 h-5 mr-2 text-blue-500" />
            基本信息
          </h3>

          <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
            <!-- 数据集英文名称 -->
            <div>
              <label class="block text-sm font-medium mb-1">
                * 数据集名称
              </label>
              <Input v-model="formData.name" required placeholder="请输入名称" />
            </div>

            <!-- 数据集格式 -->
            <div>
              <label class="block text-sm font-medium mb-1">
                数据集格式
              </label>
              <div class="flex flex-wrap gap-2">
                <Button
                  variant="outline"
                  v-for="format in formats"
                  :key="format"
                  :class="{ 'bg-blue-100 text-blue-700': formData.format === format }"
                  @click="formData.format = format"
                >
                  <Icon
                    :icon="getFormatIcon(format)"
                    class="w-4 h-4 mr-1"
                  />
                  {{ format }}
                </Button>
              </div>
            </div>

            <!-- 数据来源 -->
            <div class="space-y-4">
              <!-- 数据来源选择 -->
              <Field>
                <FieldLabel>{{ t('* 数据来源') }}</FieldLabel>
                <FieldContent>
                  <RadioGroup v-model="dataSource" class="grid gap-2 sm:grid-cols-4">
                    <label
                      v-for="option in dataSourceOptions"
                      :key="option.value"
                      class="flex items-start gap-3 rounded-md border border-border/50 p-3"
                    >
                      <RadioGroupItem :value="option.value" class="mt-0.5" />
                      <span class="text-sm font-medium">{{ option.label }}</span>
                    </label>
                  </RadioGroup>
                </FieldContent>
              </Field>

              <!-- 当选中 "元数据 Catalog" 时显示输入框和按钮 -->
              <div v-if="showCatalogInput" class="space-y-2">
                <InputGroup>
                  <InputGroupAddon>
                    <!-- 可以在这里添加图标或其他内容 -->
                  </InputGroupAddon>
                  <InputGroupInput v-model="catalogInputValue" placeholder="请输入" />
                  <InputGroupButton variant="outline" @click="handleSelectFromCatalog">
                    + 从 Catalog 选择
                  </InputGroupButton>
                </InputGroup>
              </div>
            </div>
          </div>
        </div>

        <!-- 高级设置 -->
        <div class="mb-8">
          <h3 class="text-lg font-medium mb-4 flex items-center cursor-pointer" @click="toggleAdvanced">
            <Icon
              :icon="advancedOpen ? 'mdi:chevron-up' : 'mdi:chevron-down'"
              class="w-5 h-5 mr-2"
            />
            高级设置
          </h3>

          <div v-show="advancedOpen" class="space-y-4">
            <!-- 所属项目 -->
            <div class="flex items-center gap-2">
              <label class="block text-sm font-medium mb-1">
                * 所属项目
              </label>
              <div class="flex-1">
                <Select v-model="formData.source" class="w-full">
                  <SelectTrigger class="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent">
                    <SelectValue placeholder="请选择项目" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="default">default(默认项目)</SelectItem>
                    <SelectItem value="project1">Project 1</SelectItem>
                    <SelectItem value="project2">Project 2</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <Button variant="outline" size="sm" class="p-2 rounded-full">
                <Icon icon="mdi:refresh" class="w-4 h-4" />
              </Button>
              <a href="#" class="text-blue-600 hover:text-blue-800 text-sm flex items-center gap-1">
                创建新项目
                <Icon icon="mdi:open-in-new" class="w-4 h-4" />
              </a>
            </div>
          </div>
        </div>

        <!-- 操作按钮 -->
        <div class="flex justify-end space-x-3 pt-4 border-t">
          <Button variant="outline" @click="resetForm">取消</Button>
          <Button @click="handleSubmit" class="bg-blue-600 hover:bg-blue-700 text-white">创建</Button>
        </div>
      </div>
    </div>

    <!-- 弹出的选择框 -->
    <Modal v-model:open="catalogSelectorOpen" title="选择 Catalog" width="600px">
      <div class="p-4">
        <!-- 第一层：Catalog选择 -->
        <div v-if="!selectedCatalog">
          <div class="mb-4">
            <SearchInput v-model="catalogSearchTerm" placeholder="搜索 Catalog..." />
          </div>
          
          <div class="border rounded-md max-h-80 overflow-y-auto">
            <ul v-if="filteredCatalogs.length > 0">
              <li 
                v-for="catalog in filteredCatalogs" 
                :key="catalog.name" 
                class="p-3 border-b hover:bg-gray-50 cursor-pointer"
                :class="{ 'bg-blue-50': selectedCatalog?.name === catalog.name }"
                @click="selectCatalog(catalog)"
              >
                <div class="font-medium">{{ catalog.name }}</div>
                <div class="text-sm text-gray-5:00 mt-1">{{ catalog.type }} | {{ catalog.provider }}</div>
              </li>
            </ul>
            <div v-else class="p-8 text-center text-gray-500">
              暂无可用 Catalog
            </div>
          </div>
        </div>

        <!-- 第二层：Schema选择 -->
        <div v-else-if="!selectedSchema">
          <div class="flex justify-between items-center mb-4">
            <h3 class="text-lg font-medium">选择 Schema</h3>
            <Button variant="outline" @click="selectedCatalog = null">返回上一级</Button>
          </div>
          
          <div class="mb-4">
            <SearchInput v-model="schemaSearchTerm" placeholder="搜索 Schema..." />
          </div>
          
          <div class="border rounded-md max-h-80 overflow-y-auto">
            <ul v-if="filteredSchemas.length > 0">
              <li 
                v-for="schema in filteredSchemas" 
                :key="schema.name" 
                class="p-3 border-b hover:bg-gray-50 cursor-pointer"
                :class="{ 'bg-blue-50': selectedSchema?.name === schema.name }"
                @click="selectSchema(schema)"
              >
                <div class="font-medium">{{ schema.name }}</div>
                <div class="text-sm text-gray-500 mt-1">{{ schema.type }}</div>
              </li>
            </ul>
            <div v-else class="p-8 text-center text-gray-500">
              暂无可用 Schema
            </div>
          </div>
        </div>

        <!-- 第三层：Table选择 -->
        <div v-else>
          <div class="flex justify-between items-center mb-4">
            <h3 class="text-lg font-medium">选择 Table</h3>
            <Button variant="outline" @click="selectedSchema = null">返回上一级</Button>
          </div>
          
          <div class="mb-4">
            <SearchInput v-model="tableSearchTerm" placeholder="搜索 Table..." />
          </div>
          
          <div class="border rounded-md max-h-80 overflow-y-auto">
            <ul v-if="filteredTables.length > 0">
              <li 
                v-for="table in filteredTables" 
                :key="table.name" 
                class="p-3 border-b hover:bg-gray-50 cursor-pointer"
                :class="{ 'bg-blue-50': selectedTable?.name === table.name }"
                @click="selectTable(table)"
              >
                <div class="font-medium">{{ table.name }}</div>
                <div class="text-sm text-gray-500 mt-1">{{ table.type }}</div>
              </li>
            </ul>
            <div v-else class="p-8 text-center text-gray-500">
              暂无可用 Table
            </div>
          </div>
        </div>
        
        <div class="mt-6 flex justify-end space-x-3">
          <Button type="button" variant="outline" @click="closeCatalogSelector">取消</Button>
          <Button type="button" @click="confirmCatalogSelection" :disabled="!selectedCatalog">确认</Button>
        </div>
      </div>
    </Modal>

  </Page>
</template>

<script lang="ts" setup>
import { ref } from 'vue'
import { useI18n } from 'vue-i18n'
import Page from '@/components/page.vue'
import PageHeader from '@/components/page-header.vue'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { Field, FieldContent, FieldLabel } from '@/components/ui/field'
import { InputGroup, InputGroupAddon, InputGroupButton, InputGroupInput } from '@/components/ui/input-group'
import { Icon } from '@iconify/vue'
import { useRouter } from 'vue-router'
import Modal from '@/components/modal.vue'
import SearchInput from '@/components/search-input.vue'
import { useGravitino } from '@/composables/useGravitino'
import type { Dataset } from '@/types/dataset'
import { useMessage } from '@/lib/ui/message'

const { t } = useI18n()

const formData = ref<Dataset>({
  id: '',
  name: '',
  format: 'Lance',
  source: '',
  size: '2.79 MB',
  creator: 'SYSTEM',
  createdAt: '2025-04-12 15:45:04',
  updatedAt: '2025-11-25 23:00:00'
})

const dataSourceOptions = [
  //{ label: '对象存储 TOS', value: 'tos' },
  //{ label: '文件存储 vePFS', value: 'vepfs' },
  { label: '元数据 Catalog', value: 'catalog' },
  //{ label: '示例文件', value: 'example' }
]
const formats = ['Lance', 'Iceberg']
const dataSource = ref('catalog') // 默认选中 "元数据 Catalog"
const showCatalogInput = computed(() => dataSource.value === 'catalog') //监听 dataSource 变化，控制输入框是否显示
const catalogInputValue = ref('')
const router = useRouter()

// 初始化Gravitino API
const api = useGravitino()
const message = useMessage()

// 用于管理catalog选择器的状态
const catalogSelectorOpen = ref(false)
const catalogs = ref<any[]>([]) // 存储所有catalogs
const selectedCatalog = ref<any>(null) // 当前选中的catalog
const catalogSearchTerm = ref(formData.value.format || '')

// 存储当前选中的catalog下的schemas
const schemas = ref<any[]>([])
const selectedSchema = ref<any>(null) // 当前选中的schema
const schemaSearchTerm = ref('') // schema搜索框的值

// 存储当前选中的schema下的tables
const tables = ref<any[]>([])
const selectedTable = ref<any>(null) // 当前选中的table
const tableSearchTerm = ref('') // table搜索框的值

// watcher用于监听formData.format的变化
watch(() => formData.value.format, (newFormat) => {
  catalogSearchTerm.value = newFormat
})

// 获取catalogs列表
const loadCatalogs = async () => {
  try {
    // 这里需要使用实际的API来获取catalogs列表
    // 以下是一个模拟的API调用
    // const response = await api.getCatalogs(metalake)
    // catalogs.value = response.catalogs
    
    // 模拟数据，实际开发中应替换为真实的API调用
    // catalogs.value = [
    //   { name: 'hive_catalog', type: 'relational', provider: 'hive' },
    //   { name: 'mysql_catalog', type: 'relational', provider: 'jdbc-mysql' },
    //   { name: 'postgres_catalog', type: 'relational', provider: 'jdbc-postgresql' },
    //   { name: 'iceberg_catalog', type: 'relational', provider: 'lakehouse-iceberg' },
    //   { name: 'paimon_catalog', type: 'relational', provider: 'lakehouse-paimon' }
    // ]

    // 设置默认metalake名称，也可以从配置中获取
    const metalake = 'lakehouse_metalake' // 可以从路由参数或其他地方动态获取
    
    // 调用真实的API获取catalogs列表
    const response = await api.getCatalogs(metalake)
    catalogs.value = response.catalogs || []
  } catch (error) {
    console.error('加载 catalogs 失败:', error)
    catalogs.value = []

    // 可选：显示错误消息给用户
    message.error('加载 catalogs 失败')
  }
}

// 获取catalog下的schemas
const loadSchemas = async (catalogName: string) => {
  try {
    const metalake = 'lakehouse_metalake' // 可以从路由参数或其他地方动态获取
    
    // 调用API获取catalog下的schemas
    const response = await api.getSchemas(metalake, catalogName)
    schemas.value = response.identifiers || []
  } catch (error) {
    console.error('加载 schemas 失败:', error)
    schemas.value = []
    
    // 可选：显示错误消息给用户
    message.error('加载 schemas 失败')
  }
}

// 获取schema下的tables
const loadTables = async (catalogName: string, schemaName: string) => {
  try {
    const metalake = 'lakehouse_metalake' // 可以从路由参数或其他地方动态获取
    
    // 调用API获取schema下的tables
    const response = await api.getTables(metalake, catalogName, schemaName)
    tables.value = response.identifiers || []
  } catch (error) {
    console.error('加载 tables 失败:', error)
    tables.value = []
    
    // 可选：显示错误消息给用户
    message.error('加载 tables 失败')
  }
}

// 计算过滤后的catalogs
const filteredCatalogs = computed(() => {
  if (!catalogSearchTerm.value) {
    return catalogs.value
  }
  return catalogs.value.filter(catalog => 
    catalog.name.toLowerCase().includes(catalogSearchTerm.value.toLowerCase())
  )
})

// 计算过滤后的schemas
const filteredSchemas = computed(() => {
  if (!schemaSearchTerm.value) {
    return schemas.value
  }
  return schemas.value.filter(schema => 
    schema.name.toLowerCase().includes(schemaSearchTerm.value.toLowerCase())
  )
})


// 计算过滤后的tables
const filteredTables = computed(() => {
  if (!tableSearchTerm.value) {
    return tables.value
  }
  return tables.value.filter(table => 
    table.name.toLowerCase().includes(tableSearchTerm.value.toLowerCase())
  )
})

// 选择catalog（但不确认）
const selectCatalog = (catalog: any) => {
  selectedCatalog.value = catalog
  // 加载该catalog下的schemas
  loadSchemas(catalog.name)
}

// 选择schema（但不确认）
const selectSchema = (schema: any) => {
  selectedSchema.value = schema
  // 加载该schema下的tables
  loadTables(selectedCatalog.value.name, schema.name)
}

// 选择table（但不确认）
const selectTable = (table: any) => {
  selectedTable.value = table
}
// 确认选择
const confirmCatalogSelection = () => {
  if (selectedCatalog.value) {
    // 更新输入框的值
    catalogInputValue.value = selectedCatalog.value.name
    // 如果选择了schema，也更新
    if (selectedSchema.value) {
      catalogInputValue.value += `.${selectedSchema.value.name}`
      // 如果选择了table，也更新
      if (selectedTable.value) {
        catalogInputValue.value += `.${selectedTable.value.name}`
      }
    }
    
    // 将选择结果赋值给 formData.source
    if (selectedTable.value) {
      formData.value.source = `${selectedCatalog.value.name}.${selectedSchema.value.name}.${selectedTable.value.name}`
    } else if (selectedSchema.value) {
      formData.value.source = `${selectedCatalog.value.name}.${selectedSchema.value.name}`
    } else {
      formData.value.source = selectedCatalog.value.name
    }
    
    // 关闭选择器
    catalogSelectorOpen.value = false
    // 清除选择状态
    selectedCatalog.value = null
    selectedSchema.value = null
    selectedTable.value = null
  }
}

const handleSelectFromCatalog = async () => {
  // 加载catalogs列表
  await loadCatalogs()
  // 打开选择器
  catalogSelectorOpen.value = true
}

// 关闭选择器
const closeCatalogSelector = () => {
  catalogSelectorOpen.value = false
  selectedCatalog.value = null
}

// 图标映射函数
const getFormatIcon = (format: string) => {
  const icons: Record<string, string> = {
    Lance: 'mdi:file-code',
    Iceberg: 'mdi:database',
    CSV: 'mdi:file-delimited',
    JSONL: 'mdi:json',
    Parquet: 'mdi:file-table',
    Image: 'mdi:image',
    Audio: 'mdi:audio',
    Video: 'mdi:video',
    Text: 'mdi:text-box'
  }
  return icons[format] || 'mdi:file'
}

const getSourceIcon = (source: string) => {
  const icons: Record<string, string> = {
    '对象存储 TOS': 'mdi:cloud',
    '文件存储 vePFS': 'mdi:folder',
    '元数据 Catalog': 'mdi:database',
    '示例文件': 'mdi:file-document'
  }
  return icons[source] || 'mdi:file'
}

const advancedOpen = ref(false)
const toggleAdvanced = () => {
  advancedOpen.value = !advancedOpen.value
}

const handleSubmit = async () => {
  try {
    // 构建要发送的数据
    const datasetData = {
      id: formData.value.id || Date.now().toString(), // 使用表单中的ID，如果没有则生成新的
      name: formData.value.name,
      format: formData.value.format,
      source: formData.value.source,
      size: '0 MB', // 默认大小为0
      creator: 'CURRENT_USER', // 可以替换为当前用户
      createdAt: new Date().toISOString().slice(0, 19).replace('T', ' '), // 格式化当前时间为 'YYYY-MM-DD HH:MM:SS'
      updatedAt: new Date().toISOString().slice(0, 19).replace('T', ' ') // 格式化当前时间为 'YYYY-MM-DD HH:MM:SS'
    }

    // 从localStorage获取现有的数据集列表
    let existingDatasets: any[] = []
    const datasetsStr = localStorage.getItem('datasets')
    if(datasetsStr) {
      try {
        existingDatasets = JSON.parse(datasetsStr)
      } catch (e) {
        console.error('解析现有数据集失败:', e)
        existingDatasets = []
      }
    }
    
    // 检查是否有同名数据集
    const duplicateIndex = existingDatasets.findIndex((dataset: any) => dataset.name === datasetData.name)
    if(duplicateIndex !== -1) {
      alert(`已存在名为 "${datasetData.name}" 的数据集，请使用其他名称`)
      return
    }
    
    // 将新的数据集添加到列表中
    existingDatasets.push(datasetData)
    
    // 保存更新后的数据集列表到localStorage
    localStorage.setItem('datasets', JSON.stringify(existingDatasets))
    
    // 同时保留单个数据集的兼容性
    localStorage.setItem('newDataset', JSON.stringify(datasetData))
    
    // 跳转回数据集列表页面
    router.back() // 或者 router.push('/ai-datalake/dataset')
  } catch (error: any) {
    console.error('创建数据集失败:', error)
    alert('创建数据集失败: ' + error.message)
  }
}

const resetForm = () => {
  router.back()
}
</script>

<style scoped>
/* 自定义样式以匹配图片 */
.card {
  border-radius: 0.5rem;
  padding: 1rem;
  background-color: #f9fafb;
  margin-bottom: 1rem;
}

.form-group {
  margin-bottom: 1rem;
}

.label {
  display: block;
  font-size: 0.875rem;
  font-weight: 500;
  margin-bottom: 0.5rem;
}
</style>