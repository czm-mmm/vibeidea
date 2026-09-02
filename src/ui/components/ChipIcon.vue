<script setup lang="ts">
// 筹码：S 金币（VP 筹码）与 星形分数筹码，还原原版组件
withDefaults(defineProps<{ kind: 'scout' | 'star' | 'star-neg'; size?: number }>(), { size: 22 })
</script>

<template>
  <svg v-if="kind === 'scout'" :width="size" :height="size" viewBox="0 0 40 40" aria-hidden="true">
    <circle cx="20" cy="20" r="18.5" fill="#e9b23c" stroke="#b9831f" stroke-width="2" />
    <circle cx="20" cy="20" r="13" fill="none" stroke="#b9831f" stroke-width="1.4" stroke-dasharray="2.5 2" />
    <text x="20" y="26.5" text-anchor="middle" font-family="Georgia, serif" font-weight="bold" font-size="17" fill="#7a5510">S</text>
  </svg>
  <svg v-else :width="size" :height="size" viewBox="0 0 40 40" aria-hidden="true">
    <path
      d="M20 2.5l4.9 10.2 11.3 1.5-8.3 7.7 2.1 11.1L20 27.6l-10 5.4 2.1-11.1-8.3-7.7 11.3-1.5z"
      :fill="kind === 'star' ? '#7b61ff' : '#e7e2d5'"
      :stroke="kind === 'star' ? '#5a43cc' : '#b9b2a0'"
      stroke-width="1.6"
    />
    <text x="20" y="26" text-anchor="middle" font-family="Georgia, serif" font-weight="bold" font-size="14" :fill="kind === 'star' ? '#fff' : '#8a8474'">1</text>
  </svg>
</template>
