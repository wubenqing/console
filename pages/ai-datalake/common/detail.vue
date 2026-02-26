<template>
  <Page>
    <PageHeader class="items-center">
      <h1 class="text-2xl font-bold">{{ dataset?.name }}</h1>
      <template #description>
        <p class="text-sm text-muted-foreground mt-1">
          数据集详情页面
        </p>
      </template>
    </PageHeader>

    <!-- 数据集基本信息 -->
    <div class="bg-white rounded-lg p-4 shadow mb-8">
      <h3 class="font-semibold text-lg mb-4">基本信息</h3>
      <div class="flex flex-wrap gap-6 text-sm">
        <!-- 数据集名称 -->
        <div class="flex-1 min-w-[150px]">
          <span class="text-gray-500">数据集名称：</span>
          <span class="font-medium">{{ dataset?.name }}</span>
        </div>

        <!-- 格式 -->
        <div class="flex-1 min-w-[150px]">
          <span class="text-gray-500">格式：</span>
          <span class="font-medium">{{ dataset?.format }}</span>
        </div>

        <!-- 数据来源 -->
        <div class="flex-1 min-w-[150px]">
          <span class="text-gray-500">数据来源：</span>
          <span class="font-medium">{{ dataset?.source }}</span>
        </div>

        <!-- 创建人 -->
        <div class="flex-1 min-w-[150px]">
          <span class="text-gray-500">创建人：</span>
          <span class="font-medium">{{ dataset?.creator }}</span>
        </div>

        <!-- 创建时间 -->
        <div class="flex-1 min-w-[150px]">
          <span class="text-gray-500">创建时间：</span>
          <span class="font-medium">{{ dataset?.createdAt }}</span>
        </div>
      </div>
    </div>

    <!-- 标签页导航 -->
    <div class="flex border-b mb-6">
      <button
        class="px-4 py-2 border-b-2 font-medium text-sm"
        :class="{ 'border-blue-500 text-blue-600': activeTab === 'files' }"
        @click="switchTab('files')"
      >
        数据详情
      </button>
      <button
        class="px-4 py-2 border-b-2 font-medium text-sm"
        :class="{ 'border-blue-500 text-blue-600': activeTab === 'sql' }"
        @click="switchTab('sql')"
      >
        SQL查询
      </button>
    </div>

    <!-- 数据详情页 -->
    <div v-if="activeTab === 'files'" class="bg-white rounded-lg shadow p-4 mb-6">
      <h3 class="font-semibold text-lg mb-4">数据预览</h3>
      <div v-if="loadingPreview" class="flex justify-center items-center py-8">
        <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
        <span class="ml-2">加载数据中...</span>
      </div>
      <Table v-else>
        <TableHeader>
          <TableRow>
            <TableHead v-for="(column, index) in columnHeaders" :key="index">
              {{ column }}
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          <TableRow v-for="(row, rowIndex) in previewData" :key="rowIndex">
            <TableCell v-for="(column, colIndex) in columnHeaders" :key="colIndex">
              {{ row[column] }}
            </TableCell>
          </TableRow>
        </TableBody>
      </Table>
    </div>

    <!-- SQL 查询页 -->
    <div v-else-if="activeTab === 'sql'" class="bg-white rounded-lg shadow p-4 mb-6">
      <h3 class="font-semibold text-lg mb-4">SQL 查询</h3>
      <div class="flex flex-col space-y-4">
        <textarea
          v-model="sqlQuery"
          placeholder="输入 SQL 查询语句..."
          class="w-full p-3 border rounded-md h-20"
        ></textarea>
        <Button @click="executeQuery" :disabled="executingQuery">
          {{ executingQuery ? '执行中...' : '执行查询' }}
        </Button>
      </div>

      <!-- 查询结果展示 -->
      <div v-if="queryResult.length > 0" class="mt-6">
        <div class="mb-4">
          <p><strong>执行的SQL:</strong> {{ lastExecutedQuery }}</p>
          <p><strong>结果行数:</strong> {{ queryRowCount }}</p>
        </div>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead v-for="(column, index) in queryColumnHeaders" :key="index">
                {{ column }}
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            <TableRow v-for="(row, rowIndex) in queryResult" :key="rowIndex">
              <TableCell v-for="(column, colIndex) in queryColumnHeaders" :key="colIndex">
                {{ row[column] }}
              </TableCell>
            </TableRow>
          </TableBody>
        </Table>
      </div>
      <div v-else-if="lastExecutedQuery && queryResult.length === 0" class="mt-6 text-center text-gray-500">
        查询完成，但没有返回任何结果。
      </div>
    </div>

    <!-- 操作按钮 -->
    <div class="flex justify-end space-x-2">
      <Button variant="outline" @click="goBack">返回</Button>
      <Button variant="default" @click="useDataset">使用数据集</Button>
    </div>
  </Page>
