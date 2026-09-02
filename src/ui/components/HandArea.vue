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
const insertCardWidth = computed(() => (isWide.value ? 70 : 52))
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

/** 插牌按钮直接写相邻牌的当前数字，避免依赖位置编号数牌。 */
function gapLabel(afterIndex: number) {
  const left = hand.value[afterIndex]
  const right = hand.value[afterIndex + 1]
  if (!left) return '最左'
  if (!right) return '最右'
  return `${left.top}│${right.top}`
}

function gapAriaLabel(afterIndex: number) {
  const left = hand.value[afterIndex]
  const right = hand.value[afterIndex + 1]
  if (!left) return '插到手牌最左侧'
  if (!right) return `插到数字 ${left.top} 后面，也就是手牌最右侧`
  return `插到数字 ${left.top} 和 ${right.top} 之间`
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
          <span>横向滑动，点牌缝里的 ＋</span>
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

    <TransitionGroup v-if="!insertMode" name="hand" tag="div" class="cards">
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

    <div v-else class="insert-picker pop-in">
      <div class="insert-guide">
        <span>把</span>
        <b class="picked-value">{{ scoutedCard?.top }}</b>
        <span>插进目标牌缝</span>
      </div>
      <div class="insert-scroll">
        <div class="insert-track">
          <button
            class="insert-gap edge"
            aria-label="插到手牌最左侧"
            @click="game.pickScoutInsert(0)"
          >
            <span class="gap-pair">最左</span>
            <span class="gap-plus">＋</span>
          </button>

          <template v-for="(c, i) in hand" :key="`insert-${c.top}-${c.bottom}-${i}`">
            <div class="insert-card">
              <CardFace :card="c" :width="insertCardWidth" />
            </div>
            <button
              class="insert-gap"
              :class="{ edge: i === hand.length - 1 }"
              :aria-label="gapAriaLabel(i)"
              @click="game.pickScoutInsert(i + 1)"
            >
              <span class="gap-pair">{{ gapLabel(i) }}</span>
              <span class="gap-plus">＋</span>
            </button>
          </template>
        </div>
      </div>
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
.insert-picker {
  padding: 4px 0 3px;
}
.insert-guide {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  min-height: 24px;
  color: var(--cream-dim);
  font-size: 12px;
  font-weight: 700;
}
.picked-value {
  display: inline-grid;
  place-items: center;
  min-width: 24px;
  height: 24px;
  border-radius: 50%;
  background: var(--gold);
  color: #3b2808;
  font-family: var(--font-num);
  font-size: 14px;
}
.insert-scroll {
  overflow-x: auto;
  overscroll-behavior-x: contain;
  scrollbar-width: thin;
  scrollbar-color: rgba(233, 178, 60, 0.65) rgba(0, 0, 0, 0.18);
  padding: 5px 0 7px;
}
.insert-track {
  display: flex;
  align-items: center;
  width: max-content;
  min-width: 100%;
  padding: 0 6px;
}
.insert-card {
  flex: none;
}
.insert-gap {
  flex: 0 0 42px;
  height: 72px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 5px;
  padding: 0 2px;
  color: var(--cream);
  background: transparent;
}
.gap-pair {
  min-height: 12px;
  color: var(--cream-dim);
  font-family: var(--font-num);
  font-size: 10px;
  line-height: 1;
  white-space: nowrap;
}
.gap-plus {
  display: grid;
  place-items: center;
  width: 30px;
  height: 30px;
  border-radius: 50%;
  background: rgba(233, 178, 60, 0.2);
  box-shadow:
    inset 0 0 0 2px var(--gold),
    0 3px 10px rgba(0, 0, 0, 0.3);
  color: var(--gold);
  font-weight: 800;
  font-size: 20px;
  font-family: var(--font-num);
  transition: transform var(--dur-fast) var(--ease-pop), background var(--dur-fast);
}
.insert-gap.edge .gap-pair {
  color: var(--gold);
  font-family: var(--font-ui);
  font-weight: 800;
}
.insert-gap:active .gap-plus {
  transform: scale(0.9);
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
  .insert-track {
    padding: 0 12px;
  }
  .insert-gap {
    flex-basis: 50px;
    height: 98px;
  }
  .gap-pair {
    font-size: 12px;
  }
  .gap-plus {
    width: 36px;
    height: 36px;
    font-size: 23px;
  }
}
</style>
