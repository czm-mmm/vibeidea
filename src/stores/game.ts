import { defineStore, acceptHMRUpdate } from 'pinia'
import {
  applyAction as coreApply,
  createGame,
  startNextRound,
} from '@/core/engine'
import { classify, legalShows } from '@/core/rules'
import { mulberry32 } from '@/core/rng'
import { greedyStrategy, heuristicStrategy, plannerStrategy } from '@/core/ai'
import type { AiStrategy } from '@/core/ai'
import type { GameAction, GameConfig, GameEvent, GameState, PlayerConfig, ScoutSpec } from '@/core/types'
import type { Combo, LegalShow } from '@/core/types'
import { RuleError } from '@/core/types'
import type { Difficulty } from '@/core/types'
import { soundPlayer } from '@/audio'

export type ViewName = 'home' | 'game' | 'rules' | 'settings'

export interface NewGameOptions {
  playerCount: number
  difficulty: Difficulty
  nickname: string
}

/** UI 瞬态：选牌范围（手牌下标，含端点） */
export interface Selection {
  from: number
  to: number
}

/** 侦察流程状态 */
export interface ScoutFlow {
  step: 'pickEnd' | 'pickInsert'
  end: 'left' | 'right' | null
  flip: boolean
}

interface GameStoreState {
  view: ViewName
  state: GameState | null
  /** 本回合最后一批事件（驱动动画/文案） */
  lastEvents: GameEvent[]
  selection: Selection | null
  scoutFlow: ScoutFlow | null
  /** 双动：侦察完成后的出牌阶段 */
  doubleShowPending: boolean
  /** 双动：已确定的侦察参数，等待玩家选牌表演 */
  pendingSpec: ScoutSpec | null
  toast: { text: string; kind: 'info' | 'warn' | 'good' } | null
  aiThinking: number | null
  humanSeat: number
  /** 结算面板显示时机 */
  showRoundResult: boolean
  showGameOver: boolean
}

function strategyFor(difficulty: Difficulty): AiStrategy {
  if (difficulty === 'easy') return greedyStrategy
  if (difficulty === 'normal') return heuristicStrategy
  return plannerStrategy
}

const AI_NAMES = ['Ada', 'Bram', 'Cy', 'Dex', 'Echo']

let aiTimer: ReturnType<typeof setTimeout> | null = null
let toastTimer: ReturnType<typeof setTimeout> | null = null

// ===== 模块级纯函数：getters 统一走这里，避免 Pinia getter 的 this 类型推断问题 =====
function humanTurnOf(state: GameStoreState): boolean {
  return !!state.state && state.state.phase === 'playing' && state.state.current === state.humanSeat
}

/** 表演要压的目标：平时是当前牌型；双动侦察后是「拿走一张后的剩余牌型」 */
function beatTargetOf(state: GameStoreState): Combo | null {
  const s = state.state
  if (!s || !s.active) return null
  if (state.pendingSpec?.end) {
    const idx = state.pendingSpec.end === 'left' ? 0 : s.active.cards.length - 1
    const rest = s.active.cards.filter((_, i) => i !== idx)
    return rest.length > 0 ? classify(rest.map((c) => c.top)) : null
  }
  return s.active.combo
}

/** 双动侦察后的手牌预览：牌按 spec 插入后的样子（引擎会以这份手牌校验 from/to） */
function previewHandOf(state: GameStoreState): import('@/core/types').Card[] | null {
  const s = state.state
  const spec = state.pendingSpec
  if (!s || !s.active || !spec?.end) return null
  const idx = spec.end === 'left' ? 0 : s.active.cards.length - 1
  const card = s.active.cards[idx]
  if (!card) return null
  const inserted: import('@/core/types').Card = spec.flip
    ? { top: card.bottom, bottom: card.top }
    : { ...card }
  const hand = s.players[state.humanSeat].hand
  const next = [...hand]
  next.splice(Math.min(spec.insertAt, next.length), 0, inserted)
  return next
}

function legalShowsOf(state: GameStoreState): LegalShow[] {
  if (!state.state || !humanTurnOf(state)) return []
  const p = state.state.players[state.humanSeat]
  const hand = previewHandOf(state) ?? p.hand
  return legalShows(hand, beatTargetOf(state))
}

