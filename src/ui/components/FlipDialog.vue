<script setup lang="ts">
// 开局整手翻转：看过手牌后决定是否旋转 180°（一次机会）
// 上行 = 当前朝向；下行 = 收拢整手后旋转 180° 再展开的结果。
// 旋转会同时交换每张牌的上下数字，并反转手牌的左右顺序。
import { computed } from 'vue'
import { useGameStore } from '@/stores/game'
import { betterFlip } from '@/core/metrics'
import { flippedHand } from '@/core/rules'
import CardFace from '@/ui/components/CardFace.vue'

const game = useGameStore()
const hand = computed(() => (game.state ? game.state.players[game.humanSeat].hand : []))
const otherSide = computed(() => flippedHand(hand.value))
const flipBetter = computed(() => betterFlip(hand.value))
const advice = computed(() => (flipBetter.value ? '翻转后出牌数更少' : '保持现状出牌数更少或持平'))
</script>

<template>
  <div v-if="game.state?.phase === 'flip'" class="overlay fade-in">
    <div class="box panel dialog-in">
      <p class="title">第 {{ game.state.roundNumber }} 轮 · 布置马戏团</p>
      <p class="desc">先收拢整手，再一起旋转 180°；数字和左右牌序都会反转（只能选一次）</p>

      <div class="side">
        <b>当前朝向</b>
        <div class="cards">
          <CardFace v-for="(c, i) in hand" :key="`a-${i}`" :card="c" :width="44" />
        </div>
      </div>

      <div class="side">
        <b>整手旋转后（牌序也反转）</b>
        <div class="cards">
          <CardFace v-for="(c, i) in otherSide" :key="`b-${i}`" :card="c" :width="44" />
        </div>
      </div>

      <p class="advice">💡 {{ advice }}</p>
      <div class="btns">
        <button class="btn ghost" @click="game.decideFlip(false)">保持</button>
        <button class="btn gold" @click="game.decideFlip(true)">旋转 180°</button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.overlay {
  position: absolute;
  inset: 0;
  z-index: 50;
  display: grid;
  place-items: center;
  background: rgba(8, 22, 16, 0.7);
  padding: 12px;
}
.box {
  width: min(480px, 100%);
  max-height: 100%;
  overflow-y: auto;
  padding: 16px;
  display: flex;
  flex-direction: column;
  gap: 10px;
}
.title {
  font-size: 17px;
  font-weight: 800;
  color: var(--gold);
  text-align: center;
}
.desc {
  font-size: 12.5px;
  color: var(--cream-dim);
  text-align: center;
}
.side {
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.side b {
  font-size: 12.5px;
  color: var(--cream);
}
.cards {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  justify-content: center;
}
.advice {
  font-size: 12px;
  text-align: center;
  color: var(--teal);
}
.btns {
  display: flex;
  gap: 10px;
}
.btns .btn {
  flex: 1;
}
</style>
