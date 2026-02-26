<template>
  <Page>
    <PageHeader class="items-center">
      <h1 class="text-2xl font-bold">Lakehouse</h1>
      
      <template #description>
        <p class="text-sm text-muted-foreground mt-1">
          面向AI开发人员的多模态数据集合，为模型训练、评估或研究等场景提供数据支撑。
        </p>
      </template>

      <template #actions>
        <Button
          variant="outline"
          @click="toggleGuide"
          class="flex items-center space-x-1"
        >
          <Icon icon="mdi:help-circle-outline" class="w-4 h-4" />
          <span>{{ isGuideOpen ? '收起引导' : '展开引导' }}</span>
        </Button>
      </template>
    </PageHeader>

    <!-- 引导流程内容 -->
    <div v-if="isGuideOpen" class="mb-6 bg-white rounded-lg shadow p-4 border">
      <div class="grid grid-cols-1 md:grid-cols-3 gap-6">
        <!-- 第1步：创建数据集 -->
        <div class="text-center p-4 border rounded-lg">
          <h3 class="font-semibold text-lg">第1步<br><span class="text-sm text-gray-500">创建数据集</span></h3>
          <p class="mt-2 text-sm text-gray-600">通过指定数据所在的存储目录，创建数据集。</p>
          <div class="mt-3 flex justify-center">
            <div class="bg-gray-100 p-3 rounded-md w-32 h-20 flex items-center justify-center">
              <Icon icon="mdi:database-plus" class="w-8 h-8 text-blue-500" />
            </div>
          </div>
        </div>

        <!-- 第2步：数据加工 -->
        <div class="text-center p-4 border rounded-lg">
          <h3 class="font-semibold text-lg">第2步<br><span class="text-sm text-gray-500">数据加工</span></h3>
          <p class="mt-2 text-sm text-gray-600">快速查询和编辑，大量数据可使用工作流中的内置算子，进行批量清洗。算子 SDK</p>
          <div class="mt-3 flex justify-center">
            <div class="bg-gray-100 p-3 rounded-md w-32 h-20 flex items-center justify-center">
              <Icon icon="mdi:chart-bar" class="w-8 h-8 text-green-500" />
            </div>
          </div>
        </div>

        <!-- 第3步：使用数据集 -->
        <div class="text-center p-4 border rounded-lg">
          <h3 class="font-semibold text-lg">第3步<br><span class="text-sm text-gray-500">使用数据集</span></h3>
          <p class="mt-2 text-sm text-gray-600">调用数据集的存储路径，也可直接另存到火山方舟数据集。数据源SDK</p>
          <div class="mt-3 flex justify-center">
            <div class="bg-gray-100 p-3 rounded-md w-32 h-20 flex items-center justify-center">
              <Icon icon="mdi:cloud-download" class="w-8 h-8 text-purple-500" />
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- 主要操作区域 -->
    <div class="flex justify-between items-center mb-4">
      <Button variant="default" @click="createDataset" class="bg-blue-600 hover:bg-blue-700 text-white border-none rounded-md px-4 py-2 flex items-center">
        <Icon icon="mdi:plus" class="w-4 h-4 mr-2" />
        创建数据集
      </Button>
      <div class="flex items-center space-x-2">
        <Input placeholder="搜索数据集名称" v-model="searchQuery" class="w-64" />
        <Button variant="outline" @click="handleSearch">
          <Icon icon="mdi:magnify" class="w-4 h-4" />
        </Button>
      </div>
    </div>

    <!-- 数据表格 -->
    <div class="rounded-lg border bg-muted/30 p-4">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>数据集名称</TableHead>
            <TableHead>格式</TableHead>
            <TableHead>数据来源</TableHead>
            <TableHead>创建人</TableHead>
            <TableHead>创建时间</TableHead>
            <TableHead>更新时间</TableHead>
            <TableHead>操作</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          <TableRow v-for="dataset in paginatedDatasets" :key="dataset.id || dataset.name">
            <TableCell class="font-medium cursor-pointer hover:text-blue-600" @click="router.push(`/ai-datalake/common/detail?name=${encodeURIComponent(dataset.name)}`)">
              {{ dataset.name }}
            </TableCell>
            <TableCell>
              <Badge variant="outline">{{ dataset.format }}</Badge>
            </TableCell>
            <TableCell>{{ dataset.source }}</TableCell>
            <TableCell>{{ dataset.creator }}</TableCell>
            <TableCell>{{ dataset.createdAt }}</TableCell>
            <TableCell>{{ dataset.updatedAt }}</TableCell>
            <TableCell>
              <Button variant="link" size="sm" @click="router.push(`/ai-datalake/common/detail?name=${encodeURIComponent(dataset.name)}`)">详情</Button>
              <Button variant="link" size="sm" @click="sqlQuery(dataset)">SQL查询</Button>
              <Button variant="link" size="sm" @click="deleteDataset(dataset)">删除数据集</Button>
            </TableCell>
          </TableRow>
        </TableBody>
      </Table>
    </div>

    <!-- 分页 -->
    <div class="flex justify-end items-center mt-4 gap-2">
      <!-- 总记录数 -->
      <p class="text-sm text-muted-foreground">共 {{ total }} 条</p>
      <Separator orientation="vertical" class="h-6 mx-2" />
      <!-- 分页控件 -->
      <div class="flex items-center gap-2">
        <!-- 上一页按钮 -->
        <Button
          variant="outline"
          size="sm"
          :disabled="currentPage === 1"
          @click="currentPage = Math.max(1, currentPage - 1)"
        >
          <Icon icon="mdi:chevron-left" class="w-4 h-4 mr-1" />
          上一页
        </Button>

        <!-- 当前页码 -->
        <span class="px-3 py-1 bg-blue-100 text-blue-800 rounded-md font-medium">
          {{ currentPage }}
        </span>

        <!-- 下一页按钮 -->
        <Button
          variant="outline"
          size="sm"
          :disabled="currentPage >= Math.ceil(total / pageSize)"
          @click="currentPage = Math.min(Math.ceil(total / pageSize), currentPage + 1)"
        >
          下一页
          <Icon icon="mdi:chevron-right" class="w-4 h-4 ml-1" />
        </Button>

        <!-- 每页条数选择器 -->
        <Selector
          :options="[5, 10, 20, 50].map(n => ({ label: `${n}条/页`, value: n }))"
          v-model="pageSize"
          class="w-24"
          @update:model-value="currentPage = 1"
        />
      </div>
    </div>
  </Page>
