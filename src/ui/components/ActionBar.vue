<script setup lang="ts">
import { computed } from 'vue'
import { useGameStore } from '@/stores/game'

const game = useGameStore()

const canShow = computed(() => game.isHumanTurn && !!game.selection && game.selectionLegal.ok)
const showReason = computed(() => {
  if (!game.isHumanTurn) return '未轮到你'
  if (game.doubleShowPending) return '双动进行中'
  return game.selection ? game.selectionLegal.reason : '先框选一块牌'
})
const scoutState = computed(() => {
  if (game.scoutFlow) return { on: true, label: '取消挖角' }
  return { on: false, label: '挖角' }
})
</script>

<template>
  <div class="bar">
    <button
      v-if="game.doubleShowPending && game.pendingSpec"
      class="act show"
      :disabled="!canShow"
      @click="game.performDoubleShow()"
    >
      双动 · 演出
    </button>
    <button v-else class="act show" :disabled="!canShow" @click="game.performShow()" :title="showReason">
      演出
    </button>

    <button
      class="act scout"
      :class="{ active: scoutState.on }"
      :disabled="!scoutState.on && !game.canScout"
      :title="game.canScout || scoutState.on ? '从牌型一端取 1 张插入手牌' : '桌上没有可挖角的牌型'"
      @click="scoutState.on ? game.cancelScout() : game.beginScout()"
    >
      {{ scoutState.label }}
    </button>

    <button
      class="act double"
      :class="{ active: scoutState.on }"
      :disabled="!game.canDoubleAction"
      :title="game.canDoubleAction ? '挖角后立刻演出（每轮一次）' : '无牌型 / 标记已用'"
      @click="game.beginDoubleAction()"
    >
      挖角+演出
    </button>
  </div>
</template>

<style scoped>
.bar {
  display: flex;
  gap: 10px;
  padding: 6px 14px calc(10px + env(safe-area-inset-bottom));
}
.act {
  flex: 1;
  padding: 13px 8px;
  border-radius: 14px;
  font-size: 15.5px;
  font-weight: 800;
  letter-spacing: 0.06em;
  color: var(--white);
  background: rgba(247, 239, 221, 0.12);
  box-shadow:
    inset 0 0 0 1.5px rgba(247, 239, 221, 0.25),
    0 3px 8px rgba(0, 0, 0, 0.25);
  transition: all var(--dur-fast) var(--ease-pop);
}
.act.show {
  background: var(--red);
  box-shadow: 0 3px 0 var(--red-deep), 0 5px 10px rgba(0, 0, 0, 0.3);
}
.act.scout {
  background: var(--gold);
  color: #4a3208;
  box-shadow: 0 3px 0 var(--gold-deep), 0 5px 10px rgba(0, 0, 0, 0.3);
}
.act.double {
  background: var(--purple);
  box-shadow: 0 3px 0 #5a43cc, 0 5px 10px rgba(0, 0, 0, 0.3);
}
.act:active:not(:disabled) {
  transform: translateY(2px);
}
.act:disabled {
  filter: grayscale(0.85) brightness(0.65);
}
.act.active {
  outline: 3px solid var(--cream);
}

/* 横版：操作条限宽居中 */
@media (min-width: 900px) {
  .bar {
    max-width: 1000px;
    width: 100%;
    margin: 0 auto;
    padding-bottom: calc(14px + env(safe-area-inset-bottom));
  }
  .act {
    font-size: 17px;
    padding: 15px 8px;
  }
}
</style>
