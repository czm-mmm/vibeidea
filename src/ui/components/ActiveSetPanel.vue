<script setup lang="ts">
import { computed } from 'vue'
import type { GameState } from '@/core/types'
import { comboLabel } from '@/core/rules'
import CardFace from '@/ui/components/CardFace.vue'

const props = defineProps<{ state: GameState; cardWidth: number }>()

const combo = computed(() => (props.state.active ? props.state.active.combo : null))
const owner = computed(() => (props.state.active ? props.state.players[props.state.active.ownerSeat] : null))
const cards = computed(() => (props.state.active ? props.state.active.cards : []))
const setKey = computed(() => cards.value.map((c) => `${c.top}${c.bottom}`).join('-') + '-' + props.state.active?.ownerSeat)

const beatHint = computed(() => {
  const c = combo.value
  if (!c) return ''
  if (c.kind === 'single') return `需单张数字大于 ${c.low}`
  if (c.kind === 'group') return `需更多张数；或等张数同数且最低数字大于 ${c.low}`
  return `需更多张数；或等张数同数（任意数字）；或等张数顺子且最低数字大于 ${c.low}`
})
</script>

<template>
  <div class="center">
    <div v-if="combo && owner" class="active pop-in" :key="setKey">
      <div class="owner">
        <span class="crown">🎪</span>{{ owner.name }} 的演出
      </div>
      <div class="cards">
        <CardFace
          v-for="(c, i) in cards"
          :key="`${c.top}-${c.bottom}-${i}`"
          :card="c"
          :width="cardWidth"
          class="set-card"
          :style="{ animationDelay: `${i * 55}ms`, ['--deal-rot']: i % 2 ? '2.5deg' : '-2.5deg' }"
        />
      </div>
      <div class="label">
        <b>{{ comboLabel(combo) }}</b>
        <span class="hint">{{ beatHint }}</span>
      </div>
    </div>
    <div v-else class="empty">
      <span class=" circus">🎪</span>
      <p>舞台空着——轮到首出者开场</p>
    </div>
  </div>
</template>

<style scoped>
.center {
  flex: 1;
  display: grid;
  place-items: center;
  padding: 8px 12px;
  min-height: 120px;
}
.active {
  text-align: center;
}
.owner {
  font-size: 13px;
  color: var(--gold);
  letter-spacing: 0.1em;
  margin-bottom: 8px;
}
.crown {
  margin-right: 4px;
}
.cards {
  display: flex;
  justify-content: center;
  gap: 6px;
  flex-wrap: wrap;
}
.set-card {
  animation: card-in var(--dur-slow) var(--ease-pop) both;
}
.label {
  margin-top: 10px;
  display: flex;
  flex-direction: column;
  gap: 3px;
  align-items: center;
}
.label b {
  font-size: 15px;
  color: var(--cream);
}
.hint {
  font-size: 11px;
  color: var(--cream-dim);
  opacity: 0.85;
}
.empty {
  text-align: center;
  color: var(--cream-dim);
  font-size: 13px;
  opacity: 0.7;
}
.empty span {
  font-size: 34px;
  display: block;
  margin-bottom: 6px;
}
</style>
