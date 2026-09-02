import { describe, expect, it } from 'vitest'
import { beatsCombo, classify, comboLabel, legalShows } from '../rules'
import { buildFullDeck, deckForPlayerCount, DEAL_COUNT } from '../deck'
import { RuleError } from '../types'

describe('牌组构成（官方规则）', () => {
  it('全牌 45 张 = 1~10 所有数字对，唯一', () => {
    const deck = buildFullDeck()
    expect(deck.length).toBe(45)
    const keys = new Set(deck.map((c) => `${Math.min(c.a, c.b)}-${Math.max(c.a, c.b)}`))
    expect(keys.size).toBe(45)
  })
  it('3 人局去所有含 10 的牌（36 张，每人 12）', () => {
    const d = deckForPlayerCount(3)
    expect(d.length).toBe(36)
    expect(d.some((c) => c.a === 10 || c.b === 10)).toBe(false)
    expect(DEAL_COUNT[3]).toBe(12)
  })
  it('4 人局只去 9/10 一张（44 张，每人 11）', () => {
    const d = deckForPlayerCount(4)
    expect(d.length).toBe(44)
    expect(d.filter((c) => (c.a === 9 && c.b === 10)).length).toBe(0)
    expect(DEAL_COUNT[4]).toBe(11)
  })
  it('5 人局全用（45 张，每人 9）', () => {
    expect(deckForPlayerCount(5).length).toBe(45)
    expect(DEAL_COUNT[5]).toBe(9)
  })
})

describe('牌型分类', () => {
  it('单张', () => {
    expect(classify([7])).toEqual({ kind: 'single', low: 7, values: [7] })
  })
  it('同数', () => {
    expect(classify([5, 5, 5])?.kind).toBe('group')
  })
  it('升序顺子', () => {
    expect(classify([3, 4, 5])?.kind).toBe('run')
  })
  it('降序顺子也合法（官方规则 A）', () => {
    const c = classify([9, 8, 7])
    expect(c?.kind).toBe('run')
    expect(c?.low).toBe(7)
  })
  it('乱序非法', () => {
    expect(classify([3, 5, 4])).toBeNull()
    expect(classify([2, 2, 3])).toBeNull()
    expect(classify([1, 3, 5, 7])).toBeNull()
  })
})

describe('大小比较（官方规则）', () => {
  it('张数多者强', () => {
    expect(beatsCombo(classify([2, 2, 2])!, classify([9, 9])!)).toBe(true)
    expect(beatsCombo(classify([9, 9])!, classify([2, 2, 2])!)).toBe(false)
  })
  it('等张数：同数 > 顺子', () => {
    expect(beatsCombo(classify([2, 2])!, classify([9, 10])!)).toBe(true)
    expect(beatsCombo(classify([9, 10])!, classify([2, 2])!)).toBe(false)
  })
  it('等张数同类型：最低数字严格更大', () => {
    expect(beatsCombo(classify([6, 7])!, classify([4, 5])!)).toBe(true)
    expect(beatsCombo(classify([4, 5])!, classify([4, 5])!)).toBe(false) // 相等不能出
    expect(beatsCombo(classify([4, 4])!, classify([4, 4, 4])!)).toBe(false)
  })
  it('降序顺子按最低数字比较', () => {
    // 8-7（low=7）压 4-5（low=4）
    expect(beatsCombo(classify([8, 7])!, classify([4, 5])!)).toBe(true)
  })
})

describe('合法出牌枚举', () => {
  const hand = [
    { top: 3, bottom: 9 },
    { top: 4, bottom: 8 },
    { top: 5, bottom: 2 },
    { top: 9, bottom: 1 },
    { top: 9, bottom: 6 },
  ]
  it('无牌型时枚举所有合法块', () => {
    const shows = legalShows(hand, null)
    const labels = shows.map((s) => comboLabel(s.combo))
    expect(labels).toContain('顺子 3·4·5')
    expect(labels).toContain('同数 9·9')
    expect(labels).toContain('单张 4')
  })
  it('面对 9·9 同数：需 3+ 张才能压（3 张顺子可以）', () => {
    const shows = legalShows(hand, classify([9, 9])!)
    expect(shows.map((s) => comboLabel(s.combo))).toEqual(['顺子 3·4·5'])
  })
  it('面对 3·4·5 顺子：等张数需 low 更大或同数，2 张同数压不过 3 张顺子', () => {
    const shows = legalShows(hand, classify([3, 4, 5])!)
    expect(shows.length).toBe(0) // 该手牌中没有能压 3 张顺子的块
  })
})

describe('RuleError', () => {
  it('可被捕获且带名称', () => {
    try {
      throw new RuleError('压不过当前牌型')
    } catch (e) {
      expect((e as RuleError).name).toBe('RuleError')
      expect((e as Error).message).toBe('压不过当前牌型')
    }
  })
})
