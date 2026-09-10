// ===== AI 策略接口 =====
// 三层难度：
//   学徒 suboptimal = 以旧中等启发式为基础，按概率选择次优行动
//   艺人 oracle     = 旧困难的一圈前瞻，各 AI 独立最大化自己的收益
//   团长 coalition  = AI 共享彼此手牌，联合压制真人（不读取真人牌面）
// 指标见 core/metrics.ts（B / L / P / N）。

import type { Difficulty, GameAction, GameState } from '../types'
import { suboptimalStrategy } from './suboptimal'
import { oracleStrategy } from './oracle'
import { coalitionStrategy } from './coalition'

export interface AiStrategy {
  readonly name: string
  chooseAction(state: GameState, seat: number, rng: () => number): GameAction
}

export { greedyStrategy } from './greedy'
export { heuristicStrategy, chooseGreedy, rankedHeuristicActions } from './planner'
export { oracleStrategy, plannerStrategy } from './oracle'
export { suboptimalStrategy, chooseSuboptimal } from './suboptimal'
export { coalitionStrategy, coalitionUtility } from './coalition'

export function strategyForDifficulty(difficulty: Difficulty): AiStrategy {
  if (difficulty === 'easy') return suboptimalStrategy
  if (difficulty === 'normal') return oracleStrategy
  return coalitionStrategy
}
