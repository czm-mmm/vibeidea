<script setup lang="ts">
// 侦察端点选择：盖在中央牌区上，选牌型的左端或右端
import { computed } from 'vue'
import { useGameStore } from '@/stores/game'
import CardFace from '@/ui/components/CardFace.vue'

const game = useGameStore()
const cards = computed(() => (game.state?.active ? game.state.active.cards : []))
const left = computed(() => cards.value[0] ?? null)
const right = computed(() => cards.value[cards.value.length - 1] ?? null)
</script>

<template>
  <div v-if="game.scoutFlow?.step === 'pickEnd'" class="overlay fade-in">
    <div class="box panel dialog-in">
      <p class="title">从演出的一端挖走一张</p>
      <div class="ends">
        <button v-if="left" class="end" @click="game.pickScoutEnd('left')">
          <CardFace :card="left" :width="56" />
          <span>左端</span>
        </button>
        <div class="divider"></div>
        <button v-if="right && cards.length > 1" class="end" @click="game.pickScoutEnd('right')">
          <CardFace :card="right" :width="56" />
          <span>右端</span>
        </button>
      </div>
      <p class="tip">对方会获得 1 枚金币作为补偿</p>
      <button class="btn ghost cancel" @click="game.cancelScout()">取消</button>
    </div>
  </div>
</template>

<style scoped>
.overlay {
  position: absolute;
  inset: 0;
  z-index: 40;
  display: grid;
  place-items: center;
  background: rgba(8, 22, 16, 0.55);
}
.box {
  padding: 18px 20px;
  text-align: center;
  display: flex;
  flex-direction: column;
  gap: 12px;
  align-items: center;
}
.title {
  font-size: 15px;
  font-weight: 700;
}
.ends {
  display: flex;
  align-items: center;
  gap: 14px;
}
.end {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
  font-size: 12.5px;
  color: var(--cream);
  padding: 8px;
  border-radius: 12px;
  transition: transform var(--dur-fast) var(--ease-pop);
}
.end:active {
  transform: scale(0.92);
}
.divider {
  width: 1.5px;
  height: 56px;
  background: rgba(247, 239, 221, 0.25);
}
.tip {
  font-size: 11.5px;
  color: var(--cream-dim);
}
.cancel {
  padding: 8px 22px;
  font-size: 13px;
}
</style>
