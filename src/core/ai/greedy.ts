// ===== 难度一「学徒」：单步手牌结构优化 =====
// 只看行动后自己的手牌，不考虑其他玩家：
//   max(ΔB, ΔP, L) − 新增手牌
// - 起手/翻面以 B 最小为准（翻面在引擎里用 metrics.betterFlip）；
// - 优先打掉破坏结构的孤张，不拆已有的对子/三张组；
// - 挖角只有让 B 下降、形成三连/三同、或同时桥接左右两组时才有价值；
// - 结构收益相同时先出较短较弱的一组，保留强组合作后期封轮牌。

import type { AiStrategy } from './index'
import type { Card, GameAction, GameState } from '../types'
import { legalShows } from '../rules'
import { evalHand, structGain, type HandMetrics } from '../metrics'

interface Candidate {
  action: GameAction
  score: number
  len: number
  low: number
}

/** 行动后的手牌（仅本地推演，不改真实状态） */
function handAfterShow(hand: readonly Card[], from: number, to: number): Card[] {
  return [...hand.slice(0, from), ...hand.slice(to + 1)]
}

function handAfterScout(hand: readonly Card[], card: Card, insertAt: number, flip: boolean): Card[] {
  const shown = flip ? { top: card.bottom, bottom: card.top } : { ...card }
  const next = [...hand]
  next.splice(Math.min(insertAt, next.length), 0, shown)
  return next
}

/** 是否拆掉了已有的 ≥2 组合（被移除段内部本来连成一片） */
function breaksChain(hand: readonly Card[], from: number, to: number): boolean {
  for (let i = from; i < to; i++) {
    const d = Math.abs(hand[i + 1].top - hand[i].top)
    if (d <= 1) return true
  }
  return false
}

export function structureCandidates(state: GameState, seat: number): Candidate[] {
  const player = state.players[seat]
  const hand = player.hand
  const n = state.players.length
  const m0: HandMetrics = evalHand(hand)
  const out: Candidate[] = []

  // ---- 表演候选：评估出牌后的手牌结构 ----
  for (const s of legalShows(hand, state.active ? state.active.combo : null)) {
    const rest = handAfterShow(hand, s.from, s.to)
    const m1 = evalHand(rest)
    let score = structGain(m0, m1, n) + (s.to - s.from) * (n >= 5 ? 0.2 : 0.1)
    // 孤张优先：被移除段与两侧都不相连 → 小奖励（5 人局更看重）
    const isolated =
      (s.from === 0 || Math.abs(hand[s.from].top - hand[s.from - 1].top) > 1) &&
      (s.to === hand.length - 1 || Math.abs(hand[s.to].top - hand[s.to + 1].top) > 1)
    if (isolated) score += n >= 5 ? 0.6 : 0.4
    // 拆链惩罚：移除段内部原本连成一片
    if (breaksChain(hand, s.from, s.to)) score -= 1.0
    // 保留终结组：吃掉全场最长链且剩下的 L<2、剩牌还多 → 扣分（三人局更重）
    const leftover = evalHand(rest)
    const isLongest = s.to - s.from + 1 >= m0.L && m0.L >= 3
    const lockThreshold = n === 3 ? 5 : 7
    if (isLongest && leftover.L < 2 && m1.N >= lockThreshold) {
      score -= n === 3 ? 1.2 : 0.6
    }
    out.push({ action: { type: 'show', from: s.from, to: s.to }, score, len: s.to - s.from, low: s.combo.low })
  }

  // ---- 挖角候选：所有（端点 × 缝隙 × 朝向），单张牌型只算一端 ----
  const set = state.active
  if (set) {
    const ends: Array<'left' | 'right'> =
      set.cards.length === 1 ? ['left'] : ['left', 'right']
    for (const end of ends) {
      const card: Card | undefined = end === 'left' ? set.cards[0] : set.cards[set.cards.length - 1]
      if (!card) continue
      for (let insertAt = 0; insertAt <= hand.length; insertAt++) {
        for (const flip of [false, true]) {
          const m1 = evalHand(handAfterScout(hand, card, insertAt, flip))
          let score = structGain(m0, m1, n) - 1.0 - 0.2 // 加一张牌成本 + 给对手 1 金币
          // 形成三连/三同（L≥3）额外加分；桥接两组（桥位消耗）由 P 增量体现
          if (m1.L >= 3 && m0.L < 3) score += 0.5
          out.push({
            action: { type: 'scout', spec: { end, insertAt, flip } },
            score,
            len: 0,
            low: 0,
          })
        }
      }
    }
  }
  return out
}

export const greedyStrategy: AiStrategy = {
  name: 'greedy-structure',
  chooseAction(state: GameState, seat: number): GameAction {
    const cands = structureCandidates(state, seat)
    if (cands.length === 0) {
      // 理论不可达：无 active 必有单张可演出，有 active 必可挖角
      return { type: 'show', from: 0, to: 0 }
    }
    let best = cands[0]
    for (const c of cands) {
      if (c.score > best.score) best = c
    }
    // 结构收益相同时先出较短、较弱的一组
    const ties = cands.filter(
      (c) => Math.abs(c.score - best.score) < 1e-9 && c.action.type === 'show' && best.action.type === 'show',
    )
    if (ties.length > 1) {
      ties.sort((a, b) => a.len - b.len || a.low - b.low)
      return ties[0].action
    }
    return best.action
  },
}
