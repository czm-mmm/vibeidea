// ===== AI 策略接口 =====
// 三层难度（单调包含）：
//   学徒 greedy      = 手牌结构优化（单步，只看自己）
//   艺人 heuristic   = 即时收益贪心（结构 + 得分 + 风险） ⊃ 学徒
//   团长 oracle      = 一圈全信息前瞻（推演所有对手回应） ⊃ 艺人
// 指标见 core/metrics.ts（B / L / P / N）。

import type { GameAction, GameState } from '../types'

export interface AiStrategy {
  readonly name: string
  chooseAction(state: GameState, seat: number, rng: () => number): GameAction
}

export { greedyStrategy } from './greedy'
export { heuristicStrategy, chooseGreedy } from './planner'
export { oracleStrategy, plannerStrategy } from './oracle'
