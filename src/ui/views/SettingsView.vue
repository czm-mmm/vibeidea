<script setup lang="ts">
import { useGameStore } from '@/stores/game'
import { useSettingsStore, type AnimSpeed } from '@/stores/settings'
import { AVATARS } from '@/ui/avatars'
import AvatarIcon from '@/ui/components/AvatarIcon.vue'
import { soundPlayer } from '@/audio'

const game = useGameStore()
const settings = useSettingsStore()

let soundToggle = 0
async function toggleSound() {
  const attempt = ++soundToggle
  settings.set('sound', !settings.sound)
  if (settings.sound) {
    const played = await soundPlayer.play('select', true)
    if (!played && attempt === soundToggle && settings.sound && game.view === 'settings') {
      game.showToast('音效暂时无法播放，请检查设备音量或再开关一次', 'warn')
    }
  }
}

const speeds: Array<{ v: AnimSpeed; label: string }> = [
  { v: 'normal', label: '正常' },
  { v: 'slow', label: '慢速' },
  { v: 'off', label: '关闭' },
]
</script>

<template>
  <div class="settings">
    <header>
      <button class="btn ghost" @click="game.goto('home')">← 返回</button>
      <h1 class="title-font">设置</h1>
    </header>
    <div class="body panel">
      <label class="row">
        <span>音效</span>
        <button class="toggle" role="switch" aria-label="音效" :aria-checked="settings.sound" :class="{ on: settings.sound }" @click="toggleSound">
          {{ settings.sound ? '开' : '关' }}
        </button>
      </label>
      <div class="row">
        <span>动画速度</span>
        <div class="seg">
          <button
            v-for="s in speeds"
            :key="s.v"
            class="seg-btn"
            :class="{ on: settings.animSpeed === s.v }"
            @click="settings.set('animSpeed', s.v)"
          >
            {{ s.label }}
          </button>
        </div>
      </div>
      <label class="row">
        <span>色盲友好配色</span>
        <button class="toggle" :class="{ on: settings.colorBlind }" @click="settings.set('colorBlind', !settings.colorBlind)">
          {{ settings.colorBlind ? '开' : '关' }}
        </button>
      </label>
      <div class="row col">
        <span>你的头像</span>
        <div class="avatar-grid">
          <button
            v-for="a in AVATARS"
            :key="a.id"
            class="avatar-cell"
            :class="{ on: settings.avatar === a.id }"
            :title="a.label"
            @click="settings.set('avatar', a.id)"
          >
            <AvatarIcon :id="a.id" :size="46" />
          </button>
        </div>
      </div>
      <label class="row">
        <span>昵称</span>
        <input :value="settings.nickname" maxlength="8" class="input" @change="(e) => settings.set('nickname', (e.target as HTMLInputElement).value)" />
      </label>
      <p class="tip">本作为桌游 SCOUT（Oink Games）的非官方粉丝单机版，规则与美术仅作致敬还原，请支持原版桌游。</p>
    </div>
  </div>
</template>

<style scoped>
.settings {
  height: 100%;
  overflow-y: auto;
  padding: 14px 16px 40px;
}
header {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 12px;
}
header .btn {
  padding: 8px 16px;
  font-size: 13px;
}
h1 {
  font-size: 22px;
  color: var(--gold);
}
.body {
  max-width: 520px;
  margin: 0 auto;
  padding: 8px 18px;
  display: flex;
  flex-direction: column;
}
.row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 14px 0;
  border-bottom: 1px solid rgba(247, 239, 221, 0.1);
  font-size: 14.5px;
}
.row.col {
  flex-direction: column;
  align-items: flex-start;
  gap: 10px;
}
.avatar-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 10px;
  width: 100%;
}
.avatar-cell {
  display: grid;
  place-items: center;
  padding: 5px;
  border-radius: 12px;
  box-shadow: inset 0 0 0 2px transparent;
  transition: box-shadow var(--dur-fast), transform var(--dur-fast) var(--ease-pop);
}
.avatar-cell.on {
  box-shadow: inset 0 0 0 2.5px var(--gold);
  background: rgba(233, 178, 60, 0.12);
}
.avatar-cell:active {
  transform: scale(0.94);
}
.toggle {
  min-width: 56px;
  padding: 7px 0;
  border-radius: 999px;
  background: rgba(247, 239, 221, 0.1);
  box-shadow: inset 0 0 0 1.5px rgba(247, 239, 221, 0.25);
  font-size: 13px;
  font-weight: 700;
}
.toggle.on {
  background: var(--gold);
  color: #4a3208;
}
.seg {
  display: flex;
  gap: 6px;
}
.seg-btn {
  padding: 7px 14px;
  border-radius: 999px;
  background: rgba(247, 239, 221, 0.1);
  box-shadow: inset 0 0 0 1.5px rgba(247, 239, 221, 0.25);
  font-size: 13px;
}
.seg-btn.on {
  background: var(--gold);
  color: #4a3208;
}
.input {
  width: 120px;
  padding: 8px 12px;
  border-radius: 8px;
  border: 1.5px solid rgba(247, 239, 221, 0.3);
  background: rgba(0, 0, 0, 0.25);
  color: var(--cream);
  text-align: right;
  outline: none;
}
.tip {
  padding: 14px 0;
  font-size: 11.5px;
  color: var(--cream-dim);
  line-height: 1.7;
}
</style>
