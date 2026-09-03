<script setup lang="ts">
import { onBeforeUnmount, onMounted, watch } from 'vue'
import { soundPlayer } from '@/audio'
import { useGameStore } from '@/stores/game'
import { useSettingsStore } from '@/stores/settings'
import HomeView from '@/ui/views/HomeView.vue'
import GameView from '@/ui/views/GameView.vue'
import RulesView from '@/ui/views/RulesView.vue'
import SettingsView from '@/ui/views/SettingsView.vue'

const game = useGameStore()
const settings = useSettingsStore()

watch(() => settings.sound, enabled => soundPlayer.setEnabled(enabled === true), { immediate: true, flush: 'sync' })
watch(() => game.view, () => soundPlayer.stop(), { flush: 'sync' })

function unlockSound() { void soundPlayer.unlock() }
function pauseBackgroundSound() {
  if (document.visibilityState === 'hidden') soundPlayer.stop()
}

onMounted(() => {
  settings.applyHtmlClass()
  document.addEventListener('pointerdown', unlockSound, { capture: true, passive: true })
  document.addEventListener('keydown', unlockSound, true)
  document.addEventListener('visibilitychange', pauseBackgroundSound)
})
onBeforeUnmount(() => {
  document.removeEventListener('pointerdown', unlockSound, true)
  document.removeEventListener('keydown', unlockSound, true)
  document.removeEventListener('visibilitychange', pauseBackgroundSound)
  soundPlayer.dispose()
})
</script>

<template>
  <Transition name="view" mode="out-in">
    <component
      :is="
        game.view === 'home' ? HomeView :
        game.view === 'game' ? GameView :
        game.view === 'rules' ? RulesView :
        SettingsView
      "
      :key="game.view"
    />
  </Transition>
  <div v-if="game.toast" class="toast" :class="game.toast.kind">{{ game.toast.text }}</div>
</template>
