import { mount, type ComponentMountingOptions, type VueWrapper } from '@vue/test-utils'
import { TooltipProvider } from 'reka-ui'
import { defineComponent, h, type Component } from 'vue'

export function mountWithProviders<C extends Component>(component: C, options: ComponentMountingOptions<C> = {}) {
  const { props, slots, ...rest } = options as { props?: Record<string, unknown>; slots?: Record<string, unknown> }
  const host = defineComponent({
    setup: () => () => h(TooltipProvider, { delayDuration: 0 }, () => h(component, props ?? {}, slots ?? {})),
  })
  return mount(host, rest as ComponentMountingOptions<typeof host>).findComponent(component as never) as unknown as VueWrapper
}
