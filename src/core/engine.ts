// ===== 游戏引擎：applyAction 状态机 =====
// 纪律：任何动作先校验、后应用；非法动作抛 RuleError（联机时这部分就是服务端权威逻辑）。
// 回合结束条件（官方规则）：
//   i.   有玩家打光手牌 → 立即结束；
//   ii.  其他玩家面对某玩家的牌型全部只做了侦察（轮到该玩家前）→ 立即结束，
//        且该玩家（条件 ii 达成者）剩牌不扣分。
// 计分：收来的暗牌 +1/张，VP 筹码 +1/枚，剩牌 −1/张（条件 ii 达成者免剩牌罚分）。
// 当前有效牌型（Active Set）在结算时不计入任何人的得分。

import {
  type ActiveSetState,
  type ApplyResult,
  type Card,
  type Combo,
  type GameAction,
  type GameConfig,
  type GameEvent,
  type GameState,
  type PlayerConfig,
  type PlayerState,
  type RoundResult,
  type RoundScoreRow,
  RuleError,
} from './types'
import { dealHands } from './deck'
import { classify, beatsCombo, flippedHand, legalShows } from './rules'
import { betterFlip } from './metrics'
import { mulberry32, type Rng } from './rng'

export const MAX_LOG = 24

// ---------- 工具 ----------

function cloneState(s: GameState): GameState {
  return {
    ...s,
    players: s.players.map((p) => ({ ...p, hand: [...p.hand], collected: [...p.collected] })),
    active: s.active ? { ...s.active, cards: [...s.active.cards] } : null,
    totals: [...s.totals],
    lastResult: s.lastResult,
    log: [...s.log],
  }
}

function pushLog(s: GameState, seat: number, text: string) {
  s.log.push({ seat, text })
  if (s.log.length > MAX_LOG) s.log.splice(0, s.log.length - MAX_LOG)
}

function makePlayer(cfg: PlayerConfig, seat: number, hand: Card[]): PlayerState {
  return {
    seat,
    name: cfg.name,
    isHuman: cfg.isHuman,
    difficulty: cfg.difficulty,
    hand,
    chips: 0,
    collected: [],
    marker: true,
  }
}

/** AI 决定开局是否整手翻转：与学徒档同一把尺——B 更小者优先（easy 有随机性） */
function aiFlipDecision(hand: Card[], difficulty: string, rng: Rng): boolean {
  if (difficulty === 'easy') return rng() < 0.35
  return betterFlip(hand)
}

// ---------- 建局 ----------

export function createGame(config: GameConfig): GameState {
  const n = config.players.length
  if (n < 3 || n > 5) throw new Error('SCOUT 支持 3~5 人（本作单机为 1 人 + 2~4 AI）')
  const rng = mulberry32(config.seed)
  const hands = dealHands(n, rng)
  const players = config.players.map((cfg, seat) => makePlayer(cfg, seat, hands[seat]))

  const state: GameState = {
    players,
    current: 0,
    active: null,
    roundNumber: 1,
    totalRounds: n,
    startSeat: 0,
    totals: players.map(() => 0),
    phase: 'playing',
    scoutsSinceShow: 0,
    lastResult: null,
    log: [],
    seed: config.seed,
  }

  // AI 立即做整手翻转决策；有人类时进入 flip 阶段等人类决定
  const hasHuman = players.some((p) => p.isHuman)
  for (const p of players) {
    if (!p.isHuman) p.hand = aiFlipDecision(p.hand, p.difficulty, rng) ? flippedHand(p.hand) : p.hand
  }
  if (hasHuman) state.phase = 'flip'
  return state
}

