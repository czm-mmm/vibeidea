<script setup lang="ts">
import type { PlayerState } from '@/core/types'
import CardBack from '@/ui/components/CardBack.vue'
import ChipIcon from '@/ui/components/ChipIcon.vue'
import AvatarIcon from '@/ui/components/AvatarIcon.vue'
import { avatarForSeat } from '@/ui/avatars'
import { useSettingsStore } from '@/stores/settings'

const settings = useSettingsStore()

defineProps<{
  player: PlayerState
  isCurrent: boolean
  thinking: boolean
}>()

function avatarOf(player: PlayerState): string {
  return player.isHuman ? settings.avatar : avatarForSeat(player.seat, settings.avatar)
}
</script>

<template>
  <div class="seat" :class="{ current: isCurrent, out: player.hand.length === 0 }">
    <div class="avatar" :class="{ spotlight: isCurrent, thinking: thinking && isCurrent }">
      <AvatarIcon :id="avatarOf(player)" :size="38" />
      <i v-if="player.marker" class="marker" title="Double Action 可用">🎩</i>
    </div>
    <div class="meta">
      <b class="name">{{ player.name }}</b>
      <span class="sub">
        <span class="count">🂠 {{ player.hand.length }}</span>
        <span class="chips"><ChipIcon kind="scout" :size="14" />{{ player.chips }}</span>
        <span class="won">★{{ player.collected.length }}</span>
      </span>
      <span v-if="player.hand.length === 0" class="done">演出结束 🏁</span>
      <span v-else-if="thinking && isCurrent" class="think">思考中…</span>
    </div>
    <div class="backs" aria-hidden="true">
      <CardBack v-for="i in Math.min(player.hand.length, 4)" :key="i" :width="22" :style="{ marginLeft: i > 1 ? '-14px' : '0' }" />
    </div>
  </div>
</template>

<style scoped>
.seat {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 10px;
  border-radius: 12px;
  background: rgba(10, 30, 22, 0.55);
  box-shadow: inset 0 0 0 1px rgba(247, 239, 221, 0.12);
  transition: all var(--dur-mid);
  min-width: 128px;
}
.seat.current {
  background: rgba(233, 178, 60, 0.14);
  box-shadow: inset 0 0 0 1.5px var(--gold);
}
.seat.out {
  opacity: 0.65;
}
.avatar {
  position: relative;
  width: 38px;
  height: 38px;
  flex: none;
  border-radius: 50%;
}
.avatar-face {
  font-size: 20px;
}
.marker {
  position: absolute;
  right: -4px;
  bottom: -4px;
  font-size: 13px;
  font-style: normal;
  filter: drop-shadow(0 1px 1px rgba(0, 0, 0, 0.5));
}
.meta {
  display: flex;
  flex-direction: column;
  gap: 1px;
  min-width: 0;
}
.name {
  font-size: 12.5px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 90px;
}
.sub {
  display: flex;
  align-items: center;
  gap: 7px;
  font-size: 11px;
  opacity: 0.9;
}
.chips {
  display: inline-flex;
  align-items: center;
  gap: 2px;
}
.think {
  font-size: 10px;
  color: var(--gold);
}
.done {
  font-size: 10px;
  color: var(--teal);
}
.backs {
  margin-left: auto;
  display: flex;
}
</style>
