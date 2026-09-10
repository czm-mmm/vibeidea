import { describe, expect, it } from 'vitest'
import { applyAction, createGame } from '../engine'
import {
  chooseSuboptimal,
  coalitionStrategy,
  rankedHeuristicActions,
  strategyForDifficulty,
} from '../ai'
import type { GameConfig, GameState } from '../types'

function threePlayerState(): GameState {
  const config: GameConfig = {
    players: [
      { name: '你', isHuman: true, difficulty: 'easy' },
      { name: 'AI-1', isHuman: false, difficulty: 'hard' },
      { name: 'AI-2', isHuman: false, difficulty: 'hard' },
    ],
    seed: 20260910,
  }
  return applyAction(createGame(config), 0, { type: 'flipHand', flip: false }).state
}

describe('AI 新难度分层', () => {
  it('简单难度以旧中等排名为基础按 70/20/10 选择第二/第三/第一名', () => {
    const state = threePlayerState()
    state.current = 1
    const ranked = rankedHeuristicActions(state, 1)
    expect(ranked.length).toBeGreaterThanOrEqual(3)
    expect(chooseSuboptimal(state, 1, () => 0.1)).toEqual(ranked[1].action)
    expect(chooseSuboptimal(state, 1, () => 0.8)).toEqual(ranked[2].action)
    expect(chooseSuboptimal(state, 1, () => 0.95)).toEqual(ranked[0].action)
  })

  it('三档分别映射为次优、个体前瞻和联盟前瞻', () => {
    expect(strategyForDifficulty('easy').name).toBe('heuristic-suboptimal')
    expect(strategyForDifficulty('normal').name).toBe('oracle-lookahead')
    expect(strategyForDifficulty('hard').name).toBe('coalition-lookahead')
  })

  it('困难 AI 不读取真人牌面，只要公开张数相同就作出同一决定', () => {
    const original = threePlayerState()
    original.current = 1
    const altered = structuredClone(original)
    altered.players[0].hand = altered.players[0].hand.map((_, index) => ({
      top: index % 9 + 1,
      bottom: (index + 4) % 9 + 1,
    }))

    const before = structuredClone(original)
    const first = coalitionStrategy.chooseAction(original, 1, () => 0.25)
    const second = coalitionStrategy.chooseAction(altered, 1, () => 0.25)
    expect(second).toEqual(first)
    expect(original).toEqual(before)
    expect(() => applyAction(original, 1, first)).not.toThrow()
  })
})