/** 上一轮结束后开下一轮：首出者左移一格，重新洗发全牌 */
export function startNextRound(prev: GameState): GameState {
  if (prev.phase !== 'roundEnd' || !prev.lastResult) throw new RuleError('本轮尚未结束')
  const lastResult = prev.lastResult
  const s = cloneState(prev)
  const n = s.players.length
  s.roundNumber += 1
  s.startSeat = (s.startSeat + 1) % n
  s.current = s.startSeat
  s.totals = lastResult.rows.map((r) => r.total)
  s.lastResult = null
  s.scoutsSinceShow = 0
  s.active = null
  s.log = []

  const rng = mulberry32((s.seed ^ (s.roundNumber * 0x9e3779b9)) >>> 0)
  const hands = dealHands(n, rng)
  s.players.forEach((p, seat) => {
    p.hand = hands[seat]
    p.chips = 0
    p.collected = []
    p.marker = true
  })
  const hasHuman = s.players.some((p) => p.isHuman)
  for (const p of s.players) {
    if (!p.isHuman) p.hand = aiFlipDecision(p.hand, p.difficulty, rng) ? flippedHand(p.hand) : p.hand
  }
  s.phase = hasHuman ? 'flip' : 'playing'
  return s
}

// ---------- 校验 ----------

function requireTurn(s: GameState, seat: number) {
  if (s.phase !== 'playing') throw new RuleError('当前不在行动阶段')
  if (s.current !== seat) throw new RuleError('还没轮到该玩家')
}

function doScout(
  s: GameState,
  seat: number,
  spec: { end: 'left' | 'right'; insertAt: number; flip: boolean },
  events: GameEvent[],
  viaMarker: boolean,
): Card {
  const player = s.players[seat]
  if (!s.active) throw new RuleError('桌上没有可挖角的牌型')
  const set = s.active
  const idx = spec.end === 'left' ? 0 : set.cards.length - 1
  const card = set.cards[idx]
  if (!card) throw new RuleError('牌型为空')
  if (spec.insertAt < 0 || spec.insertAt > player.hand.length) throw new RuleError('插入位置非法')

  // 1) 从牌型端点取 1 张；剩余的牌构成牌型当前的样子（后续比较以它为准）
  set.cards.splice(idx, 1)
  const setEmptied = set.cards.length === 0
  if (!setEmptied) {
    const rest = classify(set.cards.map((c) => c.top))
    if (rest) set.combo = rest
  }

  // 2) 以任意朝向插入手牌任意位置
  const inserted: Card = spec.flip ? { top: card.bottom, bottom: card.top } : { ...card }
  player.hand.splice(spec.insertAt, 0, inserted)

  // 3) 牌型主人获得 1 个 VP 筹码（含自己侦察自己牌型的情形，规则按字面执行）
  const owner = s.players[set.ownerSeat]
  owner.chips += 1

  if (setEmptied) {
    s.active = null
    s.scoutsSinceShow = 0
  } else if (seat !== set.ownerSeat) {
    // 只有「其他玩家」的侦察推进结束条件 ii 的计数
    s.scoutsSinceShow += 1
  }

  events.push({
    type: 'scout',
    seat,
    fromSeat: set.ownerSeat,
    card,
    spec,
    ownerGainedChip: true,
    viaMarker,
    setEmptied,
  })
  pushLog(
    s,
    seat,
    `${player.name} 挖角了 ${owner.name} 的牌型${viaMarker ? '（双动）' : ''}，${owner.name} +1 筹码`,
  )
  return card
}

function doShow(
  s: GameState,
  seat: number,
  from: number,
  to: number,
  events: GameEvent[],
): Combo {
  const player = s.players[seat]
  if (from < 0 || to >= player.hand.length || from > to) throw new RuleError('选牌范围非法')
  const values = player.hand.slice(from, to + 1).map((c) => c.top)
  const combo = classify(values)
  if (!combo) throw new RuleError('所选的牌不是合法牌型（需同数或连续）')
  if (s.active && !beatsCombo(combo, s.active.combo)) {
    throw new RuleError('压不过当前牌型')
  }

  // 被压掉的牌型整叠收走，归**出牌者**所有（官方规则：Take the cards you beat ... as your score）
  let collected: Card[] = []
  let fromSeat: number | null = null
  if (s.active) {
    collected = s.active.cards
    fromSeat = s.active.ownerSeat
    s.players[seat].collected.push(...collected)
  }

  // 打出的牌成为新的有效牌型
  const played = player.hand.splice(from, to - from + 1)
  s.active = { combo, ownerSeat: seat, cards: played }
  s.scoutsSinceShow = 0

  const wentOut = player.hand.length === 0
  events.push({ type: 'show', seat, combo, collected, fromSeat, wentOut })
  pushLog(
    s,
    seat,
    `${player.name} 打出 ${combo.values.join('·')}（${combo.kind === 'group' ? '同数' : combo.kind === 'run' ? '顺子' : '单张'}）` +
      (collected.length ? `，收走 ${fromSeat !== null ? s.players[fromSeat].name : ''} ${collected.length} 张` : ''),
  )
  return combo
}

