<script setup lang="ts">
import { ref } from 'vue'
import { useGameStore } from '@/stores/game'
import { useSettingsStore } from '@/stores/settings'
import type { Difficulty } from '@/core/types'
import CardFace from '@/ui/components/CardFace.vue'

const game = useGameStore()
const settings = useSettingsStore()

const playerCount = ref(3)
const difficulty = ref<Difficulty>('normal')

const counts = [
  { n: 3, desc: '12 张/人 · 3 轮' },
  { n: 4, desc: '11 张/人 · 4 轮' },
  { n: 5, desc: '9 张/人 · 5 轮' },
]
const diffs: Array<{ v: Difficulty; label: string; desc: string }> = [
  { v: 'easy', label: '学徒', desc: '单步优化自己的手牌结构' },
  { v: 'normal', label: '艺人', desc: '算收益、算风险、抓双动机会' },
  { v: 'hard', label: '团长', desc: '全信息推演一整圈的回应' },
]

// 展示用的样张（不进牌局）
const demoCards = [
  { top: 7, bottom: 3 },
  { top: 8, bottom: 7 },
  { top: 9, bottom: 4 },
]

function start() {
  game.startGame({
    playerCount: playerCount.value,
    difficulty: difficulty.value,
    nickname: settings.nickname,
  })
}
</script>

<template>
  <div class="home">
    <div class="hero">
      <h1 class="title-font logo">SCOUT</h1>
      <p class="sub">马戏团 · 招兵买马</p>
      <div class="demo-row">
        <CardFace v-for="(c, i) in demoCards" :key="i" :card="c" :width="72" class="demo-card" :style="{ animationDelay: `${i * 120}ms` }" />
      </div>
      <p class="tagline">整理手牌 · 上台演出 · 挖走别人的明星</p>
    </div>

    <div class="panel setup">
      <div class="field">
        <label>你的名字</label>
        <input v-model="settings.nickname" maxlength="8" class="input" @change="settings.persist()" />
      </div>
      <div class="field">
        <label>桌上人数</label>
        <div class="seg">
          <button
            v-for="c in counts"
            :key="c.n"
            class="seg-btn"
            :class="{ on: playerCount === c.n }"
            @click="playerCount = c.n"
          >
            <b>{{ c.n }} 人</b><i>{{ c.desc }}</i>
          </button>
        </div>
      </div>
      <div class="field">
        <label>AI 难度</label>
        <div class="seg">
          <button
            v-for="d in diffs"
            :key="d.v"
            class="seg-btn"
            :class="{ on: difficulty === d.v }"
            @click="difficulty = d.v"
          >
            <b>{{ d.label }}</b><i>{{ d.desc }}</i>
          </button>
        </div>
      </div>
      <button class="btn start" @click="start">开演！</button>
      <div class="links">
        <button class="btn ghost" @click="game.goto('rules')">规则</button>
        <button class="btn ghost" @click="game.goto('settings')">设置</button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.home {
  height: 100%;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 18px;
  padding: 34px 18px 26px;
}
.hero {
  text-align: center;
}
.logo {
  font-size: clamp(44px, 13vw, 72px);
  color: var(--gold);
  text-shadow:
    3px 3px 0 var(--red-deep),
    6px 6px 0 rgba(0, 0, 0, 0.35);
  letter-spacing: 0.06em;
}
.sub {
  font-size: 14px;
  letter-spacing: 0.5em;
  text-indent: 0.5em;
  color: var(--cream-dim);
  margin: 6px 0 16px;
}
.demo-row {
  display: flex;
  justify-content: center;
  gap: 10px;
  margin-bottom: 12px;
}
.demo-card {
  transform: rotate(-4deg);
}
.demo-card:nth-child(2) {
  transform: rotate(2deg) translateY(-6px);
}
.demo-card:nth-child(3) {
  transform: rotate(5deg);
}
.tagline {
  font-size: 13px;
  color: var(--cream-dim);
}
.setup {
  width: min(420px, 100%);
  padding: 20px 18px;
  display: flex;
  flex-direction: column;
  gap: 16px;
}
.field label {
  display: block;
  font-size: 13px;
  color: var(--gold);
  letter-spacing: 0.12em;
  margin-bottom: 8px;
}
.input {
  width: 100%;
  padding: 10px 14px;
  border-radius: 10px;
  border: 1.5px solid rgba(247, 239, 221, 0.3);
  background: rgba(0, 0, 0, 0.25);
  color: var(--cream);
  font-size: 15px;
  outline: none;
}
.input:focus {
  border-color: var(--gold);
}
.seg {
  display: flex;
  gap: 8px;
}
.seg-btn {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 3px;
  padding: 10px 6px;
  border-radius: 10px;
  background: rgba(247, 239, 221, 0.08);
  box-shadow: inset 0 0 0 1.5px rgba(247, 239, 221, 0.18);
  color: var(--cream);
  transition: all var(--dur-fast);
}
.seg-btn b {
  font-size: 15px;
}
.seg-btn i {
  font-style: normal;
  font-size: 10.5px;
  opacity: 0.75;
}
.seg-btn.on {
  background: var(--red);
  box-shadow: 0 2px 0 var(--red-deep);
}
.start {
  font-size: 20px;
  padding: 14px;
}
.links {
  display: flex;
  gap: 10px;
}
.links .btn {
  flex: 1;
  padding: 10px;
}
</style>
