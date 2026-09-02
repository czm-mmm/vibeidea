<script setup lang="ts">
import { onMounted } from 'vue'
import { useGameStore } from '@/stores/game'
import { useSettingsStore } from '@/stores/settings'
import HomeView from '@/ui/views/HomeView.vue'
import GameView from '@/ui/views/GameView.vue'
import RulesView from '@/ui/views/RulesView.vue'
import SettingsView from '@/ui/views/SettingsView.vue'

const game = useGameStore()
const settings = useSettingsStore()

onMounted(() => settings.applyHtmlClass())
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
