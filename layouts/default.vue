<script setup lang="ts">
import AppSidebar from '@/components/app-sidebar.vue'
import { SidebarInset, SidebarProvider } from '@/components/ui/sidebar'
import { computed } from 'vue'
import { useRoute } from 'vue-router'

const route = useRoute()
const showSidebar = computed(() => !route.path.startsWith('/auth'))
</script>

<template>
  <SidebarProvider v-if="showSidebar">
    <AppSidebar />
    <SidebarInset class="min-w-0 overflow-x-hidden">
      <div class="flex w-full min-w-0 max-w-screen-2xl flex-1 flex-col gap-4 p-6 pt-0 mx-auto overflow-x-hidden">
        <AppTopNav />
        <slot />
      </div>
    </SidebarInset>
  </SidebarProvider>
  <div v-else class="min-h-screen bg-background">
    <slot />
  </div>
</template>