</template>

<script lang="ts" setup>
import { ref, onMounted } from 'vue'
import Page from '@/components/page.vue'
import PageHeader from '@/components/page-header.vue'
import { Button } from '@/components/ui/button'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { useRouter, useRoute } from 'vue-router'

// 获取路由参数
const route = useRoute()
const router = useRouter()

// 声明响应式变量
const dataset = ref<any>(null)
const previewData = ref<any[]>([])
const columnHeaders = ref<string[]>([])
const activeTab = ref<string>('files') // 默认为 files
const sqlQuery = ref<string>('SELECT * FROM dataset LIMIT 20;')
const queryResult = ref<any[]>([])
const queryColumnHeaders = ref<string[]>([])
const lastExecutedQuery = ref<string>('')
const queryRowCount = ref<number>(0)
const loadingPreview = ref<boolean>(false)
const executingQuery = ref<boolean>(false)

// 初始化时读取 URL 参数
onMounted(() => {
  const tab = route.query.tab as string
  if (tab === 'sql') {
    activeTab.value = 'sql'
  }

  // 从路由参数获取数据集名称
  const datasetName = route.query.name as string
  
  // 从localStorage获取数据集信息
  const datasetsStr = localStorage.getItem('datasets')
  let datasets: any[] = []
  
  if (datasetsStr) {
    try {
      datasets = JSON.parse(datasetsStr)
    } catch (error) {
      console.error('解析数据集数据失败:', error)
      datasets = []
    }
  }
  
  // 查找对应的数据集
  const foundDataset = datasets.find(ds => ds.name === datasetName)
  
  if (foundDataset) {
    // 使用找到的数据集信息
    dataset.value = {
      ...foundDataset,
      chineseName: foundDataset.chineseName || '暂无中文名',
      table: foundDataset.table || foundDataset.name,
      storageLocation: foundDataset.storageLocation || '暂无存储位置信息'
    }
  } else {
    // 如果找不到数据集，使用默认值
    dataset.value = {
      name: datasetName || '未知数据集',
      chineseName: '暂无中文名',
      format: '未知',
      sampleCount: '未知',
      size: '未知',
      creator: '未知',
      createdAt: '未知',
      table: datasetName || '未知',
      storageLocation: '暂无存储位置信息'
    }
  }

  // 加载数据预览
  loadPreviewData()
})

