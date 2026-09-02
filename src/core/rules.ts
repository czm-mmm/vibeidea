// ===== 规则判定（纯函数） =====
// 全部依据官方规则书 v3.0（One More Game 英文版）与 Oink 国际版手册/勘误交叉确认：
//  A. Play：从手牌中打出「相邻连续的一块」：
//     - 单张：任意一张；
//     - 多张：同数 或 连续数字（升序 / 降序皆可）。
//  比较大小（对新牌型 vs 当前有效牌型 Active Set）：
//     1) 张数多者强；张数少不能出；
//     2) 张数相同：同数(group) > 顺子(run)；
//     3) 张数、类型都相同：比较最低数字，严格更大才能出（相等不行）。

import type { Card, Combo, LegalShow, SetKind } from './types'

/** 对一段可见数字序列分类；非法组合返回 null */
export function classify(values: readonly number[]): Combo | null {
  const n = values.length
  if (n === 0) return null
  const low = Math.min(...values)
  if (n === 1) return { kind: 'single', low, values: [...values] }
  const allSame = values.every((v) => v === values[0])
  if (allSame) return { kind: 'group', low, values: [...values] }
  let asc = true
  let desc = true
  for (let i = 1; i < n; i++) {
    if (values[i] - values[i - 1] !== 1) asc = false
    if (values[i] - values[i - 1] !== -1) desc = false
  }
  if (asc || desc) return { kind: 'run', low, values: [...values] }
  return null
}

/** 同类型比较用的强度权重：同数 > 顺子；单张与顺子不可能是等张数对手 */
export function kindRank(kind: SetKind): number {
  return kind === 'group' ? 1 : 0
}

/** a 是否强过 b（严格） */
export function beatsCombo(a: Combo, b: Combo): boolean {
  if (a.values.length !== b.values.length) return a.values.length > b.values.length
  const ra = kindRank(a.kind)
  const rb = kindRank(b.kind)
  if (ra !== rb) return ra > rb
  return a.low > b.low
}

/** 手牌可见值序列 */
export function handValues(hand: readonly Card[]): number[] {
  return hand.map((c) => c.top)
}

/** 枚举手牌中所有「能打出且压过当前牌型」的连续块；active 为 null 表示桌上无牌型，任意合法牌型可出 */
export function legalShows(hand: readonly Card[], active: Combo | null): LegalShow[] {
  const out: LegalShow[] = []
  const values = handValues(hand)
  for (let from = 0; from < values.length; from++) {
    for (let to = from; to < values.length; to++) {
      const combo = classify(values.slice(from, to + 1))
      if (!combo) continue
      if (active && !beatsCombo(combo, active)) continue
      out.push({ from, to, combo })
    }
  }
  return out
}

/** 手牌结构评分：相邻同数/连续加分，孤立减分。用于 AI 与整手翻转决策。 */
export function structureScore(hand: readonly Card[]): number {
  let score = 0
  for (let i = 1; i < hand.length; i++) {
    const d = Math.abs(hand[i].top - hand[i - 1].top)
    if (d === 0) score += 2
    else if (d === 1) score += 2
    else score -= 1
  }
  return score
}

/** 整手翻转后的手牌 */
export function flippedHand(hand: readonly Card[]): Card[] {
  return hand.map((c) => ({ top: c.bottom, bottom: c.top }))
}

/** 中文文案：牌型标签，如「顺子 3·4·5」 */
export function comboLabel(c: Combo): string {
  const vs = c.values.join('·')
  if (c.kind === 'group') return `同数 ${vs}`
  if (c.kind === 'run') return `顺子 ${vs}`
  return `单张 ${vs}`
}
