// ===== 难度三「团长」：AI 联盟策略 =====
// - 所有 AI 共享彼此的完整手牌与公开局面；
// - 不读取真人手牌内容，只使用真人的公开手牌数量、筹码和已收牌；
// - 不新增任何换牌动作，合作只能通过合法的 Show / Scout / Double Action 完成；
// - 目标是提高最领先 AI 及 AI 整体相对真人的优势，而非当前行动者的个人收益。

import type { AiStrategy } from './index'
import type { GameAction, GameState } from '../types'
import { applyAction } from '../engine'
import { evalHand } from '../metrics'
import { kindRank, legalShows } from '../rules'
import { chooseGreedy, doubleActionCandidates, scoreShow, topScoutSpecs } from './planner'

function coalitionCandidates(state: GameState, seat: number, compact = false): GameAction[] {
  const player = state.players[seat]
  const shows = legalShows(player.hand, state.active ? state.active.combo : null)
    .map((show) => ({ show, score: scoreShow(state, seat, show) }))
    .sort((a, b) => b.score - a.score)
    .slice(0, compact ? 6 : 10)
    .map(({ show }) => ({ type: 'show', from: show.from, to: show.to }) as GameAction)

  const scouts = topScoutSpecs(state, seat, compact ? 2 : 3)
    .map((spec) => ({ type: 'scout', spec }) as GameAction)
  const doubles = doubleActionCandidates(state, seat)
    .slice(0, compact ? 1 : 2)

  return [...shows, ...scouts, ...doubles]
}

function roundEndUtility(state: GameState): number | null {
  if (state.phase !== 'roundEnd' || !state.lastResult) return null
  const aiTotals = state.lastResult.rows.filter((row) => !state.players[row.seat].isHuman).map((row) => row.total)
  const humanTotals = state.lastResult.rows.filter((row) => state.players[row.seat].isHuman).map((row) => row.total)
  if (aiTotals.length === 0) return 0
  const aiLeader = Math.max(...aiTotals)
  const aiAverage = aiTotals.reduce((sum, value) => sum + value, 0) / aiTotals.length
  const humanLeader = humanTotals.length > 0 ? Math.max(...humanTotals) : 0
  return (aiLeader - humanLeader) * 4 + (aiAverage - humanLeader) * 1.25
}

/**
 * 联盟效用只检查 AI 私有手牌；真人部分只看公开的牌数/筹码/收牌数。
 * 这样修改真人手牌的具体数字但保持张数不变，不会改变困难 AI 的判断。
 */
export function coalitionUtility(state: GameState): number {
  const ended = roundEndUtility(state)
  if (ended !== null) return ended

  const aiValues: Array<{ seat: number; value: number }> = []
  const humanValues: number[] = []
  for (const player of state.players) {
    const publicScore = state.totals[player.seat] + player.collected.length + player.chips
    if (player.isHuman) {
      // 手牌越少，越接近打光；绝不读取 top/bottom 或排列。
      const finishThreat = Math.max(0, 5 - player.hand.length) * 0.9
      humanValues.push(publicScore + finishThreat)
      continue
    }
    const metrics = evalHand(player.hand)
    const readiness = -metrics.B * 0.75 - metrics.N * 0.08 + metrics.L * 0.22 + metrics.P * 0.08
    aiValues.push({ seat: player.seat, value: publicScore + readiness })
  }

  if (aiValues.length === 0) return 0
  const leader = aiValues.reduce((best, value) => value.value > best.value ? value : best)
  const aiAverage = aiValues.reduce((sum, item) => sum + item.value, 0) / aiValues.length
  const humanLeader = humanValues.length > 0 ? Math.max(...humanValues) : 0
  let utility = (leader.value - humanLeader) * 3 + (aiAverage - humanLeader) * 0.8

  const active = state.active
  if (active) {
    const strength = active.cards.length * 1.25 + kindRank(active.combo.kind) * 0.45 + active.combo.low * 0.04
    const ownerIsHuman = state.players[active.ownerSeat].isHuman
    utility += ownerIsHuman ? -strength * 0.35 : strength * 0.22
    if (!ownerIsHuman && active.ownerSeat === leader.seat) utility += 0.45

    // 真人马上行动时，强 AI 牌型更可能迫使其挖角；这里只按公开牌型估算。
    if (state.players[state.current].isHuman) utility += ownerIsHuman ? -0.5 : strength * 0.18
  }
  return utility
}

function bestImmediateCoalitionAction(state: GameState, seat: number): GameAction {
  let best: { action: GameAction; utility: number } | null = null
  for (const action of coalitionCandidates(state, seat, true)) {
    try {
      const after = applyAction(state, seat, action).state
      const utility = coalitionUtility(after)
      if (!best || utility > best.utility) best = { action, utility }
    } catch {
      // 非法候选跳过。
    }
  }
  return best?.action ?? chooseGreedy(state, seat)
}

/** 推演真人行动前最多两名盟友的合法配合；不会模拟或查看真人手牌。 */
function projectAlliedTurns(state: GameState, originSeat: number): GameState {
  let projected = state
  for (let step = 0; step < 2; step++) {
    if (projected.phase !== 'playing') break
    const seat = projected.current
    if (seat === originSeat || projected.players[seat].isHuman) break
    try {
      projected = applyAction(projected, seat, bestImmediateCoalitionAction(projected, seat)).state
    } catch {
      break
    }
  }
  return projected
}

export const coalitionStrategy: AiStrategy = {
  name: 'coalition-lookahead',
  chooseAction(state: GameState, seat: number): GameAction {
    let best: { action: GameAction; utility: number } | null = null
    for (const action of coalitionCandidates(state, seat)) {
      try {
        const after = applyAction(state, seat, action).state
        const projected = projectAlliedTurns(after, seat)
        const utility = coalitionUtility(projected)
        if (!best || utility > best.utility) best = { action, utility }
      } catch {
        // 非法候选跳过。
      }
    }
    return best?.action ?? chooseGreedy(state, seat)
  },
}