function endRound(s: GameState, condition: 'emptyHand' | 'allScouted', finisherSeat: number, events: GameEvent[]) {
  const rows: RoundScoreRow[] = s.players.map((p) => {
    const remaining = p.hand.length
    const penalty = condition === 'allScouted' && p.seat === finisherSeat ? 0 : remaining
    const points = p.collected.length + p.chips - penalty
    return {
      seat: p.seat,
      name: p.name,
      collected: p.collected.length,
      chips: p.chips,
      remaining,
      penalty,
      points,
      total: s.totals[p.seat] + points,
    }
  })
  const result: RoundResult = { condition, finisherSeat, rows }
  s.lastResult = result
  s.phase = 'roundEnd'
  events.push({ type: 'roundEnd', result })
  const finisher = s.players[finisherSeat]
  pushLog(s, finisherSeat, condition === 'emptyHand' ? `${finisher.name} 打光手牌，本轮结束` : `无人再挖角，本轮结束（${finisher.name} 免剩牌罚分）`)
}

// ---------- 动作应用 ----------

export function applyAction(prev: GameState, seat: number, action: GameAction): ApplyResult {
  const s = cloneState(prev)
  const events: GameEvent[] = []
  const player = s.players[seat]
  if (!player) throw new RuleError('座位不存在')

  switch (action.type) {
    case 'flipHand': {
      if (s.phase !== 'flip') throw new RuleError('现在不能整手翻转')
      if (!player.isHuman) throw new RuleError('AI 的翻转已在开局时决定')
      if (action.flip) {
        player.hand = flippedHand(player.hand)
        events.push({ type: 'handFlipped', seat })
        pushLog(s, seat, `${player.name} 整手翻转了手牌`)
      }
      s.phase = 'playing'
      break
    }
    case 'show': {
      requireTurn(s, seat)
      doShow(s, seat, action.from, action.to, events)
      if (player.hand.length === 0) {
        endRound(s, 'emptyHand', seat, events)
      } else {
        s.current = (seat + 1) % s.players.length
      }
      break
    }
    case 'scout': {
      requireTurn(s, seat)
      doScout(s, seat, action.spec, events, false)
      // 结束条件 ii：其他玩家全部只侦察，轮到牌型主人前回合结束
      if (s.active && s.scoutsSinceShow >= s.players.length - 1) {
        endRound(s, 'allScouted', s.active.ownerSeat, events)
      } else {
        s.current = (seat + 1) % s.players.length
      }
      break
    }
    case 'doubleAction': {
      requireTurn(s, seat)
      if (!player.marker) throw new RuleError('Double Action 标记已用掉')
      if (!s.active) throw new RuleError('桌上没有可挖角的牌型')
      player.marker = false
      doScout(s, seat, action.spec, events, true)
      // 侦察后立刻表演：from/to 是插入后手牌的下标；若牌型被拿空则任意牌型可出
      doShow(s, seat, action.from, action.to, events)
      if (player.hand.length === 0) {
        endRound(s, 'emptyHand', seat, events)
      } else {
        s.current = (seat + 1) % s.players.length
      }
      break
    }
    default:
      throw new RuleError('未知动作')
  }

  return { state: s, events }
}

// ---------- 只读辅助（UI / AI 用） ----------

export function currentLegalShows(s: GameState, seat: number) {
  return legalShows(s.players[seat].hand, s.active ? s.active.combo : null)
}

export function activeCombo(s: GameState): Combo | null {
  return s.active ? s.active.combo : null
}

export function activeSetCards(s: GameState): Card[] {
  return s.active ? s.active.cards : []
}

export type { ActiveSetState }
