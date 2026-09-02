<script setup lang="ts">
// 马戏团角色头像：奶油脸 + 扁平马戏色圆底，与卡面美术同一套语言
import { computed } from 'vue'
import { avatarMeta, type AvatarId } from '@/ui/avatars'

const props = withDefaults(defineProps<{ id: AvatarId | string; size?: number }>(), { size: 34 })
const bg = computed(() => avatarMeta(props.id).bg)
</script>

<template>
  <svg :width="size" :height="size" viewBox="0 0 64 64" aria-hidden="true">
    <circle cx="32" cy="32" r="30" :fill="bg" />
    <circle cx="32" cy="32" r="30" fill="none" stroke="rgba(0,0,0,0.25)" stroke-width="2.5" />

    <!-- 小丑：蓝发团 + 红鼻头 -->
    <g v-if="id === 'clown'">
      <circle cx="15" cy="27" r="7" fill="#3e7cc0" />
      <circle cx="49" cy="27" r="7" fill="#3e7cc0" />
      <circle cx="20" cy="21" r="6" fill="#3e7cc0" />
      <circle cx="44" cy="21" r="6" fill="#3e7cc0" />
      <ellipse cx="32" cy="37" rx="15" ry="14" fill="var(--cream)" />
      <circle cx="26" cy="34" r="2.2" fill="var(--ink)" />
      <circle cx="38" cy="34" r="2.2" fill="var(--ink)" />
      <circle cx="32" cy="40" r="4.6" fill="#d9432f" />
      <path d="M24 45 Q32 52 40 45" fill="none" stroke="#d9432f" stroke-width="3" stroke-linecap="round" />
    </g>

    <!-- 魔术师：高礼帽 + 单片镜 + 八字胡 -->
    <g v-else-if="id === 'magician'">
      <ellipse cx="32" cy="38" rx="15" ry="14" fill="var(--cream)" />
      <rect x="23" y="4" width="18" height="15" rx="2" fill="var(--ink)" />
      <rect x="23" y="13" width="18" height="4" fill="#e9b23c" />
      <rect x="18" y="18" width="28" height="5" rx="2.5" fill="var(--ink)" />
      <circle cx="26" cy="36" r="2.2" fill="var(--ink)" />
      <circle cx="39" cy="36" r="2.2" fill="var(--ink)" />
      <circle cx="39" cy="36" r="5" fill="none" stroke="#e9b23c" stroke-width="2" />
      <path d="M39 41 V48" stroke="#e9b23c" stroke-width="2" stroke-linecap="round" />
      <path d="M32 44 Q26 40 21 44 M32 44 Q38 40 43 44" fill="none" stroke="var(--ink)" stroke-width="2.6" stroke-linecap="round" />
      <path d="M27 55 L32 51 L37 55 L32 58 Z" fill="#d9432f" />
    </g>

    <!-- 团长：黑礼帽金带 + 卷翘大胡子 + 红燕尾领 -->
    <g v-else-if="id === 'ringmaster'">
      <ellipse cx="32" cy="38" rx="15" ry="14" fill="var(--cream)" />
      <rect x="24" y="6" width="16" height="13" rx="2" fill="var(--ink)" />
      <rect x="24" y="14" width="16" height="3.5" fill="#e9b23c" />
      <rect x="20" y="18" width="24" height="4.5" rx="2.2" fill="var(--ink)" />
      <circle cx="26" cy="36" r="2.2" fill="var(--ink)" />
      <circle cx="38" cy="36" r="2.2" fill="var(--ink)" />
      <path d="M32 43 Q24 38 17 43 Q22 46 27 45 M32 43 Q40 38 47 43 Q42 46 37 45" fill="var(--ink)" />
      <path d="M18 56 Q32 46 46 56 L46 60 L18 60 Z" fill="var(--ink)" />
      <path d="M28 55 L32 59 L36 55" fill="none" stroke="var(--cream)" stroke-width="2" />
    </g>

    <!-- 猛狮：深金鬃毛 -->
    <g v-else-if="id === 'lion'">
      <circle cx="32" cy="33" r="23" fill="#c9831f" />
      <circle cx="13" cy="24" r="6" fill="#c9831f" />
      <circle cx="51" cy="24" r="6" fill="#c9831f" />
      <circle cx="17" cy="45" r="6" fill="#c9831f" />
      <circle cx="47" cy="45" r="6" fill="#c9831f" />
      <ellipse cx="32" cy="36" rx="15" ry="14" fill="var(--cream)" />
      <circle cx="26" cy="33" r="2.2" fill="var(--ink)" />
      <circle cx="38" cy="33" r="2.2" fill="var(--ink)" />
      <path d="M29 40 L35 40 L32 44 Z" fill="var(--ink)" />
      <path d="M32 44 V47 M32 47 Q28 50 25 47 M32 47 Q36 50 39 47" fill="none" stroke="var(--ink)" stroke-width="2.2" stroke-linecap="round" />
    </g>

    <!-- 大象：大耳朵 + 卷鼻子 -->
    <g v-else-if="id === 'elephant'">
      <circle cx="12" cy="31" r="11" fill="var(--cream-dim)" />
      <circle cx="52" cy="31" r="11" fill="var(--cream-dim)" />
      <circle cx="12" cy="31" r="6" fill="#b0c4de" />
      <circle cx="52" cy="31" r="6" fill="#b0c4de" />
      <ellipse cx="32" cy="36" rx="15" ry="14" fill="var(--cream)" />
      <circle cx="26" cy="34" r="2.2" fill="var(--ink)" />
      <circle cx="38" cy="34" r="2.2" fill="var(--ink)" />
      <path d="M32 41 V48 Q32 53 27 53" fill="none" stroke="#b0c4de" stroke-width="6" stroke-linecap="round" />
      <circle cx="27" cy="53" r="1.6" fill="var(--ink)" />
    </g>

    <!-- 猴子：桃心脸 + 圆耳朵 -->
    <g v-else-if="id === 'monkey'">
      <circle cx="13" cy="33" r="9" fill="var(--cream)" />
      <circle cx="51" cy="33" r="9" fill="var(--cream)" />
      <circle cx="13" cy="33" r="4.5" fill="var(--cream-dim)" />
      <circle cx="51" cy="33" r="4.5" fill="var(--cream-dim)" />
      <circle cx="24" cy="27" r="9" fill="var(--cream)" />
      <circle cx="40" cy="27" r="9" fill="var(--cream)" />
      <ellipse cx="32" cy="40" rx="14" ry="11" fill="var(--cream)" />
      <circle cx="26" cy="32" r="2.2" fill="var(--ink)" />
      <circle cx="38" cy="32" r="2.2" fill="var(--ink)" />
      <circle cx="29" cy="41" r="1.4" fill="var(--ink)" />
      <circle cx="35" cy="41" r="1.4" fill="var(--ink)" />
      <path d="M27 46 Q32 50 37 46" fill="none" stroke="var(--ink)" stroke-width="2.4" stroke-linecap="round" />
    </g>

    <!-- 白兔：长耳朵 + 粉鼻子 -->
    <g v-else-if="id === 'rabbit'">
      <rect x="21" y="4" width="8" height="24" rx="4" fill="var(--cream)" />
      <rect x="35" y="4" width="8" height="24" rx="4" fill="var(--cream)" />
      <rect x="23.5" y="8" width="3" height="16" rx="1.5" fill="#f2b8c6" />
      <rect x="37.5" y="8" width="3" height="16" rx="1.5" fill="#f2b8c6" />
      <ellipse cx="32" cy="39" rx="15" ry="14" fill="var(--cream)" />
      <circle cx="26" cy="36" r="2.2" fill="var(--ink)" />
      <circle cx="38" cy="36" r="2.2" fill="var(--ink)" />
      <path d="M29 42 L35 42 L32 45.5 Z" fill="#e88aa4" />
      <path d="M32 45.5 V48 M32 48 Q28 51 25 48 M32 48 Q36 51 39 48" fill="none" stroke="var(--ink)" stroke-width="2.2" stroke-linecap="round" />
    </g>

    <!-- 明星：金bowtie + 脸颊红星 -->
    <g v-else>
      <ellipse cx="32" cy="38" rx="15" ry="14" fill="var(--cream)" />
      <path d="M32 20 Q34 25 39 25 Q34 27 33 32 Q32 27 27 26 Q31 25 32 20 Z" fill="#e9b23c" transform="translate(-11,4) scale(0.9)" />
      <circle cx="26" cy="35" r="2.2" fill="var(--ink)" />
      <circle cx="38" cy="35" r="2.2" fill="var(--ink)" />
      <path d="M41 42 L42.2 44.6 L45 45 L43 47 L43.5 49.8 L41 48.5 L38.5 49.8 L39 47 L37 45 L39.8 44.6 Z" fill="#d9432f" transform="scale(0.62) translate(24,26)" />
      <path d="M28 46 Q32 49 36 46" fill="none" stroke="var(--ink)" stroke-width="2.4" stroke-linecap="round" />
      <path d="M24 55 L32 50 L40 55 L32 60 Z" fill="#e9b23c" />
    </g>
  </svg>
</template>
