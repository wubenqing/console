<script setup lang="ts">
import { SwitchRoot, SwitchThumb } from 'reka-ui'
import { computed, type HTMLAttributes } from 'vue'
import { cn } from '@/lib/utils'

const props = defineProps<{
  class?: HTMLAttributes['class']
  modelValue?: boolean
  checked?: boolean
  disabled?: boolean
  required?: boolean
  name?: string
  id?: string
  asChild?: boolean
}>()

const emits = defineEmits<{
  'update:modelValue': [payload: boolean]
  'update:checked': [payload: boolean]
}>()

// SwitchRoot uses modelValue, not checked
// We need to map checked/modelValue props to SwitchRoot's modelValue
const switchValue = computed({
  get() {
    // Priority: checked > modelValue > false
    return props.checked ?? props.modelValue ?? false
  },
  set(val: boolean) {
    // Emit both events for compatibility
    emits('update:checked', val)
    emits('update:modelValue', val)
  }
})
</script>

<template>
  <SwitchRoot
    v-model:modelValue="switchValue"
    :disabled="props.disabled"
    :required="props.required"
    :name="props.name"
    :id="props.id"
    :as-child="props.asChild"
    :class="
      cn(
        'peer inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:cursor-not-allowed disabled:opacity-50 data-[state=checked]:bg-blue-600 data-[state=unchecked]:bg-slate-300',
        props.class
      )
    "
  >
    <SwitchThumb
      :class="
        cn(
          'pointer-events-none block h-5 w-5 rounded-full bg-background shadow-lg ring-0 transition-transform data-[state=checked]:translate-x-5'
        )
      "
    >
      <slot name="thumb" />
    </SwitchThumb>
  </SwitchRoot>
</template>
