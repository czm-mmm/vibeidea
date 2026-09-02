<script setup lang="ts">
// 牌背：紫色放射纹 + 大 S（还原原版牌背），用于 AI 手牌计数
import { computed } from 'vue'

const props = withDefaults(defineProps<{ width?: number }>(), { width: 40 })
const h = computed(() => Math.round(props.width * 1.4))
</script>

<template>
  <div class="card-back" :style="{ width: `${width}px`, height: `${h}px` }" aria-hidden="true">
    <svg viewBox="0 0 100 140" preserveAspectRatio="none" class="bg">
      <defs>
        <radialGradient id="bg-grad" cx="50%" cy="42%" r="75%">
          <stop offset="0%" stop-color="#8a6fd0" />
          <stop offset="100%" stop-color="#5a3f96" />
        </radialGradient>
      </defs>
      <rect x="0" y="0" width="100" height="140" rx="9" fill="var(--cream)" />
      <rect x="4.5" y="4.5" width="91" height="131" rx="6.5" fill="url(#bg-grad)" />
      <g stroke="#ffffff" stroke-opacity="0.22" stroke-width="2">
        <path d="M50 55 L50 -30 M50 55 L112 28 M50 55 L112 82 M50 55 L50 140 M50 55 L-12 28 M50 55 L-12 82 M50 55 L14 -12 M50 55 L86 -12 M50 55 L14 122 M50 55 L86 122" />
      </g>
      <text x="50" y="82" text-anchor="middle" font-family="Georgia, serif" font-weight="bold" font-size="64" fill="var(--white)" opacity="0.95">S</text>
    </svg>
  </div>
</template>

<style scoped>
.card-back {
  position: relative;
  flex: none;
  border-radius: var(--radius-card);
  filter: drop-shadow(0 2px 3px rgba(0, 0, 0, 0.35));
  pointer-events: none;
}
.bg {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
}
</style>
