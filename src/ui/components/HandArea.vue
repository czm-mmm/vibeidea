<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { useGameStore } from '@/stores/game'
import { classify, comboLabel } from '@/core/rules'
import { useIsWide } from '@/ui/composables/useViewport'
import CardFace from '@/ui/components/CardFace.vue'

const game = useGameStore()
const isWide = useIsWide()
const wrap = ref<HTMLElement | null>(null)
const cardWidth = computed(() => (isWide.value ? 84 : 62))
const wrapWidth = ref(360)

const realHand = computed(() => (game.state ? game.state.players[game.humanSeat].hand : []))
/** 双动选牌阶段显示「侦察牌已插入」的预览手牌，与引擎校验的下标一致 */
const hand = computed(() => game.previewHand ?? realHand.value)
const insertMode = computed(() => game.scoutFlow?.step === 'pickInsert')
const doubleShow = computed(() => game.doubleShowPending && !game.pendingSpec)
const doubleShowPick = computed(() => !!game.pendingSpec)
const flipOn = computed(() => game.scoutFlow?.flip ?? false)

const reveal = computed(() => {
  const n = Math.max(2, hand.value.length)
  const avail = wrapWidth.value - 16
  const cap = isWide.value ? 88 : 34
  return Math.min(cap, Math.max(16, (avail - cardWidth.value) / (n - 1)))
})

function measure() {
  if (wrap.value) wrapWidth.value = wrap.value.clientWidth
}
onMounted(() => {
  measure()
  window.addEventListener('resize', measure)
})
onBeforeUnmount(() => window.removeEventListener('resize', measure))

const selInfo = computed(() => {
  if (!game.selection || !game.state) return null
  const { from, to } = game.selection
  const vals = hand.value.slice(from, to + 1).map((c) => c.top)
  const combo = classify(vals)
  if (!combo) return { ok: false, text: '✗ 非法：不是同数或连续' }
  const label = comboLabel(combo)
  if (!game.isHumanTurn) return { ok: false, text: label }
  const legal = game.humanLegalShows.some((s) => s.from === from && s.to === to)
  if (game.state.active) {
    return legal
      ? { ok: true, text: `✓ ${label} · 可压过` }
      : { ok: false, text: `✗ ${label} · 压不过当前牌型` }
  }
  return { ok: true, text: `✓ ${label}` }
})

function inSel(i: number) {
  const s = game.selection
  return !!s && i >= s.from && i <= s.to
}

function hintAt(i: number): 'run' | 'group' | null {
  if (game.selection || !game.isHumanTurn || game.scoutFlow) return null
  return game.legalHintMap.get(i) ?? null
}

/** 插入模式下：被侦察的牌（按当前 flip 设置预览朝向） */
const scoutedCard = computed(() => {
  const s = game.state
  if (!s || !s.active || !game.scoutFlow?.end) return null
  const cards = s.active.cards
  const card = game.scoutFlow.end === 'left' ? cards[0] : cards[cards.length - 1]
  if (!card) return null
  return game.scoutFlow.flip ? { top: card.bottom, bottom: card.top } : card
})
</script>

<template>
  <div ref="wrap" class="hand-area">
    <div class="info-row">
      <template v-if="insertMode && scoutedCard">
        <div class="scout-banner">
          <CardFace :card="scoutedCard" :width="34" />
          <span>点下面的位置编号插入</span>
          <button class="mini-btn" :class="{ on: flipOn }" @click="game.toggleScoutFlip()">
            ↻ 翻转{{ flipOn ? '（已翻）' : '' }}
          </button>
        </div>
      </template>
      <template v-else-if="doubleShow">
        <div class="scout-banner gold">双动：先选要挖角的一端 →</div>
      </template>
      <template v-else-if="doubleShowPick">
        <div class="scout-banner gold">挖角完成！点选一块牌立刻演出</div>
      </template>
      <template v-else-if="selInfo">
        <div class="sel-info" :class="selInfo.ok ? 'ok' : 'no'">{{ selInfo.text }}</div>
      </template>
      <template v-else>
        <div class="lock-hint">🔒 顺序锁定 · 点首张再点末张</div>
      </template>
    </div>

    <TransitionGroup name="hand" tag="div" class="cards">
      <div
        v-for="(c, i) in hand"
        :key="`${c.top}-${c.bottom}-${i}`"
        class="card-slot"
        :style="i > 0 ? { marginLeft: `${reveal - cardWidth}px` } : {}"
        @click="game.tapCard(i)"
      >
        <CardFace
          :card="c"
          :width="cardWidth"
          :selected="inSel(i)"
          :hint="hintAt(i)"
          :dim="!!game.selection && !inSel(i)"
        />
      </div>
    </TransitionGroup>

    <div v-if="insertMode" class="insert-strip pop-in">
      <button
        v-for="i in hand.length + 1"
        :key="`pos-${i}`"
        class="pos"
        @click="game.pickScoutInsert(i - 1)"
      >
        {{ i }}
      </button>
    </div>
  </div>
</template>

<style scoped>
.hand-area {
  padding: 4px 8px 2px;
}
.info-row {
  height: 40px;
  display: flex;
  align-items: center;
  justify-content: center;
}
.lock-hint {
  font-size: 12px;
  color: var(--cream-dim);
  opacity: 0.8;
  letter-spacing: 0.08em;
}
.sel-info {
  font-size: 13.5px;
  font-weight: 700;
  padding: 5px 14px;
  border-radius: 999px;
}
.sel-info.ok {
  color: #9fe8b8;
  background: rgba(42, 99, 80, 0.35);
}
.sel-info.no {
  color: #ffb3a6;
  background: rgba(176, 48, 31, 0.3);
}
.scout-banner {
  display: flex;
  align-items: center;
  gap: 10px;
  font-size: 13px;
  font-weight: 700;
  padding: 3px 12px;
  border-radius: 999px;
  background: rgba(233, 178, 60, 0.18);
  box-shadow: inset 0 0 0 1.5px var(--gold);
}
.scout-banner.gold {
  color: var(--gold);
}
.mini-btn {
  font-size: 12px;
  padding: 4px 10px;
  border-radius: 999px;
  background: rgba(0, 0, 0, 0.3);
  color: var(--cream);
  box-shadow: inset 0 0 0 1px rgba(247, 239, 221, 0.3);
}
.mini-btn.on {
  background: var(--gold);
  color: #4a3208;
}
.cards {
  position: relative;
  display: flex;
  align-items: flex-end;
  justify-content: center;
  min-height: 96px;
  padding-top: 14px;
}
.card-slot {
  flex: none;
  cursor: pointer;
}
/* 按压微交互：轻下沉 */
.card-slot:active .card-face {
  transform: translateY(2px) scale(0.98);
}
.insert-strip {
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: 6px;
  padding: 8px 4px 6px;
}
.pos {
  min-width: 34px;
  height: 34px;
  border-radius: 50%;
  background: rgba(233, 178, 60, 0.16);
  box-shadow: inset 0 0 0 1.5px var(--gold);
  color: var(--gold);
  font-weight: 800;
  font-size: 14px;
  font-family: var(--font-num);
}
.pos:active {
  background: var(--gold);
  color: #4a3208;
}

/* 横版：手牌区限宽居中，插入位加大 */
@media (min-width: 900px) {
  .hand-area {
    max-width: 1000px;
    width: 100%;
    margin: 0 auto;
  }
  .cards {
    min-height: 128px;
  }
  .insert-strip {
    gap: 10px;
  }
  .pos {
    min-width: 40px;
    height: 40px;
    font-size: 16px;
  }
}
</style>
