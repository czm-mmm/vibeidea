<script setup lang="ts">
import { useGameStore } from '@/stores/game'

const game = useGameStore()
</script>

<template>
  <div v-if="game.showRoundResult && game.state?.lastResult" class="overlay fade-in">
    <div class="box panel dialog-in">
      <p class="title">第 {{ game.state.roundNumber }} 轮 · 谢幕</p>
      <p class="cond">
        {{ game.state.lastResult.condition === 'emptyHand' ? '有人打光了手牌！' : '所有人都只想挖角，演出结束' }}
      </p>
      <table class="score">
        <thead>
          <tr>
            <th></th>
            <th>收牌</th>
            <th>金币</th>
            <th>剩牌</th>
            <th>本轮</th>
            <th>总分</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="row in game.state.lastResult.rows" :key="row.seat" :class="{ me: row.seat === game.humanSeat }">
            <td class="name">{{ row.name }}</td>
            <td>+{{ row.collected }}</td>
            <td>+{{ row.chips }}</td>
            <td :class="{ zero: row.penalty === 0 }">{{ row.penalty === 0 ? '免罚' : `−${row.penalty}` }}</td>
            <td class="pts">{{ row.points >= 0 ? '+' : '' }}{{ row.points }}</td>
            <td class="total">{{ row.total }}</td>
          </tr>
        </tbody>
      </table>
      <button class="btn" @click="game.nextRound()">下一轮（{{ game.state.roundNumber + 1 }}/{{ game.state.totalRounds }}）</button>
    </div>
  </div>
</template>

<style scoped>
.overlay {
  position: absolute;
  inset: 0;
  z-index: 55;
  display: grid;
  place-items: center;
  background: rgba(8, 22, 16, 0.72);
  padding: 16px;
}
.box {
  width: min(420px, 100%);
  padding: 20px;
  display: flex;
  flex-direction: column;
  gap: 12px;
  align-items: center;
}
.title {
  font-size: 17px;
  font-weight: 800;
  color: var(--gold);
}
.cond {
  font-size: 12.5px;
  color: var(--cream-dim);
}
.score {
  width: 100%;
  border-collapse: collapse;
  font-size: 13px;
}
th {
  font-weight: 600;
  color: var(--cream-dim);
  font-size: 11.5px;
  padding: 4px 6px;
  border-bottom: 1px solid rgba(247, 239, 221, 0.2);
}
td {
  text-align: center;
  padding: 7px 6px;
  border-bottom: 1px solid rgba(247, 239, 221, 0.08);
}
td.name {
  text-align: left;
  font-weight: 700;
}
tr.me td.name {
  color: var(--gold);
}
td.zero {
  color: var(--teal);
}
td.pts {
  font-weight: 700;
}
td.total {
  font-weight: 800;
  font-size: 14.5px;
  color: var(--gold);
}
</style>
