// ===== 难度三「团长」：一圈全信息前瞻 =====
// 假设知道其他玩家的完整手牌，对每个候选行动推演一整圈：
//   - 对手能否直接演出；
//   - 对手能否挖角某端后用双动压过；
//   - 对手挖角后剩余牌型会不会被下一人吃掉；
//   - 牌型被挖空时桌面清空、下家必须演出（边界：三人局 2 张组挡不住两人各挖一次）；
//   - 本轮若立即结束，取各家准确分数。
// 决策重点：确保全员压不过的强组直接封轮（封轮者免剩牌罚分）；
// 只有部分对手能压时，由推演比较强行升级 / 出弱牌诱导 / 挖角改造的最终收益；
// 对手的回应由二档决策器在全信息下选出（他们也会用双动抢节奏）。

import type { AiStrategy } from './index'
import type { GameAction, GameState } from '../types'
import { applyAction } from '../engine'
import { evalHand } from '../metrics'
import { chooseGreedy, scoreShow, topScoutSpecs, doubleActionCandidates } from './planner'
import { legalShows } from '../rules'

/** 推演一圈后的己方效用：本轮得分 + 手牌续战价值 − 最强对手入账 */
function evaluateCircle(afterMyMove: GameState, meSeat: number): number {
  let cur = afterMyMove
  for (let step = 0; step < cur.players.length - 1; step++) {
    if (cur.phase !== 'playing') break
    const oppSeat = cur.current
    if (oppSeat === meSeat) break
    cur = applyAction(cur, oppSeat, chooseGreedy(cur, oppSeat)).state
  }

  const me = cur.players[meSeat]
  if (cur.phase === 'roundEnd' && cur.lastResult) {
    const row = cur.lastResult.rows.find((r) => r.seat === meSeat)!
    let u = row.points
    if (cur.lastResult.condition === 'allScouted' && cur.lastResult.finisherSeat === meSeat) u += 0.8
    return u
  }

  // 一圈后回到自己：本轮已入账 + 手牌续战价值 − 最强对手入账
  const n = cur.players.length
  const myAccrued = me.collected.length + me.chips
  const m = evalHand(me.hand)
  // 四人局及以上：手里多留一张牌的风险更高（要连续躲过更多玩家），减牌权重加大
  const continuation = -m.B * 0.7 - m.N * (n === 3 ? 0.05 : 0.1)
  let bestOpp = -Infinity
  for (const p of cur.players) {
    if (p.seat === meSeat) continue
    const v = p.collected.length + p.chips + p.hand.length * 0.08
    if (v > bestOpp) bestOpp = v
  }
  // 有人快出完时的危险：只按自己还没打掉的牌的比例计价（打光在即则无所谓）
  const oppMinHand = Math.min(...cur.players.filter((p) => p.seat !== meSeat).map((p) => p.hand.length))
  const danger = oppMinHand <= 2 ? (0.8 + 0.2 * (n - 3)) * (m.N / 9) : 0
  // 人数越多越按规格走稳健线路：重视自己的减牌与收牌（入账），少纠结压制对手
  const myWeight = 1 + 0.15 * (n - 3)
  const oppWeight = n === 3 ? 0.4 : 0.3
  return myAccrued * myWeight + continuation - Math.max(0, bestOpp) * oppWeight - danger
}

export const oracleStrategy: AiStrategy = {
  name: 'oracle-lookahead',
  chooseAction(state: GameState, seat: number): GameAction {
    const player = state.players[seat]
    const shows = legalShows(player.hand, state.active ? state.active.combo : null)

    type Cand = { action: GameAction }
    const cands: Cand[] = []

    // 演出候选：按二档粗排取前 10，兼顾「刚好压过」与「强组封轮」两类
    const showScored = shows
      .map((s) => ({ s, q: scoreShow(state, seat, s) }))
      .sort((a, b) => b.q - a.q)
    for (const { s } of showScored.slice(0, 10)) {
      cands.push({ action: { type: 'show', from: s.from, to: s.to } })
    }
    // 挖角候选：结构分前 3
    for (const spec of topScoutSpecs(state, seat, 3)) {
      cands.push({ action: { type: 'scout', spec } })
    }
    // 双动候选前 2
    for (const da of doubleActionCandidates(state, seat).slice(0, 2)) {
      cands.push({ action: da })
    }

    let best: { action: GameAction; utility: number } | null = null
    for (const c of cands) {
      try {
        const after = applyAction(state, seat, c.action).state
        const u = evaluateCircle(after, seat)
        if (!best || u > best.utility) best = { action: c.action, utility: u }
      } catch {
        // 非法候选跳过
      }
    }
    if (best) return best.action
    return chooseGreedy(state, seat)
  },
}

/** 兼容旧命名：hard 难度即全信息前瞻 */
export const plannerStrategy = oracleStrategy