// 加载数据预览
const loadPreviewData = async () => {
  if (!dataset.value) return
  
  loadingPreview.value = true
  
  try {
    // 根据数据集类型构建查询参数
    let queryType: 'iceberg' | 'lance'
    let queryParams: Record<string, any>
    
    // 根据数据集格式确定查询类型
    if (dataset.value.format && dataset.value.format.toLowerCase().includes('iceberg')) {
      queryType = 'iceberg'
      
      // 解析 source 字段
      let warehouse = dataset.value.warehouse || 'iceberg_catalog'
      let namespace = dataset.value.namespace || 's1'
      let table = dataset.value.table || dataset.value.name
      
      if (dataset.value.source) {
        const parts = dataset.value.source.split('.')
        if (parts.length >= 3) {
          warehouse = parts[0]
          namespace = parts[1]
          table = parts[2]
        }
      }
      
      queryParams = {
        rest_uri: 'http://172.29.119.193:19102',
        warehouse: warehouse,
        namespace: namespace,
        table: table,
        sql: `SELECT * FROM "${table}" LIMIT 10`,
        fetch_storage_from_gravitino: true,
        gravitino_uri: 'http://172.29.119.193:18090',
        metalake: dataset.value.metalake || 'lakehouse_metalake',
        gravitino_catalog: dataset.value.catalog || 'iceberg_catalog',
        skip_endpoint_check: false
      }
    } else if (dataset.value.format && dataset.value.format.toLowerCase().includes('lance')) {
      queryType = 'lance'
      
      // 解析 source 字段
      let catalog = dataset.value.catalog || 'lance_catalog'
      let namespace = dataset.value.namespace || 's1'
      let table = dataset.value.table || dataset.value.name
      
      if (dataset.value.source) {
        const parts = dataset.value.source.split('.')
        if (parts.length >= 3) {
          catalog = parts[0]
          namespace = parts[1]
          table = parts[2]
        }
      }
      
      queryParams = {
        gravitino_uri: 'http://172.29.119.193:18090',
        metalake: dataset.value.metalake || 'lakehouse_metalake',
        catalog: catalog,
        namespace: namespace,
        table: table,
        sql: `SELECT * FROM "${table}" LIMIT 10`,
        skip_endpoint_check: true
      }
    } else {
      // 默认使用iceberg查询
      queryType = 'iceberg'
      
      // 解析 source 字段
      let warehouse = dataset.value.warehouse || 'iceberg_catalog'
      let namespace = dataset.value.namespace || 's1'
      let table = dataset.value.table || dataset.value.name
      
      if (dataset.value.source) {
        const parts = dataset.value.source.split('.')
        if (parts.length >= 3) {
          warehouse = parts[0]
          namespace = parts[1]
          table = parts[2]
        }
      }
      
      queryParams = {
        rest_uri: 'http://172.29.119.193:19102',
        warehouse: warehouse,
        namespace: namespace,
        table: table,
        sql: `SELECT * FROM "${table}" LIMIT 10`,
        fetch_storage_from_gravitino: true,
        gravitino_uri: 'http://172.29.119.193:18090',
        metalake: dataset.value.metalake || 'lakehouse_metalake',
        gravitino_catalog: dataset.value.catalog || 'iceberg_catalog',
        skip_endpoint_check: false
      }
    }
    
    // 发送请求获取数据 - 使用POST方法
    const response = await $fetch('/api/sql-query-proxy', {
      method: 'POST',
      body: {
        type: queryType,
        params: queryParams
      }
    })
    
    // 处理返回的结果
    if (response && response.result) {
      // 将结果转换为表格格式
      const result = response.result
      const keys = Object.keys(result)
      
      // 检查是否有键值，避免访问 undefined
      if (keys.length === 0) {
        previewData.value = []
        return
      }
      
      // 设置列头
      columnHeaders.value = [...keys]
      
      // 转换数据格式
      const rows = []
      // 检查 keys 是否为空数组，并确保 result 中确实包含该键
      let rowCount = 0
      if (keys.length > 0 && keys[0] !== undefined && result[keys[0]] !== undefined) {
        rowCount = result[keys[0]]?.length || 0
      }
      
      for (let i = 0; i < rowCount; i++) {
        const row: any = {}
        keys.forEach(key => {
          // 添加额外的安全检查，确保 key 存在于 result 中
          if(result[key] !== undefined) {
            row[key] = result[key][i]
          } else {
            row[key] = null // 或其他默认值
          }
        })
        rows.push(row)
      }
      
      previewData.value = rows
    }
  } catch (error: any) {
    console.error('加载数据预览失败:', error)
    // 如果加载失败，显示错误信息或默认数据
    previewData.value = []
    columnHeaders.value = []
    
    // 显示用户友好的错误消息
    let errorMessage = '加载数据预览失败'
    if (error && error.data && error.data.statusMessage) {
      errorMessage += `: ${error.data.statusMessage}`
    } else if (error && error.message) {
      errorMessage += `: ${error.message}`
    }
    alert(errorMessage)
  } finally {
    loadingPreview.value = false
  }
}

// ... existing code ...

