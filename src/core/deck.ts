// 牌组构成与发牌 —— 严格按官方规则：
// 45 张牌 = 数字 1~10 两两组成的所有数字对（每张牌两端数字不同，全牌唯一）。
// 发牌数：3 人局去掉所有含 10 的牌（剩 36 张，每人 12）；
//        4 人局只去掉 9/10 一张（剩 44 张，每人 11）；
//        5 人局全用（45 张，每人 9）。
// 洗牌时正反面朝向也随机（官方规则书：orientations are also randomly shuffled）。

import { type Card } from './types'
import { type Rng, shuffled } from './rng'

export const DECK_VALUES: readonly number[] = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]

export function buildFullDeck(): Array<{ a: number; b: number }> {
  const cards: Array<{ a: number; b: number }> = []
  for (let a = 1; a <= 10; a++) {
    for (let b = a + 1; b <= 10; b++) {
      cards.push({ a, b })
    }
  }
  return cards // C(10,2) = 45 张
}

export const DEAL_COUNT: Record<number, number> = { 3: 12, 4: 11, 5: 9 }

/** 按人数构造本局用的牌（未洗） */
export function deckForPlayerCount(playerCount: number): Array<{ a: number; b: number }> {
  const full = buildFullDeck()
  if (playerCount === 3) return full.filter((c) => c.a !== 10 && c.b !== 10)
  if (playerCount === 4) return full.filter((c) => !(c.a === 9 && c.b === 10))
  return full
}

/** 洗牌并随机朝向，然后按人数发牌。返回各座位手牌。 */
export function dealHands(playerCount: number, rng: Rng): Card[][] {
  const per = DEAL_COUNT[playerCount]
  if (!per) throw new Error(`不支持的人数: ${playerCount}`)
  const pool = shuffled(deckForPlayerCount(playerCount), rng).map(({ a, b }) =>
    rng() < 0.5 ? { top: a, bottom: b } : { top: b, bottom: a },
  )
  const hands: Card[][] = []
  for (let seat = 0; seat < playerCount; seat++) {
    hands.push(pool.slice(seat * per, (seat + 1) * per))
  }
  return hands
}
