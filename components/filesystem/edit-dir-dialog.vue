<template>
  <Modal v-model="visible" :title="dirEntry?.name ?? ''" size="xl">
    <div v-if="loading" class="flex items-center justify-center py-8">
      <Spinner class="size-6" />
    </div>
    <div v-else-if="dirEntry" class="space-y-6">
      <!-- Directory info -->
      <div class="grid grid-cols-2 gap-3 rounded-md border bg-muted/30 p-4 text-sm">
        <div class="space-y-0.5">
          <div class="text-xs text-muted-foreground">{{ t('Created') }}</div>
          <div class="font-medium">{{ dirEntry.createdAt }}</div>
        </div>
        <div class="space-y-0.5">
          <div class="text-xs text-muted-foreground">{{ t('Mount Source') }}</div>
          <div class="break-all font-medium">{{ dirEntry.mountSource }}</div>
        </div>
      </div>

      <!-- Mount records table -->
      <div class="space-y-3">
        <h3 class="text-sm font-semibold">{{ t('Mount Records') }}</h3>
        <div
          v-if="dirEntry.mounts.length === 0"
          class="rounded-md border p-6 text-center text-sm text-muted-foreground"
        >
          {{ t('No mount records') }}
        </div>
        <div v-else class="overflow-auto rounded-md border">
          <table class="w-full text-sm">
            <thead class="bg-muted/50">
              <tr>
                <th class="px-3 py-2 text-left text-xs font-medium text-muted-foreground">{{ t('Host') }}</th>
                <th class="px-3 py-2 text-left text-xs font-medium text-muted-foreground">{{ t('Mount Path') }}</th>
                <th class="px-3 py-2 text-left text-xs font-medium text-muted-foreground">{{ t('Status') }}</th>
                <th class="px-3 py-2 text-left text-xs font-medium text-muted-foreground">{{ t('Mounted At') }}</th>
                <th class="px-3 py-2 text-left text-xs font-medium text-muted-foreground">{{ t('Actions') }}</th>
              </tr>
            </thead>
            <tbody class="divide-y">
              <tr v-for="(m, i) in dirEntry.mounts" :key="i" class="hover:bg-muted/30">
                <td class="px-3 py-2">{{ m.host }}</td>
                <td class="px-3 py-2 font-mono text-xs">{{ m.mountPath }}</td>
                <td class="px-3 py-2">
                  <span
                    :class="m.status === 'mounted' ? 'text-green-600 font-medium' : 'text-yellow-600 font-medium'"
                    >{{ getMountStatusLabel(m.status) }}</span
                  >
                </td>
                <td class="px-3 py-2 text-muted-foreground">{{ m.mountedAt }}</td>
                <td class="px-3 py-2">
                  <Button
                    size="sm"
                    variant="outline"
                    :disabled="unmounting === `${m.host}:${m.mountPath}`"
                    @click="handleUnmount(m)"
                  >
                    <Spinner v-if="unmounting === `${m.host}:${m.mountPath}`" class="mr-1 size-3" />
                    {{ t('Dismount') }}
                  </Button>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <!-- Add mount form -->
      <div class="space-y-4 rounded-md border p-4">
        <h3 class="text-sm font-semibold">{{ t('Add Mount') }}</h3>
        <div class="grid grid-cols-2 gap-4">
          <div class="space-y-1.5">
            <label class="text-sm font-medium">{{ t('Host Address') }}</label>
            <Input v-model="newHost" placeholder="10.0.0.12" />
          </div>
          <div class="space-y-1.5">
            <label class="text-sm font-medium">{{ t('Mount Path') }}</label>
            <Input v-model="newMountPath" placeholder="/mnt/remote-kvcache" />
          </div>
        </div>
        <div class="flex items-center gap-3">
          <Button :disabled="mounting || !newHost.trim() || !newMountPath.trim()" @click="handleMount">
            <Spinner v-if="mounting" class="mr-2 size-4" />
            {{ t('Mount') }}
          </Button>
          <p v-if="mountError" class="text-sm text-destructive">{{ mountError }}</p>
        </div>
      </div>
    </div>
    <template #footer>
      <Button variant="outline" @click="visible = false">{{ t('Close') }}</Button>
    </template>
  </Modal>
</template>

<script setup lang="ts">
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Spinner } from '@/components/ui/spinner'
import Modal from '@/components/modal.vue'
import type { DirectoryEntry, MountRecord } from '~/types/filesystem'
import { ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useFilesystem } from '~/composables/useFilesystem'

const { t } = useI18n()
const message = useMessage()

function getMountStatusLabel(status: string): string {
  if (status === 'mounted') return t('Mounted')
  return t('Unmounted')
}
const { getDirectory, mountDirectory, unmountDirectory } = useFilesystem()

const visible = defineModel<boolean>({ default: false })
const props = defineProps<{ dirName: string }>()
const emit = defineEmits<{ updated: [] }>()

const dirEntry = ref<DirectoryEntry | null>(null)
const loading = ref(false)

// Mount form state
const newHost = ref('')
const newMountPath = ref('')
const mounting = ref(false)
const mountError = ref('')
const unmounting = ref('')

watch(
  () => [visible.value, props.dirName] as const,
  async ([v, name]) => {
    if (v && name) {
      await loadDirectory(name)
    }
  }
)

async function loadDirectory(name: string) {
  loading.value = true
  try {
    dirEntry.value = await getDirectory(name)
  } catch {
    dirEntry.value = null
  } finally {
    loading.value = false
  }
}

async function handleMount() {
  const host = newHost.value.trim()
  const mountPath = newMountPath.value.trim()
  if (!host || !mountPath || !props.dirName) return

  mounting.value = true
  mountError.value = ''
  try {
    dirEntry.value = await mountDirectory(props.dirName, host, mountPath)
    newHost.value = ''
    newMountPath.value = ''
    message.success(t('Mount successful'))
    emit('updated')
  } catch (err: any) {
    mountError.value = err?.data?.statusMessage || err?.message || t('Mount failed')
  } finally {
    mounting.value = false
  }
}

async function handleUnmount(m: MountRecord) {
  const key = `${m.host}:${m.mountPath}`
  unmounting.value = key
  try {
    dirEntry.value = await unmountDirectory(props.dirName, m.host, m.mountPath)
    message.success(t('Dismount successful'))
    emit('updated')
  } catch (err: any) {
    message.error(err?.data?.statusMessage || err?.message || t('Dismount failed'))
  } finally {
    unmounting.value = ''
  }
}
</script>