// 执行 SQL 查询
const executeQuery = async () => {
  if (!sqlQuery.value.trim()) {
    alert('请输入SQL查询语句')
    return
  }
  
  executingQuery.value = true
  
  try {
    if (!dataset.value) {
      throw new Error('数据集信息未加载')
    }
    
    // 根据数据集格式确定查询类型
    let queryType: 'iceberg' | 'lance'
    let queryParams: Record<string, any>
    
    if (dataset.value.format && dataset.value.format.toLowerCase().includes('iceberg')) {
      queryType = 'iceberg'
      
      // 解析 source 字段
      let warehouse = dataset.value.warehouse || 'iceberg_catalog'
      let namespace = dataset.value.namespace || 's1'
      let table = dataset.value.table || dataset.value.name
      
      if (dataset.value.source) {
        const parts = dataset.value.source.split('.')
        if (parts.length >= 3) {
          warehouse = parts[0]
          namespace = parts[1]
          table = parts[2]
        }
      }
      
      queryParams = {
        rest_uri: 'http://172.29.119.193:19102',
        warehouse: warehouse,
        namespace: namespace,
        table: table,
        sql: sqlQuery.value,
        fetch_storage_from_gravitino: true,
        gravitino_uri: 'http://172.29.119.193:18090',
        metalake: dataset.value.metalake || 'lakehouse_metalake',
        gravitino_catalog: dataset.value.catalog || 'iceberg_catalog',
        skip_endpoint_check: false
      }
    } else if (dataset.value.format && dataset.value.format.toLowerCase().includes('lance')) {
      queryType = 'lance'
      
      // 解析 source 字段
      let catalog = dataset.value.catalog || 'lance_catalog'
      let namespace = dataset.value.namespace || 's1'
      let table = dataset.value.table || dataset.value.name
      
      if (dataset.value.source) {
        const parts = dataset.value.source.split('.')
        if (parts.length >= 3) {
          catalog = parts[0]
          namespace = parts[1]
          table = parts[2]
        }
      }
      
      queryParams = {
        gravitino_uri: 'http://172.29.119.193:18090',
        metalake: dataset.value.metalake || 'lakehouse_metalake',
        catalog: catalog,
        namespace: namespace,
        table: table,
        sql: sqlQuery.value,
        skip_endpoint_check: true
      }
    } else {
      // 默认使用iceberg查询
      queryType = 'iceberg'
      
      // 解析 source 字段
      let warehouse = dataset.value.warehouse || 'iceberg_catalog'
      let namespace = dataset.value.namespace || 's1'
      let table = dataset.value.table || dataset.value.name
      
      if (dataset.value.source) {
        const parts = dataset.value.source.split('.')
        if (parts.length >= 3) {
          warehouse = parts[0]
          namespace = parts[1]
          table = parts[2]
        }
      }
      
      queryParams = {
        rest_uri: 'http://172.29.119.193:19102',
        warehouse: warehouse,
        namespace: namespace,
        table: table,
        sql: sqlQuery.value,
        fetch_storage_from_gravitino: true,
        gravitino_uri: 'http://172.29.119.193:18090',
        metalake: dataset.value.metalake || 'lakehouse_metalake',
        gravitino_catalog: dataset.value.catalog || 'iceberg_catalog',
        skip_endpoint_check: false
      }
    }
    
    // 发送请求执行查询 - 统一使用POST方法
    const response = await $fetch('/api/sql-query-proxy', {
      method: 'POST',
      body: {
        type: queryType,
        params: queryParams
      }
    })
    
    // 处理返回的结果
    if (response && response.result) {
      // 将结果转换为表格格式
      const result = response.result
      const keys = Object.keys(result)
      
      // 设置列头
      queryColumnHeaders.value = [...keys]
      
      // 记录查询信息
      lastExecutedQuery.value = response.query
      queryRowCount.value = response.row_count
      
      // 转换数据格式
      const rows = []
      // 检查 keys 是否为空数组，并确保 result 中确实包含该键
      let rowCount = 0
      if (keys.length > 0 && keys[0] !== undefined && result[keys[0]] !== undefined) {
        rowCount = result[keys[0]]?.length || 0
      }
      
      for (let i = 0; i < rowCount; i++) {
        const row: any = {}
        keys.forEach(key => {
          // 添加额外的安全检查，确保 key 存在于 result 中
          if(result[key] !== undefined) {
            row[key] = result[key][i]
          } else {
            row[key] = null // 或其他默认值
          }
        })
        rows.push(row)
      }
      
      queryResult.value = rows
    }
  } catch (error: any) {
    console.error('执行SQL查询失败:', error)
    let errorMessage = '执行查询失败'
    if (error && error.data && error.data.statusMessage) {
      errorMessage += `: ${error.data.statusMessage}`
    } else if (error && error.message) {
      errorMessage += `: ${error.message}`
    }
    alert(errorMessage)
  } finally {
    executingQuery.value = false
  }
}


const goBack = () => {
  router.push('/ai-datalake/lakehouse')
}

// 添加 switchTab 方法来处理标签页切换
const switchTab = (tab: string) => {
  activeTab.value = tab
  // 更新 URL 参数
  router.replace({
    query: { ...route.query, tab }
  })
}
const useDataset = () => {
  alert('正在使用数据集...')
}

</script>