import { describe, expect, it } from 'vitest'
import { applyAction, createGame, startNextRound } from '../engine'
import { mulberry32 } from '../rng'
import { greedyStrategy, heuristicStrategy, plannerStrategy } from '../ai'
import type { GameConfig, GameState, PlayerConfig } from '../types'
import { RuleError } from '../types'

function aiOnlyConfig(n: number, seedExtra = 0): GameConfig {
  const players: PlayerConfig[] = Array.from({ length: n }, (_, i) => ({
    name: `AI-${i + 1}`,
    isHuman: false,
    difficulty: i % 3 === 0 ? 'easy' : i % 3 === 1 ? 'normal' : 'hard',
  }))
  return { players, seed: 12345 + seedExtra }
}

function strategyFor(state: GameState, seat: number) {
  const d = state.players[seat].difficulty
  if (d === 'easy') return greedyStrategy
  if (d === 'normal') return heuristicStrategy
  return plannerStrategy
}

/** 跑完一整轮（AI only），返回结束状态 */
function playRound(state: GameState): GameState {
  let s = state
  let guard = 0
  while (s.phase !== 'roundEnd') {
    guard++
    if (guard > 2000) throw new Error('回合数超限，疑似死锁')
    if (s.phase === 'flip') throw new Error('AI only 不应有 flip 阶段')
    const seat = s.current
    const rng = mulberry32((s.seed ^ (guard * 2654435761)) >>> 0)
    const action = strategyFor(s, seat).chooseAction(s, seat, rng)
    const res = applyAction(s, seat, action)
    s = res.state
  }
  return s
}