</template>

<script lang="ts" setup>
import { ref, reactive, computed, onMounted } from 'vue'
import Page from '@/components/page.vue'
import PageHeader from '@/components/page-header.vue'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { Pagination } from '@/components/ui/pagination'
import { Icon } from '@iconify/vue'
import { useRouter } from 'vue-router'
import { Separator } from '@/components/ui/separator'
import type { Dataset } from '@/types/dataset'
import { useMessage } from '@/lib/ui/message'

const message = useMessage()
// 初始化数据集列表
const datasets = ref<Dataset[]>([])

// 检查是否有新增的数据集需要添加到列表中
const addNewDatasetFromStorage = () => {
  const newDatasetStr = localStorage.getItem('newDataset')
  if (newDatasetStr) {
    try {
      const newDataset = JSON.parse(newDatasetStr)
      // 检查是否已存在该数据集（防止重复添加）
      const existingIndex = datasets.value.findIndex(ds => ds.name === newDataset.name)
      if (existingIndex === -1) {
        datasets.value.unshift(newDataset) // 添加到列表开头
        saveDatasetsToStorage() // 保存到localStorage
        total.value = datasets.value.length // 更新总数
      } else {
        //alert(`已存在同名数据集 "${newDataset.name}"，请使用其他名称`)
      }
      // 清除存储的数据
      localStorage.removeItem('newDataset')
    } catch (error) {
      console.error('解析新数据集数据失败:', error)
    }
  }
}

// 从localStorage加载数据集
const loadDatasetsFromStorage = () => {
  const datasetsStr = localStorage.getItem('datasets')
  if (datasetsStr) {
    try {
      datasets.value = JSON.parse(datasetsStr)
    } catch (error) {
      console.error('解析数据集数据失败:', error)
      datasets.value = [] // 如果解析失败，则使用空数组
    }
  } else {
    // 如果没有存储的数据集，使用初始模拟数据
    datasets.value = [
      {
        id: '1',
        name: 'ds_public',
        format: 'Lance',
        source: '',
        size: '2.79 MB',
        creator: 'SYSTEM',
        createdAt: '2025-04-12 15:45:04',
        updatedAt: '2025-11-25 23:00:00'
      }
    ]
  }
  total.value = datasets.value.length
}

// 保存数据集到localStorage
const saveDatasetsToStorage = () => {
  localStorage.setItem('datasets', JSON.stringify(datasets.value))
  total.value = datasets.value.length
}

// 页面加载时加载所有数据集
onMounted(() => {
  loadDatasetsFromStorage()
  addNewDatasetFromStorage() // 检查是否有新增数据集
})

// 搜索和分页相关
const searchQuery = ref('')
const currentPage = ref(1)
const pageSize = ref(10)
const total = ref(0)

// 计算属性：分页后的数据集
const paginatedDatasets = computed(() => {
  const startIndex = (currentPage.value - 1) * pageSize.value
  const endIndex = startIndex + pageSize.value
  return datasets.value.slice(startIndex, endIndex)
})

// 引导面板状态
const isGuideOpen = ref(false)

const toggleGuide = () => {
  isGuideOpen.value = !isGuideOpen.value
}

const router = useRouter()

const createDataset = () => {
  // 创建数据集逻辑
  router.push('/ai-datalake/common/create')
}

const handleSearch = () => {
  // 搜索逻辑
  console.log('搜索:', searchQuery.value)
}

const viewDetails = (dataset: any) => {
  console.log('查看详情:', dataset)
}

const sqlQuery = (dataset: any) => {
  console.log('SQL查询:', dataset)
}

// 添加删除数据集的方法
const deleteDataset = async (dataset: any) => {
  if (window.confirm(`确定要删除数据集 "${dataset.name}" 吗？此操作不可恢复。`)) {
    try {
      // 从localStorage中移除该数据集
      let existingDatasets: any[] = []
      const datasetsStr = localStorage.getItem('datasets')
      if (datasetsStr) {
        existingDatasets = JSON.parse(datasetsStr)
      }
      
      // 过滤掉要删除的数据集
      const updatedDatasets = existingDatasets.filter((d: any) => d.name !== dataset.name)
      
      // 更新localStorage
      localStorage.setItem('datasets', JSON.stringify(updatedDatasets))
      
      // 更新本地数据
      datasets.value = updatedDatasets
      total.value = updatedDatasets.length
      
      // 显示成功消息
      message.success(`数据集 "${dataset.name}" 已成功删除`)
    } catch (error) {
      console.error('删除数据集失败:', error)
      message.error('删除数据集失败')
    }
  }
}


</script>

<style scoped>
/* 引导面板样式 */
.guide-panel {
  background-color: #f9fafb;
  border-radius: 8px;
  padding: 1rem;
  margin-bottom: 1rem;
}

.guide-step {
  text-align: center;
  padding: 1rem;
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  margin-bottom: 1rem;
}

.guide-step img {
  max-width: 100%;
  height: auto;
}
</style>