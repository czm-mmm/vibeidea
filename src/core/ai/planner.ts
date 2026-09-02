// ===== 难度二「艺人」：即时收益贪心 =====
//   G(a) = 减牌收益 + 收牌收益 + 结构改善 + 预计挖角筹码 − 给对手的筹码 − 结束风险
// 出牌优先级：
//   1. 能直接出完手牌，立即演出；
//   2. 能用强组制造「其他人都只能挖角」的封轮机会（三人局价值更高）；
//   3. 能吃较大牌型时，用刚好能压过的最小组合，保留更强组合；
//   4. 挖角只在明显组合化（降 B / 成三连 / 桥接两组）时才摸；
//   5. 对手快出完时减牌优先，不再囤组；
//   6. 双动优先用于：关键桥牌 / 吃掉端点后用弱牌压剩余 / 阻止对手掌控节奏。

import type { AiStrategy } from './index'
import type { Card, GameAction, GameState, LegalShow, ScoutSpec } from '../types'
import { classify, legalShows } from '../rules'
import { evalHand, structGain } from '../metrics'
import { applyAction } from '../engine'

interface Scored {
  action: GameAction
  score: number
}

function oppRisk(state: GameState, seat: number): number {
  let risk = 0
  for (const p of state.players) {
    if (p.seat === seat) continue
    if (p.hand.length <= 3) risk += (4 - p.hand.length) * 0.9
  }
  return risk
}

/** 预计挖角筹码：出的组越长、对手手牌越多，越多人只能挖角。
 *  人数越多越要打折——组要经过更多玩家，至少一人能压过的概率很高（5 人局规格）。 */
function expectedChips(state: GameState, seat: number, setSize: number): number {
  const n = state.players.length
  let chips = 0
  for (const p of state.players) {
    if (p.seat === seat) continue
    const pBeat = Math.min(0.85, Math.max(0.15, 0.3 + 0.1 * setSize + 0.03 * (11 - p.hand.length)))
    chips += 1 - pBeat
  }
  const decay = n === 3 ? 1 : n === 4 ? 0.85 : 0.65
  return chips * decay
}

/** 封轮所需的最小组数：3 人 2 张 / 4 人 3 张 / 5 人 4 张（少于该数会被挖空，无法全员挖角） */
function lockMinLen(n: number): number {
  return n === 3 ? 2 : n === 4 ? 3 : 4
}

/** 是否把一条长链拆成了两截（出中间一段，两侧都还连着邻牌） */
function splitsChain(hand: readonly Card[], from: number, to: number): boolean {
  if (from === 0 || to >= hand.length - 1) return false
  const leftLinked = Math.abs(hand[from].top - hand[from - 1].top) <= 1
  const rightLinked = Math.abs(hand[to].top - hand[to + 1].top) <= 1
  return leftLinked && rightLinked
}

export function scoreShow(state: GameState, seat: number, s: LegalShow): number {
  const player = state.players[seat]
  const hand = player.hand
  const len = s.to - s.from + 1
  const m0 = evalHand(hand)
  const rest = [...hand.slice(0, s.from), ...hand.slice(s.to + 1)]
  const m1 = evalHand(rest)
  const n = state.players.length

  let g = len * 0.9 // 减牌
  if (state.active) g += state.active.cards.length // 收牌
  g += structGain(m0, m1, n) * 0.5 // 结构改善
  g += expectedChips(state, seat, len) * 0.9 // 预计挖角筹码

  const risk = oppRisk(state, seat)
  if (risk > 0) {
    g += risk * 0.5 * len // 对手快出完：减牌价值放大
    g -= risk * 0.3
  }

  // 直接出完
  if (hand.length === len) g += 6

  // 封轮潜力：达到人数对应的最低组数才有封轮资格（5 人局需 ≥4 张）
  if (len >= lockMinLen(n) && rest.length > 0) {
    g += n === 3 ? 1.1 : n === 4 ? 0.4 : 0.2
  }
  // 保留强组：吃掉最长链且剩下的不成组、剩牌还多
  if (len >= m0.L && m0.L >= 3 && m1.L < 2 && m1.N >= (n === 3 ? 5 : 7)) {
    g -= n === 3 ? 1.0 : 0.4
  }
  // 不为吃一张牌拆散长链（把链拆成两截）
  if (state.active && state.active.cards.length <= 2 && splitsChain(hand, s.from, s.to)) {
    g -= 0.7
  }
  return g
}

export function scoreScout(state: GameState, seat: number, spec: ScoutSpec): number {
  const player = state.players[seat]
  const set = state.active
  if (!set) return -Infinity
  const card = spec.end === 'left' ? set.cards[0] : set.cards[set.cards.length - 1]
  if (!card) return -Infinity
  const shown: Card = spec.flip ? { top: card.bottom, bottom: card.top } : { ...card }
  const m0 = evalHand(player.hand)
  const next = [...player.hand]
  next.splice(Math.min(spec.insertAt, next.length), 0, shown)
  const m1 = evalHand(next)
  const n = state.players.length
  const risk = oppRisk(state, seat)
  let g = structGain(m0, m1, n) - 1.0 - 0.2 // 明显组合化才值得给对手 1 分
  if (m1.L >= 3 && m0.L < 3) g += 0.5 // 形成可立即/下回合演出的三张组
  if (risk > 0) g -= risk * 0.8 // 有人快出完时不再加牌
  return g
}

