<script setup lang="ts">
import { computed } from 'vue'
import { useGameStore } from '@/stores/game'

const game = useGameStore()

/** 终局排名：用最后一轮 rows 的 total（已含累计） */
const ranked = computed(() => {
  const s = game.state
  if (!s?.lastResult) return []
  return [...s.lastResult.rows].sort((a, b) => b.total - a.total)
})
const myRank = computed(() => ranked.value.findIndex((r) => r.seat === game.humanSeat) + 1)
</script>

<template>
  <div v-if="game.showGameOver && ranked.length" class="overlay fade-in">
    <div class="box panel dialog-in">
      <p class="crown">{{ myRank === 1 ? '🏆' : myRank <= 2 ? '🎪' : '🎩' }}</p>
      <p class="title">
        {{ myRank === 1 ? '马戏团之王！' : `你排名第 ${myRank}` }}
      </p>
      <table class="score">
        <tbody>
          <tr v-for="(row, i) in ranked" :key="row.seat" :class="{ me: row.seat === game.humanSeat }">
            <td class="rank">{{ ['①', '②', '③', '④', '⑤'][i] }}</td>
            <td class="name">{{ row.name }}</td>
            <td class="total">{{ row.total }} 分</td>
          </tr>
        </tbody>
      </table>
      <div class="btns">
        <button class="btn gold" @click="game.backHome()">回大本营</button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.overlay {
  position: absolute;
  inset: 0;
  z-index: 58;
  display: grid;
  place-items: center;
  background: rgba(8, 22, 16, 0.78);
  padding: 16px;
}
.box {
  width: min(360px, 100%);
  padding: 24px;
  display: flex;
  flex-direction: column;
  gap: 12px;
  align-items: center;
}
.crown {
  font-size: 44px;
}
.title {
  font-size: 19px;
  font-weight: 800;
  color: var(--gold);
}
.score {
  width: 100%;
  border-collapse: collapse;
  font-size: 14px;
}
td {
  padding: 8px 6px;
  border-bottom: 1px solid rgba(247, 239, 221, 0.08);
}
td.rank {
  font-size: 16px;
  width: 40px;
}
td.name {
  text-align: left;
  font-weight: 700;
}
tr.me td {
  color: var(--gold);
}
td.total {
  font-weight: 800;
  text-align: right;
}
.btns {
  display: flex;
  gap: 10px;
  width: 100%;
}
.btns .btn {
  flex: 1;
}
</style>