export const useGameStore = defineStore('game', {
  state: (): GameStoreState => ({
    view: 'home',
    state: null,
    lastEvents: [],
    selection: null,
    scoutFlow: null,
    doubleShowPending: false,
    pendingSpec: null,
    toast: null,
    aiThinking: null,
    humanSeat: 0,
    showRoundResult: false,
    showGameOver: false,
  }),

  getters: {
    human(state): GameState['players'][number] | null {
      return state.state ? state.state.players[state.humanSeat] : null
    },
    isHumanTurn(state): boolean {
      return humanTurnOf(state)
    },
    /** 双动侦察后，表演要压的目标：剩余牌型（拿走一张后的样子） */
    beatTargetCombo(state): Combo | null {
      return beatTargetOf(state)
    },
    /** 人类当前所有合法出牌块 */
    humanLegalShows(state): LegalShow[] {
      return legalShowsOf(state)
    },
    /** 双动侦察后的手牌预览（UI 用它渲染选牌阶段） */
    previewHand(state): import('@/core/types').Card[] | null {
      return previewHandOf(state)
    },
    /** 手牌下标 → 是否在某合法块内（用于描边高亮） */
    legalHintMap(state): Map<number, 'run' | 'group'> {
      const map = new Map<number, 'run' | 'group'>()
      for (const s of legalShowsOf(state)) {
        for (let i = s.from; i <= s.to; i++) {
          if (!map.has(i)) map.set(i, s.combo.kind === 'run' || s.combo.kind === 'single' ? 'run' : 'group')
        }
      }
      return map
    },
    canScout(state): boolean {
      return !!state.state && humanTurnOf(state) && !!state.state.active
    },
    canDoubleAction(state): boolean {
      if (!state.state || !humanTurnOf(state)) return false
      const p = state.state.players[state.humanSeat]
      return !!state.state.active && p.marker
    },
    /** 当前选中的块是否恰好是一个合法出牌 */
    selectionLegal(state): { ok: boolean; reason: string } {
      if (!state.selection || !state.state) return { ok: false, reason: '先选牌' }
      const { from, to } = state.selection
      const found = legalShowsOf(state).find((s) => s.from === from && s.to === to)
      if (found) return { ok: true, reason: '' }
      // 给出不合法原因
      const hand = state.state.players[state.humanSeat].hand
      const vals = hand.slice(Math.min(from, to), Math.max(from, to) + 1).map((c) => c.top)
      const same = vals.every((v) => v === vals[0])
      if (!same) {
        const asc = [...vals].every((v, i) => i === 0 || v - vals[i - 1] === 1)
        const desc = [...vals].every((v, i) => i === 0 || vals[i - 1] - v === 1)
        if (!asc && !desc) return { ok: false, reason: '不是同数或连续' }
      }
      if (beatTargetOf(state)) return { ok: false, reason: '压不过当前牌型' }
      return { ok: false, reason: '不合法' }
    },
  },

  actions: {
    goto(view: ViewName) {
      this.view = view
    },

    showToast(text: string, kind: 'info' | 'warn' | 'good' = 'info') {
      this.toast = { text, kind }
      if (toastTimer) clearTimeout(toastTimer)
      toastTimer = setTimeout(() => (this.toast = null), 2200)
    },

    startGame(opts: NewGameOptions) {
      if (aiTimer) clearTimeout(aiTimer)
      const players: PlayerConfig[] = [
        { name: opts.nickname || '你', isHuman: true, difficulty: 'easy' },
        ...Array.from({ length: opts.playerCount - 1 }, (_, i) => ({
          name: AI_NAMES[i] ?? `AI-${i + 1}`,
          isHuman: false,
          difficulty: opts.difficulty,
        })),
      ]
      const config: GameConfig = {
        players,
        seed: (Date.now() ^ (Math.random() * 0xffffffff)) >>> 0,
      }
      this.state = createGame(config)
      this.humanSeat = 0
      this.lastEvents = []
      this.selection = null
      this.scoutFlow = null
      this.doubleShowPending = false
      this.showRoundResult = false
      this.showGameOver = false
      this.view = 'game'
      this.scheduleAi()
    },

    /** 引擎应用 + 事件分发 */
    dispatch(seat: number, action: GameAction) {
      if (!this.state) return
      let result
      try {
        result = coreApply(this.state, seat, action)
      } catch (e) {
        if (e instanceof RuleError) {
          this.showToast(e.message, 'warn')
          return
        }
        throw e
      }
      this.state = result.state
      this.lastEvents = result.events
      this.selection = null
      this.scoutFlow = null
      this.pendingSpec = null

      for (const ev of result.events) {
        if (ev.type === 'show' && this.view === 'game') void soundPlayer.play('play')
        if (ev.type === 'show' && ev.wentOut) this.showToast(`${this.state.players[ev.seat].name} 打光手牌！`, 'good')
        if (ev.type === 'roundEnd') {
          if (this.state!.roundNumber >= this.state!.totalRounds) this.showGameOver = true
          else this.showRoundResult = true
        }
      }
      this.scheduleAi()
    },

    /** AI 行动调度：轮到 AI 时延迟 600~1200ms 出招 */
    scheduleAi() {
      if (aiTimer) clearTimeout(aiTimer)
      const s = this.state
      if (!s || s.phase !== 'playing') {
        this.aiThinking = null
        return
      }
      const seat = s.current
      if (s.players[seat].isHuman) {
        this.aiThinking = null
        return
      }
      this.aiThinking = seat
      const delay = 600 + Math.random() * 600
      aiTimer = setTimeout(() => {
        const cur = this.state
        if (!cur || cur.phase !== 'playing' || cur.current !== seat) return
        const strategy = strategyFor(cur.players[seat].difficulty)
        const rng = mulberry32((Math.random() * 0xffffffff) >>> 0)
        const action = strategy.chooseAction(cur, seat, rng)
        this.dispatch(seat, action)
      }, delay)
    },

    // ---------- 人类交互 ----------

    decideFlip(flip: boolean) {
      if (!this.state || this.state.phase !== 'flip') return
      this.dispatch(this.humanSeat, { type: 'flipHand', flip })
    },

    /** 点一张牌：无选区→设起点；有起点→设终点（自动排序） */
    tapCard(index: number) {
      if (this.doubleShowPending) {
        this.tapDoubleShow(index)
        return
      }
      if (!this.isHumanTurn) return
      if (!this.human || !Number.isInteger(index) || index < 0 || index >= this.human.hand.length) return
      if (!this.selection) {
        this.selection = { from: index, to: index }
        void soundPlayer.play('select')
        return
      }
      const from = Math.min(this.selection.from, index)
      const to = Math.max(this.selection.from, index)
      const changed = this.selection.from !== from || this.selection.to !== to
      this.selection = { from, to }
      if (changed) void soundPlayer.play('select')
    },

    clearSelection() {
      if (!this.isHumanTurn) return
      this.selection = null
    },

    performShow() {
      if (!this.isHumanTurn || !this.selection) return
      this.dispatch(this.humanSeat, { type: 'show', from: this.selection.from, to: this.selection.to })
    },

    beginScout() {
      if (!this.canScout) return
      this.selection = null
      this.scoutFlow = { step: 'pickEnd', end: null, flip: false }
    },

    beginDoubleAction() {
      if (!this.canDoubleAction) return
      this.selection = null
      this.scoutFlow = { step: 'pickEnd', end: null, flip: false }
      this.doubleShowPending = true
    },

    pickScoutEnd(end: 'left' | 'right') {
      if (!this.scoutFlow) return
      this.scoutFlow.end = end
      this.scoutFlow.step = 'pickInsert'
    },

    toggleScoutFlip() {
      if (this.scoutFlow) this.scoutFlow.flip = !this.scoutFlow.flip
    },

    /** 选插入缝隙：插到当前第 insertAt 张之前 */
    pickScoutInsert(insertAt: number) {
      if (!this.scoutFlow || !this.scoutFlow.end || !this.state) return
      const spec: ScoutSpec = { end: this.scoutFlow.end, insertAt, flip: this.scoutFlow.flip }
      if (this.doubleShowPending) {
        // 双动：先记下侦察参数，牌还没到手；接着选手牌里的一块立刻表演
        this.pendingSpec = spec
        this.scoutFlow = null
        this.showToast('挖角完成！立刻选一块牌演出', 'info')
        return
      }
      this.dispatch(this.humanSeat, { type: 'scout', spec })
    },

    tapDoubleShow(index: number) {
      if (!this.pendingSpec || !this.state) return
      if (!Number.isInteger(index) || index < 0 || index >= (this.previewHand?.length ?? 0)) return
      if (!this.selection) {
        this.selection = { from: index, to: index }
        void soundPlayer.play('select')
        return
      }
      const from = Math.min(this.selection.from, index)
      const to = Math.max(this.selection.from, index)
      const changed = this.selection.from !== from || this.selection.to !== to
      this.selection = { from, to }
      if (changed) void soundPlayer.play('select')
    },

    performDoubleShow() {
      if (!this.pendingSpec || !this.selection) return
      const spec = this.pendingSpec
      this.pendingSpec = null
      this.doubleShowPending = false
      this.dispatch(this.humanSeat, { type: 'doubleAction', spec, from: this.selection.from, to: this.selection.to })
    },

    cancelScout() {
      this.scoutFlow = null
      if (this.doubleShowPending && !this.pendingSpec) this.doubleShowPending = false
      if (this.pendingSpec) {
        // 已侦察未出牌：不允许取消（规则上双动侦察后必须表演），提示原因
        this.showToast('双动已挖角，必须演出一块牌', 'warn')
        return
      }
      this.selection = null
    },

    nextRound() {
      if (!this.state) return
      this.showRoundResult = false
      this.state = startNextRound(this.state)
      this.lastEvents = []
      this.selection = null
      this.scoutFlow = null
      this.doubleShowPending = false
      this.pendingSpec = null
      this.scheduleAi()
    },

    backHome() {
      if (aiTimer) clearTimeout(aiTimer)
      this.view = 'home'
      this.state = null
    },
  },
})

// 开发期热更新：保留运行中的对局状态，只替换 store 定义
if (import.meta.hot) {
  import.meta.hot.accept(acceptHMRUpdate(useGameStore, import.meta.hot))
}