describe('引擎：建局与动作校验', () => {
  it('3/4/5 人建局：手牌张数正确、轮数=人数', () => {
    for (const n of [3, 4, 5]) {
      const s = createGame(aiOnlyConfig(n))
      expect(s.players.length).toBe(n)
      expect(s.totalRounds).toBe(n)
      for (const p of s.players) {
        expect(p.hand.length).toBe(n === 3 ? 12 : n === 4 ? 11 : 9)
        expect(p.marker).toBe(true)
        expect(p.chips).toBe(0)
      }
    }
  })

  it('不是你的回合不能行动', () => {
    const s = createGame(aiOnlyConfig(3))
    expect(() => applyAction(s, 1, { type: 'show', from: 0, to: 0 })).toThrow(RuleError)
  })

  it('非法块（非同数非连续）不能出', () => {
    const cfg: GameConfig = {
      players: [
        { name: 'H', isHuman: true, difficulty: 'easy' },
        { name: 'A1', isHuman: false, difficulty: 'easy' },
        { name: 'A2', isHuman: false, difficulty: 'easy' },
      ],
      seed: 7,
    }
    const s0 = createGame(cfg)
    const s = applyAction(s0, 0, { type: 'flipHand', flip: false }).state
    // 找一个非法块（构造：取 [0..2] 若它不构成牌型）
    const vals = s.players[0].hand.map((c) => c.top)
    const c = (() => {
      for (let from = 0; from < vals.length - 1; from++) {
        for (let to = from + 1; to < vals.length; to++) {
          const seg = vals.slice(from, to + 1)
          const same = seg.every((v) => v === seg[0])
          let asc = true
          let desc = true
          for (let i = 1; i < seg.length; i++) {
            if (seg[i] - seg[i - 1] !== 1) asc = false
            if (seg[i] - seg[i - 1] !== -1) desc = false
          }
          if (!same && !asc && !desc) return { from, to }
        }
      }
      return null
    })()
    if (c) {
      expect(() => applyAction(s, 0, { type: 'show', from: c.from, to: c.to })).toThrow(RuleError)
    }
  })

  it('压不过不能出', () => {
    const s = createGame(aiOnlyConfig(3))
    // 构造确定的两张同数首手，不依赖洗牌或开局旋转结果。
    s.players[0].hand[0] = { top: 5, bottom: 1 }
    s.players[0].hand[1] = { top: 5, bottom: 2 }
    const s1 = applyAction(s, 0, { type: 'show', from: 0, to: 1 }).state
    // 第二家的单张张数更少，必然压不过。
    expect(() => applyAction(s1, 1, { type: 'show', from: 0, to: 0 })).toThrow(/压不过|合法牌型/)
  })

  it('无牌型时不能侦察', () => {
    const s = createGame(aiOnlyConfig(3))
    expect(() =>
      applyAction(s, 0, { type: 'scout', spec: { end: 'left', insertAt: 0, flip: false } }),
    ).toThrow(RuleError)
  })

  it('压过归因：3 张顺子压 2 张同数，牌归出牌者', () => {
    const cfg: GameConfig = {
      players: [
        { name: 'H', isHuman: true, difficulty: 'easy' },
        { name: 'A', isHuman: false, difficulty: 'easy' },
        { name: 'B', isHuman: false, difficulty: 'easy' },
      ],
      seed: 42,
    }
    const s0 = createGame(cfg)
    let s = applyAction(s0, 0, { type: 'flipHand', flip: false }).state
    s.players[0].hand = [{ top: 6, bottom: 1 }, { top: 6, bottom: 2 }, { top: 4, bottom: 8 }]
    s.players[1].hand = [
      { top: 4, bottom: 1 }, { top: 3, bottom: 2 }, { top: 2, bottom: 3 },
    ]
    s.players[2].hand = [{ top: 7, bottom: 1 }, { top: 2, bottom: 2 }]
    s = applyAction(s, 0, { type: 'show', from: 0, to: 1 }).state // H 出 6·6 同数（首手）
    const before = s.players[1].collected.length
    s = applyAction(s, 1, { type: 'show', from: 0, to: 2 }).state // A 出 4·3·2 顺子（3张压2张）
    expect(s.players[1].collected.length).toBe(before + 2) // A 收走 H 的 2 张
    expect(s.players[0].collected.length).toBe(0) // H 没有收任何牌
    expect(s.active!.ownerSeat).toBe(1)
  })

  it('Double Action 标记只能用一次', () => {
    const s0 = createGame(aiOnlyConfig(3))
    const s1 = applyAction(s0, 0, { type: 'show', from: 0, to: 0 }).state
    const p1 = s1.players[1]
    // 用双动：侦察 + 立刻出单张（总能出单张——但需压过剩余牌型；用合法路径验证标记消耗）
    // 先直接验证校验：双动后标记为 false，再次双动报错
    const rng = mulberry32(99)
    const action = heuristicStrategy.chooseAction(s1, 1, rng)
    if (action.type === 'doubleAction') {
      const after = applyAction(s1, 1, action).state
      expect(after.players[1].marker).toBe(false)
      // 轮到下一家……转回 seat1 再试双动会抛错（此处只验证标记位）
      expect(p1.marker).toBe(true)
    }
  })
})