export function scoreDoubleAction(state: GameState, seat: number, da: GameAction & { type: 'doubleAction' }): number {
  try {
    const res = applyAction(state, seat, da)
    const me = res.state.players[seat]
    const m0 = evalHand(state.players[seat].hand)
    const m1 = evalHand(me.hand)
    const gained = me.collected.length - state.players[seat].collected.length
    const risk = oppRisk(state, seat)
    let g = gained * 1.0 + structGain(m0, m1, state.players.length) * 0.5 - 1.0 - 0.3
    if (me.hand.length === 0) g += 4
    if (risk > 0) g += risk * 0.4 // 防守型双动：抢回主动权
    return g
  } catch {
    return -Infinity
  }
}

/** 枚举可行的双动候选（供二/三档共用） */
export function doubleActionCandidates(state: GameState, seat: number): Array<GameAction & { type: 'doubleAction' }> {
  const player = state.players[seat]
  const set = state.active
  if (!set || !player.marker) return []
  const out: Array<GameAction & { type: 'doubleAction' }> = []
  const ends: Array<'left' | 'right'> = set.cards.length === 1 ? ['left'] : ['left', 'right']
  for (const end of ends) {
    const card = end === 'left' ? set.cards[0] : set.cards[set.cards.length - 1]
    if (!card) continue
    const restCards = set.cards.filter((_, i) => i !== (end === 'left' ? 0 : set.cards.length - 1))
    const restCombo = restCards.length > 0 ? classify(restCards.map((c) => c.top)) : null
    for (let insertAt = 0; insertAt <= player.hand.length; insertAt++) {
      for (const flip of [false, true]) {
        const value = flip ? card.bottom : card.top
        const other = flip ? card.top : card.bottom
        const next = [...player.hand.slice(0, insertAt), { top: value, bottom: other }, ...player.hand.slice(insertAt)]
        for (const s of legalShows(next, restCombo)) {
          // 收益至少要吃回 ≥ 消耗的牌数才划算
          if (restCards.length + 1 >= s.to - s.from + 1) {
            out.push({ type: 'doubleAction', spec: { end, insertAt, flip }, from: s.from, to: s.to })
            if (out.length >= 4) return out
          }
        }
      }
    }
  }
  return out
}

/** 挖角候选按结构收益排序取前 K（供三档复用） */
export function topScoutSpecs(state: GameState, seat: number, k: number): ScoutSpec[] {
  const player = state.players[seat]
  const set = state.active
  if (!set) return []
  const ends: Array<'left' | 'right'> = set.cards.length === 1 ? ['left'] : ['left', 'right']
  const scored: Array<{ spec: ScoutSpec; score: number }> = []
  for (const end of ends) {
    const card = end === 'left' ? set.cards[0] : set.cards[set.cards.length - 1]
    if (!card) continue
    for (let insertAt = 0; insertAt <= player.hand.length; insertAt++) {
      for (const flip of [false, true]) {
        const spec: ScoutSpec = { end, insertAt, flip }
        scored.push({ spec, score: scoreScout(state, seat, spec) })
      }
    }
  }
  scored.sort((a, b) => b.score - a.score)
  return scored.slice(0, k).map((s) => s.spec)
}

/** 二档决策器（三档也用它为对手选择回应） */
export function chooseGreedy(state: GameState, seat: number): GameAction {
  const player = state.players[seat]
  const shows = legalShows(player.hand, state.active ? state.active.combo : null)

  const scored: Scored[] = []
  for (const s of shows) {
    scored.push({ action: { type: 'show', from: s.from, to: s.to }, score: scoreShow(state, seat, s) })
  }
  for (const spec of topScoutSpecs(state, seat, 3)) {
    scored.push({ action: { type: 'scout', spec }, score: scoreScout(state, seat, spec) })
  }
  for (const da of doubleActionCandidates(state, seat)) {
    scored.push({ action: da, score: scoreDoubleAction(state, seat, da) })
  }
  if (scored.length === 0) {
    // 理论不可达兜底
    if (shows.length > 0) return { type: 'show', from: shows[0].from, to: shows[0].to }
    return { type: 'scout', spec: { end: 'left', insertAt: 0, flip: false } }
  }
  scored.sort((a, b) => b.score - a.score)
  return scored[0].action
}

export const heuristicStrategy: AiStrategy = {
  name: 'heuristic-greedy',
  chooseAction(state: GameState, seat: number): GameAction {
    return chooseGreedy(state, seat)
  },
}
