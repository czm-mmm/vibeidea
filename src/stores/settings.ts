import { defineStore, acceptHMRUpdate } from 'pinia'

export type AnimSpeed = 'normal' | 'slow' | 'off'

interface SettingsState {
  sound: boolean
  animSpeed: AnimSpeed
  colorBlind: boolean
  nickname: string
  /** 马戏团角色头像（AvatarId） */
  avatar: string
}

const KEY = 'scout-web.settings.v1'

function load(): SettingsState {
  const defaults: SettingsState = { sound: false, animSpeed: 'normal', colorBlind: false, nickname: '你', avatar: 'clown' }
  try {
    const raw = localStorage.getItem(KEY)
    if (raw) return { ...defaults, ...JSON.parse(raw) }
  } catch {
    /* 忽略损坏数据 */
  }
  return defaults
}

export const useSettingsStore = defineStore('settings', {
  state: (): SettingsState => load(),
  actions: {
    persist() {
      try {
        localStorage.setItem(KEY, JSON.stringify(this.$state))
      } catch {
        // Blocked/full storage should not stop controls working this session.
      }
    },
    applyHtmlClass() {
      const html = document.documentElement
      html.classList.toggle('cb', this.colorBlind)
      html.classList.remove('speed-slow', 'speed-off')
      if (this.animSpeed === 'slow') html.classList.add('speed-slow')
      if (this.animSpeed === 'off') html.classList.add('speed-off')
    },
    set<K extends keyof SettingsState>(key: K, value: SettingsState[K]) {
      this.$state[key] = value
      this.persist()
      this.applyHtmlClass()
    },
  },
})

// 开发期热更新
if (import.meta.hot) {
  import.meta.hot.accept(acceptHMRUpdate(useSettingsStore, import.meta.hot))
}
