// ===== 手牌结构指标（AI 三层难度共用） =====
// B：清空当前手牌至少需要几个合法连续牌组（越小越好，相邻段划分 DP）
// L：当前最长连续/同数牌组
// P：潜在连接能力 = 对子核心 + 桥位（隔一张可成三连）+ 可成长二连
// I：孤张数（与左右邻牌都不相连的牌，5 人局第一优化目标）
// N：剩余手牌数

import type { Card } from './types'
import { classify, flippedHand } from './rules'

export interface HandMetrics {
  B: number
  L: number
  P: number
  I: number
  N: number
}

/** B：把整手牌划分成最少个「可一次打出」的相邻段（单张/同数/连续皆合法） */
export function blocksNeeded(hand: readonly Card[]): number {
  const n = hand.length
  if (n === 0) return 0
  const dp = new Array<number>(n + 1).fill(Infinity)
  dp[0] = 0
  for (let i = 1; i <= n; i++) {
    for (let j = 0; j < i; j++) {
      if (dp[j] === Infinity) continue
      const seg = hand.slice(j, i).map((c) => c.top)
      if (classify(seg)) dp[i] = Math.min(dp[i], dp[j] + 1)
    }
  }
  return dp[n]
}

/** L：最长的一段相邻「同数或连续（升/降）」 */
export function longestChain(hand: readonly Card[]): number {
  const n = hand.length
  let best = 0
  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j <= n; j++) {
      // 段一旦非法，更长也必非法（同数需全等，连续需单调），可提前断
      const seg = hand.slice(i, j).map((c) => c.top)
      if (!classify(seg)) break
      if (j - i > best) best = j - i
    }
  }
  return best
}

/** P：潜在连接能力。对子核心 +1.5，桥位（相邻差2，插一张成三连）+2，二连 +0.5 */
export function potential(hand: readonly Card[]): number {
  let p = 0
  for (let i = 1; i < hand.length; i++) {
    const d = hand[i].top - hand[i - 1].top
    if (d === 0) p += 1.5
    else if (Math.abs(d) === 2) p += 2
    else if (Math.abs(d) === 1) p += 0.5
  }
  // 端点延伸位：手牌两端再摸相邻数字可续链
  if (hand.length >= 2) {
    const first = hand[0].top
    const second = hand[1].top
    if (Math.abs(first - second) <= 1) p += 0.5
    const last = hand[hand.length - 1].top
    const prev = hand[hand.length - 2].top
    if (Math.abs(last - prev) <= 1) p += 0.5
  }
  return p
}

/** I：孤张数——与左右邻牌差值都超过 1（既不同也相邻）的牌 */
export function isolatedCount(hand: readonly Card[]): number {
  let iso = 0
  for (let i = 0; i < hand.length; i++) {
    const v = hand[i].top
    const leftOk = i > 0 && Math.abs(v - hand[i - 1].top) <= 1
    const rightOk = i < hand.length - 1 && Math.abs(v - hand[i + 1].top) <= 1
    if (!leftOk && !rightOk) iso++
  }
  return iso
}

export function evalHand(hand: readonly Card[]): HandMetrics {
  return {
    B: blocksNeeded(hand),
    L: longestChain(hand),
    P: potential(hand),
    I: isolatedCount(hand),
    N: hand.length,
  }
}

/** 结构收益：人数决定权重——5 人局消灭孤张 > 降 B > 增 L（规格：减牌竞速） */
export function structGain(before: HandMetrics, after: HandMetrics, playerCount = 3): number {
  const isoW = playerCount >= 4 ? 1.6 : 0.9
  const lW = playerCount >= 5 ? 0.1 : 0.3
  return (
    (before.B - after.B) * 2 +
    (before.I - after.I) * isoW +
    (after.P - before.P) * 0.6 +
    (after.L - before.L) * lW
  )
}

/** 整手翻转决策：B 更小 → 孤张更少 → L 更大 → P 更高（与 AI 翻面逻辑一致，供开局对话框复用） */
export function betterFlip(hand: readonly Card[]): boolean {
  const a = evalHand(hand)
  const b = evalHand(flippedHand(hand))
  if (b.B !== a.B) return b.B < a.B
  if (b.I !== a.I) return b.I < a.I
  if (b.L !== a.L) return b.L > a.L
  return b.P > a.P
}