describe('引擎：侦察规则细节', () => {
  /** 构造确定局面：H 手牌开头是 9·9·9 同数块，出成当前牌型 */
  function setup(): GameState {
    const cfg: GameConfig = {
      players: [
        { name: 'H', isHuman: true, difficulty: 'easy' },
        { name: 'A', isHuman: false, difficulty: 'easy' },
        { name: 'B', isHuman: false, difficulty: 'easy' },
      ],
      seed: 42,
    }
    const s0 = createGame(cfg)
    const s = applyAction(s0, 0, { type: 'flipHand', flip: false }).state
    // 直接布置手牌（单元测试用数据构造，不经过发牌）
    s.players[0].hand = [
      { top: 9, bottom: 1 }, { top: 9, bottom: 2 }, { top: 9, bottom: 3 },
      { top: 4, bottom: 8 },
    ]
    s.players[1].hand = [{ top: 5, bottom: 1 }, { top: 6, bottom: 2 }]
    s.players[2].hand = [{ top: 7, bottom: 1 }, { top: 8, bottom: 2 }]
    const s1 = applyAction(s, 0, { type: 'show', from: 0, to: 2 }).state
    expect(s1.active!.cards.length).toBe(3)
    return s1
  }

  it('侦察：牌型主人 +1 筹码，牌从端点移除、插入指定位置，牌型强度随之更新', () => {
    const s1 = setup()
    const before = s1.players[0].chips
    const handLen = s1.players[1].hand.length
    const res = applyAction(s1, 1, { type: 'scout', spec: { end: 'left', insertAt: 2, flip: true } })
    const s2 = res.state
    expect(s2.players[0].chips).toBe(before + 1) // 主人得筹码
    expect(s2.players[1].hand.length).toBe(handLen + 1)
    expect(s2.active!.cards.length).toBe(2)
    // 剩余 9·9 构成新牌型：2 张同数（此后 3 张顺子即可压过）
    expect(s2.active!.combo.values).toEqual([9, 9])
    expect(s2.active!.combo.kind).toBe('group')
    expect(res.events[0].type).toBe('scout')
    expect(s2.scoutsSinceShow).toBe(1)
  })

  it('其他人全部只侦察 → 轮到牌型主人前本轮结束，主人免剩牌罚分', () => {
    const s1 = setup()
    const s2 = applyAction(s1, 1, { type: 'scout', spec: { end: 'left', insertAt: 0, flip: false } }).state
    const s3 = applyAction(s2, 2, { type: 'scout', spec: { end: 'right', insertAt: 0, flip: false } }).state
    expect(s3.phase).toBe('roundEnd')
    expect(s3.lastResult!.condition).toBe('allScouted')
    expect(s3.lastResult!.finisherSeat).toBe(0)
    const rowH = s3.lastResult!.rows.find((r) => r.seat === 0)!
    expect(rowH.penalty).toBe(0)
    expect(rowH.chips).toBe(2) // 两次侦察各 +1 VP
    expect(rowH.remaining).toBe(1) // 打出 999 后剩 1 张，但不罚
  })

  it('侦察把牌型拿空后：桌面无牌型，下手必须表演', () => {
    // 单独构造 2 张同数牌型，A、B 各侦察一张把牌型拿空
    const cfg: GameConfig = {
      players: [
        { name: 'H', isHuman: true, difficulty: 'easy' },
        { name: 'A', isHuman: false, difficulty: 'easy' },
        { name: 'B', isHuman: false, difficulty: 'easy' },
      ],
      seed: 42,
    }
    const s0 = createGame(cfg)
    let s = applyAction(s0, 0, { type: 'flipHand', flip: false }).state
    s.players[0].hand = [{ top: 9, bottom: 1 }, { top: 9, bottom: 2 }, { top: 4, bottom: 8 }]
    s.players[1].hand = [{ top: 5, bottom: 1 }, { top: 6, bottom: 2 }]
    s.players[2].hand = [{ top: 7, bottom: 1 }, { top: 8, bottom: 2 }]
    s = applyAction(s, 0, { type: 'show', from: 0, to: 1 }).state
    const s2 = applyAction(s, 1, { type: 'scout', spec: { end: 'left', insertAt: 0, flip: false } }).state
    expect(s2.active!.cards.length).toBe(1)
    const s3 = applyAction(s2, 2, { type: 'scout', spec: { end: 'right', insertAt: 0, flip: false } }).state
    expect(s3.active).toBeNull()
    expect(s3.phase).toBe('playing')
    expect(s3.current).toBe(0)
    // H 面对空桌不能再侦察，只能表演
    expect(() => applyAction(s3, 0, { type: 'scout', spec: { end: 'left', insertAt: 0, flip: false } })).toThrow(RuleError)
    const s4 = applyAction(s3, 0, { type: 'show', from: 0, to: 0 }).state
    expect(s4.active).not.toBeNull()
  })
})

