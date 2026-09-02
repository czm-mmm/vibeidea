<script setup lang="ts">
// 波浪卡面：按 Oink 国际版官方版式还原——
// 白边 + 双色波浪（两色对应两端数字色）；
// 超大数字在左上；黑色圆角小牌（另一端数字）在其正下方；
// 顶部居中表演者姓名，底部倒印同一姓名（翻转后正好可读）；
// 右侧节目小图标。整张牌翻转显示时整体旋转 180°，与实体牌一致。
import { computed } from 'vue'
import type { Card } from '@/core/types'
import { NUMBER_COLOR_VARS, ACT_ICONS, performerName } from '@/ui/art'

const props = withDefaults(
  defineProps<{
    card: Card
    /** 显示哪一端（默认 top；预览翻转时传 bottom，整卡旋转 180°） */
    face?: 'top' | 'bottom'
    width?: number
    selected?: boolean
    hint?: 'run' | 'group' | null
    dim?: boolean
  }>(),
  { face: 'top', width: 64, selected: false, hint: null, dim: false },
)

const big = computed(() => props.card[props.face])
const small = computed(() => (props.face === 'top' ? props.card.bottom : props.card.top))
const leftColor = computed(() => NUMBER_COLOR_VARS[big.value])
const rightColor = computed(() => NUMBER_COLOR_VARS[small.value])
const height = computed(() => Math.round(props.width * 1.4))
const icon = computed(() => ACT_ICONS[big.value])
const name = computed(() => performerName(props.card.top, props.card.bottom))
// 整数像素字号：小尺寸下文字发虚主要来自小数 px 与柔光阴影
const bigSize = computed(() => Math.round(props.width * 0.52))
const tabSize = computed(() => Math.max(9, Math.round(props.width * 0.19)))
const nameSize = computed(() => Math.max(7, Math.round(props.width * 0.12)))
const iconSize = computed(() => Math.round(props.width * 0.22))
</script>

<template>
  <div
    class="card-face"
    :class="{ selected, dim, [`hint-${hint}`]: hint }"
    :style="{ width: `${width}px`, height: `${height}px` }"
  >
    <div class="inner" :class="{ flipped: face === 'bottom' }">
      <svg viewBox="0 0 100 140" preserveAspectRatio="none" class="wave-bg" aria-hidden="true">
        <rect x="0" y="0" width="100" height="140" rx="9" fill="var(--cream)" />
        <clipPath id="rr">
          <rect x="4.5" y="4.5" width="91" height="131" rx="6.5" />
        </clipPath>
        <g clip-path="url(#rr)">
          <rect x="4.5" y="4.5" width="91" height="131" :fill="leftColor" />
          <path d="M4.5 4.5 C 40 40, 60 100, 95.5 135.5 V 4.5 Z" :fill="rightColor" opacity="0.92" />
          <path d="M4.5 4.5 C 40 40, 60 100, 95.5 135.5" fill="none" stroke="var(--cream)" stroke-width="5" />
        </g>
      </svg>
      <span class="p-name top" :style="{ fontSize: `${nameSize}px` }">{{ name }}</span>
      <span class="big-num" :style="{ fontSize: `${bigSize}px` }">{{ big }}</span>
      <span class="alt-tab" :style="{ fontSize: `${tabSize}px` }">{{ small }}</span>
      <span class="act" aria-hidden="true">
        <svg :width="iconSize" :height="iconSize" viewBox="0 0 24 24" fill="none" stroke="var(--cream)" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
          <path :d="icon" />
        </svg>
      </span>
      <span class="p-name bottom" :style="{ fontSize: `${nameSize}px` }">{{ name }}</span>
    </div>
  </div>
</template>

<style scoped>
.card-face {
  position: relative;
  flex: none;
  border-radius: var(--radius-card);
  filter: drop-shadow(0 2px 3px rgba(0, 0, 0, 0.35));
  transition:
    transform var(--dur-mid) var(--ease-pop),
    box-shadow var(--dur-mid),
    filter var(--dur-mid);
  user-select: none;
  /* 点击交给父级 .card-slot / 按钮，避免内部 SVG 拦截 */
  pointer-events: none;
}
.inner {
  position: absolute;
  inset: 0;
  border-radius: var(--radius-card);
  overflow: hidden;
}
.inner.flipped {
  transform: rotate(180deg);
}
.wave-bg {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  shape-rendering: geometricPrecision;
}
.p-name {
  position: absolute;
  left: 50%;
  transform: translateX(-50%);
  font-family: var(--font-ui);
  font-style: italic;
  color: var(--cream);
  letter-spacing: 0.03em;
  text-shadow: 1px 1px 0 rgba(0, 0, 0, 0.4);
  -webkit-font-smoothing: antialiased;
  line-height: 1;
  max-width: 84%;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.p-name.top {
  top: 4.5%;
}
.p-name.bottom {
  bottom: 4.5%;
  transform: translateX(-50%) rotate(180deg);
}
.big-num {
  position: absolute;
  left: 8%;
  top: 13%;
  font-family: var(--font-num);
  color: var(--cream);
  /* 硬边偏移阴影，不发虚 */
  text-shadow: 1.5px 1.5px 0 rgba(0, 0, 0, 0.32);
  line-height: 0.95;
  letter-spacing: -0.03em;
  -webkit-font-smoothing: antialiased;
}
.alt-tab {
  position: absolute;
  left: 8%;
  top: 56%;
  min-width: 24%;
  padding: 2.5% 5.5%;
  box-sizing: border-box;
  background: var(--ink);
  color: var(--cream);
  border-radius: 999px;
  font-family: var(--font-num);
  text-align: center;
  line-height: 1.2;
  -webkit-font-smoothing: antialiased;
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.3);
}
.act {
  position: absolute;
  right: 8%;
  top: 38%;
  color: var(--cream);
  opacity: 0.95;
  filter: drop-shadow(1px 1px 0 rgba(0, 0, 0, 0.35));
}
.card-face.selected {
  transform: translateY(-12%) scale(1.06);
  z-index: 5;
  box-shadow: 0 0 0 3px var(--gold), 0 8px 16px rgba(0, 0, 0, 0.4);
}
.card-face.dim {
  filter: drop-shadow(0 2px 3px rgba(0, 0, 0, 0.35)) brightness(0.75) saturate(0.7);
}
.card-face.hint-run {
  box-shadow: 0 0 0 2.5px var(--teal);
}
.card-face.hint-group {
  box-shadow: 0 0 0 2.5px var(--purple);
}
</style>
