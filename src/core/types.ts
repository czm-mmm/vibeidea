// ===== SCOUT 核心类型定义 =====
// 本文件是纯数据契约，无 DOM / Vue / 网络依赖，可原样搬到服务端做权威校验。

/** 一张牌：top 为当前朝上的数字（手牌中可见），bottom 为另一端数字 */
export interface Card {
  top: number
  bottom: number
}

/** 牌型类别：单张 / 同数 / 顺子（允许升序或降序，见官方规则 A. Play） */
export type SetKind = 'single' | 'group' | 'run'

/** 一个已确定的牌型。low = 最低数字（比较时用），values = 按打出顺序的可见数字 */
export interface Combo {
  kind: SetKind
  low: number
  values: number[]
}

export type Difficulty = 'easy' | 'normal' | 'hard'

export interface PlayerConfig {
  name: string
  isHuman: boolean
  difficulty: Difficulty
}

export interface PlayerState {
  seat: number
  name: string
  isHuman: boolean
  difficulty: Difficulty
  /** 手牌，顺序锁定不可重排（整手翻转除外） */
  hand: Card[]
  /** 本轮获得的 VP 筹码（自己的牌型被侦察时 +1） */
  chips: number
  /** 本轮收来的得分暗牌（压过别人的牌型时获得） */
  collected: Card[]
  /** Double Action 标记，每轮 1 枚，用掉即 false */
  marker: boolean
}

/** 当前有效牌型（Active Set / Prior Set）：摆在其主人面前 */
export interface ActiveSetState {
  combo: Combo
  ownerSeat: number
  /** 牌型中的牌（保持打出顺序），主人手牌被 Show 时从原手牌移到这里 */
  cards: Card[]
}

export type RoundEndCondition = 'emptyHand' | 'allScouted'

export interface RoundScoreRow {
  seat: number
  name: string
  collected: number
  chips: number
  remaining: number
  /** 剩牌罚分（条件 ii 达成者免罚） */
  penalty: number
  points: number
  /** 累计总分（含本轮） */
  total: number
}

export interface RoundResult {
  condition: RoundEndCondition
  finisherSeat: number
  rows: RoundScoreRow[]
}

export type GamePhase = 'flip' | 'playing' | 'roundEnd'

export interface LogEntry {
  seat: number
  text: string
}

export interface GameState {
  players: PlayerState[]
  /** 当前行动座位 */
  current: number
  /** 当前有效牌型；null 表示桌上无牌型（此时必须 Play） */
  active: ActiveSetState | null
  roundNumber: number
  totalRounds: number
  /** 本轮首出座位（下一轮 = 左移一格） */
  startSeat: number
  /** 之前各轮累计得分（下标 = 座位） */
  totals: number[]
  phase: GamePhase
  /** 自上次 Show 以来连续 Scout 次数（用于结束条件 ii） */
  scoutsSinceShow: number
  lastResult: RoundResult | null
  /** 最近若干条事件文案，供对局内历史区显示 */
  log: LogEntry[]
  /** 复盘用随机种子 */
  seed: number
}

// ===== 动作（UI / AI → 引擎） =====

export interface ScoutSpec {
  /** 从牌型哪一端取牌 */
  end: 'left' | 'right'
  /** 插入手牌的位置：插到当前第 insertAt 张之前（0..hand.length） */
  insertAt: number
  /** 插入时是否翻转（top/bottom 对调） */
  flip: boolean
}

export type GameAction =
  /** 回合开始时的整手翻转（仅本轮尚未行动时可决定） */
  | { type: 'flipHand'; flip: boolean }
  /** 表演：打出手牌 [from, to]（含端点）的连续一块 */
  | { type: 'show'; from: number; to: number }
  /** 侦察：从有效牌型一端取 1 张，插入手牌任意位置、任意朝向 */
  | { type: 'scout'; spec: ScoutSpec }
  /** 双动：消耗 Double Action 标记，侦察后立刻表演 */
  | { type: 'doubleAction'; spec: ScoutSpec; from: number; to: number }

// ===== 事件（引擎 → UI，用于动画与文案） =====

export type GameEvent =
  | { type: 'handFlipped'; seat: number }
  | {
      type: 'show'
      seat: number
      combo: Combo
      /** 被压掉的牌型整叠收走 */
      collected: Card[]
      fromSeat: number | null
      wentOut: boolean
    }
  | {
      type: 'scout'
      seat: number
      fromSeat: number
      card: Card
      spec: ScoutSpec
      /** 牌型主人 +1 VP */
      ownerGainedChip: boolean
      viaMarker: boolean
      setEmptied: boolean
    }
  | { type: 'roundEnd'; result: RoundResult }

export interface ApplyResult {
  state: GameState
  events: GameEvent[]
}

/** UI 高亮用：一个可合法打出的连续块 */
export interface LegalShow {
  from: number
  to: number
  combo: Combo
}

/** 引擎拒绝非法动作时抛出 */
export class RuleError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'RuleError'
  }
}

export interface GameConfig {
  players: PlayerConfig[]
  seed: number
}