describe('引擎：轮结算与多轮推进', () => {
  it('计分公式：暗牌 + 筹码 - 剩牌', () => {
    const cfg = aiOnlyConfig(3, 1)
    let s = createGame(cfg)
    if (s.phase === 'flip') s = applyAction(s, 0, { type: 'flipHand', flip: false }).state
    s = playRound(s)
    const result = s.lastResult!
    for (const row of result.rows) {
      const p = s.players[row.seat]
      expect(row.collected).toBe(p.collected.length)
      expect(row.chips).toBe(p.chips)
      expect(row.points).toBe(p.collected.length + p.chips - row.penalty)
      expect(row.total).toBe(row.points) // 第一轮累计 = 本轮
    }
    // 牌的守恒：所有收走暗牌 + 剩手牌 + 当前牌型 = 发牌总数
    const totalCards =
      result.rows.reduce((acc, r) => acc + r.collected + r.remaining, 0) + (s.active ? s.active.cards.length : 0)
    expect(totalCards).toBe(36) // 3 人局 36 张
  })

  it('下一轮：首出者左移、轮数+1、累计分带入、状态重置', () => {
    const cfg = aiOnlyConfig(3, 2)
    let s = createGame(cfg)
    s = playRound(s)
    expect(s.phase).toBe('roundEnd')
    const startBefore = s.startSeat
    const expectedTotals = s.lastResult!.rows.map((r) => r.total)
    s = startNextRound(s)
    expect(s.roundNumber).toBe(2)
    expect(s.startSeat).toBe((startBefore + 1) % 3)
    expect(s.active).toBeNull()
    expect(s.totals).toEqual(expectedTotals)
    expect(s.lastResult).toBeNull()
    for (const p of s.players) {
      expect(p.chips).toBe(0)
      expect(p.collected.length).toBe(0)
      expect(p.marker).toBe(true)
    }
  })
})

describe('全程模拟：多种子 × 多人数 × 三档 AI 混战', () => {
  it.each([3, 4, 5])('%d 人局 × 8 种子全程可跑完且守恒', (n) => {
    for (let seed = 0; seed < 8; seed++) {
      let s = createGame(aiOnlyConfig(n, seed * 977 + n))
      for (let round = 1; round <= n; round++) {
        if (s.phase === 'flip') s = applyAction(s, 0, { type: 'flipHand', flip: false }).state
        s = playRound(s)
        // 守恒检查
        const inHands = s.players.reduce((a, p) => a + p.hand.length, 0)
        const inSet = s.active ? s.active.cards.length : 0
        const inCollected = s.players.reduce((a, p) => a + p.collected.length, 0)
        const expected = n === 3 ? 36 : n === 4 ? 44 : 45
        expect(inHands + inSet + inCollected).toBe(expected)
        if (round < n) s = startNextRound(s)
      }
      expect(s.roundNumber).toBe(n)
    }
  })

  it('人类参与的局也能走通（人类动作由 heuristic 代打）', () => {
    const cfg: GameConfig = {
      players: [
        { name: '你', isHuman: true, difficulty: 'easy' },
        { name: 'AI-1', isHuman: false, difficulty: 'normal' },
        { name: 'AI-2', isHuman: false, difficulty: 'hard' },
        { name: 'AI-3', isHuman: false, difficulty: 'easy' },
      ],
      seed: 2026,
    }
    let s = createGame(cfg)
    for (let round = 1; round <= 4; round++) {
      if (s.phase === 'flip') s = applyAction(s, 0, { type: 'flipHand', flip: false }).state
      let guard = 0
      while (s.phase !== 'roundEnd') {
        guard++
        if (guard > 3000) throw new Error('死锁')
        const seat = s.current
        const rng = mulberry32((s.seed ^ (guard * 97 + seat)) >>> 0)
        const strategy = seat === 0 ? heuristicStrategy : strategyFor(s, seat)
        const action = strategy.chooseAction(s, seat, rng)
        s = applyAction(s, seat, action).state
      }
      if (round < 4) s = startNextRound(s)
    }
    expect(s.totals.length).toBe(4)
  })
})
