// 视口断点：≥900px 视为横版（桌面 / 平板横屏），其余为竖版单手布局
import { ref } from 'vue'

const wide = ref(false)
let bound = false

function update() {
  wide.value = window.innerWidth >= 900
}

/** 全局单例监听，避免每个组件重复挂 resize */
export function useIsWide() {
  if (!bound) {
    bound = true
    update()
    window.addEventListener('resize', update)
  }
  return wide
}
