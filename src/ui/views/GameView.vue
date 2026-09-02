<script setup lang="ts">
import { computed } from 'vue'
import { useGameStore } from '@/stores/game'
import { useIsWide } from '@/ui/composables/useViewport'
import SeatPanel from '@/ui/components/SeatPanel.vue'
import ActiveSetPanel from '@/ui/components/ActiveSetPanel.vue'
import HandArea from '@/ui/components/HandArea.vue'
import ActionBar from '@/ui/components/ActionBar.vue'
import ScoutEndOverlay from '@/ui/components/ScoutEndOverlay.vue'
import FlipDialog from '@/ui/components/FlipDialog.vue'
import RoundResultPanel from '@/ui/components/RoundResultPanel.vue'
import GameOverPanel from '@/ui/components/GameOverPanel.vue'

const game = useGameStore()
const isWide = useIsWide()

const others = computed(() =>
  game.state ? game.state.players.filter((p) => p.seat !== game.humanSeat) : [],
)
const me = computed(() => (game.state ? game.state.players[game.humanSeat] : null))
const cardWidth = computed(() => {
  const n = game.state?.active?.cards.length ?? 0
  const base = n > 5 ? 44 : n > 3 ? 54 : 62
  return isWide.value ? Math.round(base * 1.4) : base
})
const recentLog = computed(() => (game.state ? game.state.log.slice(-3).reverse() : []))
</script>

<template>
  <div v-if="game.state && me" class="game">
    <header class="topbar">
      <button class="icon-btn" title="回主页" @click="game.backHome()">⏏</button>
      <span class="round">第 {{ game.state.roundNumber }} / {{ game.state.totalRounds }} 轮</span>
      <span class="scores" :title="game.state.players.map((p) => `${p.name}:${game.state?.totals[p.seat] ?? 0}`).join(' ')">
        🏆 {{ game.state.totals[game.humanSeat] }}
      </span>
    </header>

    <div class="seats">
      <SeatPanel
        v-for="p in others"
        :key="p.seat"
        :player="p"
        :is-current="game.state.current === p.seat && game.state.phase === 'playing'"
        :thinking="game.aiThinking === p.seat"
      />
    </div>

    <main class="stage panel">
      <ActiveSetPanel :state="game.state" :card-width="cardWidth" />
      <div class="log">
        <p v-for="(l, i) in recentLog" :key="i" :style="{ opacity: 1 - i * 0.28 }">
          <span class="who">{{ game.state.players[l.seat]?.name }}</span> {{ l.text.replace(`${game.state.players[l.seat]?.name} `, '') }}
        </p>
      </div>
      <ScoutEndOverlay />
    </main>

    <div class="me-strip">
      <SeatPanel :player="me" :is-current="game.isHumanTurn" :thinking="false" />
    </div>

    <HandArea />
    <ActionBar />

    <FlipDialog />
    <RoundResultPanel />
    <GameOverPanel />
  </div>
</template>

<style scoped>
.game {
  position: relative;
  height: 100%;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}
.topbar {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 14px 6px;
}
.icon-btn {
  width: 34px;
  height: 34px;
  border-radius: 10px;
  background: rgba(247, 239, 221, 0.1);
  font-size: 15px;
}
.round {
  font-size: 14px;
  font-weight: 800;
  color: var(--gold);
  letter-spacing: 0.08em;
}
.scores {
  margin-left: auto;
  font-size: 13px;
  color: var(--cream-dim);
}
.seats {
  display: flex;
  gap: 8px;
  padding: 0 12px;
  flex-wrap: wrap;
  justify-content: center;
}
.stage {
  position: relative;
  flex: 1;
  margin: 8px 12px;
  display: flex;
  flex-direction: column;
  min-height: 0;
}
.log {
  padding: 4px 12px 8px;
  font-size: 11px;
  color: var(--cream-dim);
  text-align: center;
  min-height: 44px;
}
.log .who {
  color: var(--gold);
  margin-right: 4px;
}
.me-strip {
  padding: 0 12px;
  display: flex;
  justify-content: center;
}

/* ===== 横版（桌面 / 平板横屏）：座位一排居中，牌区与手牌限宽放大 ===== */
@media (min-width: 900px) {
  .topbar {
    padding: 16px 28px 8px;
    max-width: 1100px;
    width: 100%;
    margin: 0 auto;
  }
  .seats {
    gap: 20px;
    padding: 0 28px;
    max-width: 1100px;
    width: 100%;
    margin: 0 auto;
  }
  .seats .seat {
    min-width: 170px;
  }
  .stage {
    max-width: 920px;
    width: calc(100% - 56px);
    margin: 14px auto;
  }
  .me-strip {
    max-width: 1100px;
    width: 100%;
    margin: 0 auto;
    padding: 0 28px;
  }
  .me-strip .seat {
    min-width: 200px;
  }
}
</style>
