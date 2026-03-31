<template>
  <Modal v-model="visible" :title="t('Create Directory')" size="sm">
    <form class="space-y-4" @submit.prevent="handleSubmit">
      <div class="space-y-2">
        <label class="text-sm font-medium">{{ t('Directory Name') }}</label>
        <Input v-model="dirName" :placeholder="t('Enter directory name')" />
        <p v-if="errorMsg" class="text-sm text-destructive">{{ errorMsg }}</p>
      </div>
    </form>
    <template #footer>
      <Button variant="outline" @click="visible = false">{{ t('Cancel') }}</Button>
      <Button :disabled="submitting || !dirName.trim()" @click="handleSubmit">
        <Spinner v-if="submitting" class="mr-2 size-4" />
        {{ t('Create') }}
      </Button>
    </template>
  </Modal>
</template>

<script setup lang="ts">
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Spinner } from '@/components/ui/spinner'
import Modal from '@/components/modal.vue'
import { ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useFilesystem } from '~/composables/useFilesystem'

const { t } = useI18n()
const message = useMessage()
const { createDirectory } = useFilesystem()

const visible = defineModel<boolean>({ default: false })
const emit = defineEmits<{ created: [] }>()

const dirName = ref('')
const errorMsg = ref('')
const submitting = ref(false)

watch(visible, v => {
  if (v) {
    dirName.value = ''
    errorMsg.value = ''
  }
})

async function handleSubmit() {
  const name = dirName.value.trim()
  if (!name) return
  submitting.value = true
  errorMsg.value = ''
  try {
    await createDirectory(name)
    message.success(t('Directory created'))
    visible.value = false
    emit('created')
  } catch (err: any) {
    errorMsg.value = err?.data?.statusMessage || err?.message || t('Failed to create directory')
  } finally {
    submitting.value = false
  }
}
</script>
