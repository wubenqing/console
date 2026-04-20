import { defineComponent } from 'vue'

export const Icon = defineComponent({
  name: 'Icon',
  props: {
    name: {
      type: String,
      default: '',
    },
  },
  template: '<span :data-icon="name"><slot /></span>',
})
