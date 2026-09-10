// ===== 难度一「学徒」：基于旧中等策略的次优决策 =====
// 合法行动仍由旧中等启发式完整评分，但有意识地选择次优解：
//   70% 第二名 / 20% 第三名 / 10% 第一名。
// 只有一个合法行动，或存在立即打光手牌的行动时，不故意犯错。

import type { AiStrategy } from './index'
import type { GameAction, GameState } from '../types'
import { rankedHeuristicActions } from './planner'

export function chooseSuboptimal(state: GameState, seat: number, rng: () => number): GameAction {
  const ranked = rankedHeuristicActions(state, seat)
  if (ranked.length === 0) return { type: 'show', from: 0, to: 0 }

  const handSize = state.players[seat].hand.length
  const immediateWin = ranked.find(({ action }) =>
    action.type === 'show' && action.to - action.from + 1 === handSize,
  )
  if (immediateWin) return immediateWin.action
  if (ranked.length === 1) return ranked[0].action

  const roll = rng()
  const rank = roll < 0.7 ? 1 : roll < 0.9 ? 2 : 0
  return ranked[Math.min(rank, ranked.length - 1)].action
}

export const suboptimalStrategy: AiStrategy = {
  name: 'heuristic-suboptimal',
  chooseAction(state: GameState, seat: number, rng: () => number): GameAction {
    return chooseSuboptimal(state, seat, rng)
  },
}
