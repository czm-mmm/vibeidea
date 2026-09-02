<script setup lang="ts">
// Oink 国际版的牌只有一个数字面（背面是紫色 S）。
// 数字面上下各有一套相差 180° 的完整阅读区：大数字是当前值，
// 黑色标签内是旋转后的值。这里同时绘制两端，不把另一端当成“牌背”。
import { computed, useId } from 'vue'
import type { Card } from '@/core/types'
import { NUMBER_COLOR_VARS, ACT_ICONS, performerName } from '@/ui/art'

const props = withDefaults(
  defineProps<{
    card: Card
    /** 哪一端位于牌面上方；常规渲染由 Card.top 决定 */
    face?: 'top' | 'bottom'
    width?: number
    selected?: boolean
    hint?: 'run' | 'group' | null
    dim?: boolean
  }>(),
  { face: 'top', width: 64, selected: false, hint: null, dim: false },
)

const topValue = computed(() => props.card[props.face])
const bottomValue = computed(() => (props.face === 'top' ? props.card.bottom : props.card.top))
const topColor = computed(() => NUMBER_COLOR_VARS[topValue.value])
const bottomColor = computed(() => NUMBER_COLOR_VARS[bottomValue.value])
const height = computed(() => Math.round(props.width * 1.4))
const topIcon = computed(() => ACT_ICONS[topValue.value])
const bottomIcon = computed(() => ACT_ICONS[bottomValue.value])
const name = computed(() => performerName(props.card.top, props.card.bottom))
const clipId = `card-clip-${useId().replace(/:/g, '')}`

// 整数像素字号：小尺寸下文字发虚主要来自小数 px 与柔光阴影
const bigSize = computed(() => Math.round(props.width * 0.44))
const tabSize = computed(() => Math.max(8, Math.round(props.width * 0.17)))
const nameSize = computed(() => Math.max(6, Math.round(props.width * 0.105)))
const iconSize = computed(() => Math.round(props.width * 0.18))
</script>

<template>
  <div
    class="card-face"
    :class="{ selected, dim, [`hint-${hint}`]: hint }"
    :style="{ width: `${width}px`, height: `${height}px` }"
  >
    <div class="inner">
      <svg viewBox="0 0 100 140" preserveAspectRatio="none" class="wave-bg" aria-hidden="true">
        <rect x="0" y="0" width="100" height="140" rx="9" fill="var(--cream)" />
        <clipPath :id="clipId">
          <rect x="4.5" y="4.5" width="91" height="131" rx="6.5" />
        </clipPath>
        <g :clip-path="`url(#${clipId})`">
          <rect x="4.5" y="4.5" width="91" height="131" :fill="topColor" />
          <path d="M4.5 4.5 C 40 40, 60 100, 95.5 135.5 V 4.5 Z" :fill="bottomColor" opacity="0.92" />
          <path d="M4.5 4.5 C 40 40, 60 100, 95.5 135.5" fill="none" stroke="var(--cream)" stroke-width="5" />
        </g>
      </svg>

      <div class="reading top-reading">
        <span class="p-name" :style="{ fontSize: `${nameSize}px` }">{{ name }}</span>
        <span class="big-num" :style="{ fontSize: `${bigSize}px` }">{{ topValue }}</span>
        <span class="alt-tab" :style="{ color: bottomColor, fontSize: `${tabSize}px` }">{{ bottomValue }}</span>
        <span class="act" aria-hidden="true">
          <svg :width="iconSize" :height="iconSize" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
            <path :d="topIcon" />
          </svg>
        </span>
      </div>

      <div class="reading bottom-reading">
        <span class="p-name" :style="{ fontSize: `${nameSize}px` }">{{ name }}</span>
        <span class="big-num" :style="{ fontSize: `${bigSize}px` }">{{ bottomValue }}</span>
        <span class="alt-tab" :style="{ color: topColor, fontSize: `${tabSize}px` }">{{ topValue }}</span>
        <span class="act" aria-hidden="true">
          <svg :width="iconSize" :height="iconSize" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
            <path :d="bottomIcon" />
          </svg>
        </span>
      </div>
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
.wave-bg {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  shape-rendering: geometricPrecision;
}
.reading {
  position: absolute;
  inset: 0;
  color: var(--ink);
}
.bottom-reading {
  transform: rotate(180deg);
}
.p-name {
  position: absolute;
  left: 50%;
  top: 4.5%;
  transform: translateX(-50%);
  max-width: 72%;
  overflow: hidden;
  color: var(--ink);
  font-family: var(--font-ui);
  font-style: italic;
  line-height: 1;
  letter-spacing: 0.03em;
  text-overflow: ellipsis;
  white-space: nowrap;
  -webkit-font-smoothing: antialiased;
}
.big-num {
  position: absolute;
  left: 8%;
  top: 12%;
  color: var(--ink);
  font-family: var(--font-num);
  line-height: 0.95;
  letter-spacing: -0.03em;
  text-shadow: 1.5px 1.5px 0 var(--cream);
  -webkit-font-smoothing: antialiased;
}
.alt-tab {
  position: absolute;
  left: 8%;
  top: 45%;
  min-width: 24%;
  padding: 2.5% 5.5%;
  box-sizing: border-box;
  border-radius: 999px;
  background: var(--ink);
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.3);
  font-family: var(--font-num);
  line-height: 1.2;
  text-align: center;
  -webkit-font-smoothing: antialiased;
}
.act {
  position: absolute;
  left: 10%;
  top: 64%;
  color: var(--ink);
  opacity: 0.82;
}
.card-face.selected {
  z-index: 5;
  transform: translateY(-12%) scale(1.06);
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
