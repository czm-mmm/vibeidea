// AI 三档行为基准：多种子全程对局，统计回合结束方式与得分差距
// 用法：npx vite-node scripts/benchmark.ts
import { applyAction, createGame, startNextRound } from '../src/core/engine'
import { greedyStrategy, heuristicStrategy, oracleStrategy } from '../src/core/ai'
import { mulberry32 } from '../src/core/rng'
import type { AiStrategy } from '../src/core/ai'
import type { PlayerConfig } from '../src/core/types'

const strategies: Record<string, AiStrategy> = {
  学徒: greedyStrategy,
  艺人: heuristicStrategy,
  团长: oracleStrategy,
}

function playGame(n: number, diff: string, seed: number) {
  const players: PlayerConfig[] = Array.from({ length: n }, (_, i) => ({
    name: `AI-${i + 1}`,
    isHuman: false,
    difficulty: diff === '学徒' ? 'easy' : diff === '艺人' ? 'normal' : 'hard',
  }))
  let s = createGame({ players, seed })
  let empty = 0
  let scouted = 0
  const pointsBySeat = Array.from({ length: n }, () => 0)
  let turns = 0
  for (let round = 1; round <= n; round++) {
    let guard = 0
    while (s.phase !== 'roundEnd') {
      if (++guard > 2000) throw new Error('死锁')
      turns++
      const seat = s.current
      const rng = mulberry32((s.seed ^ (guard * 2654435761)) >>> 0)
      const action = strategies[diff].chooseAction(s, seat, rng)
      s = applyAction(s, seat, action).state
    }
    if (s.lastResult!.condition === 'emptyHand') empty++
    else scouted++
    for (const row of s.lastResult!.rows) pointsBySeat[row.seat] += row.points
    if (round < n) s = startNextRound(s)
  }
  return { empty, scouted, pointsBySeat, turns }
}

for (const n of [3, 4, 5]) {
  for (const diff of Object.keys(strategies)) {
    const SEEDS = n === 5 && diff === '团长' ? 4 : 10
    let empty = 0
    let scouted = 0
    let spread = 0
    let winner = 0
    let turns = 0
    for (let seed = 0; seed < SEEDS; seed++) {
      const r = playGame(n, diff, 1000 + seed * 7919 + n)
      empty += r.empty
      scouted += r.scouted
      turns += r.turns
      const sorted = [...r.pointsBySeat].sort((a, b) => b - a)
      winner += sorted[0]
      spread += sorted[0] - sorted[sorted.length - 1]
    }
    const games = SEEDS * n
    console.log(
      `${n}人局 ${diff}：封轮 ${(scouted / games * 100).toFixed(0)}% / 打光 ${(empty / games * 100).toFixed(0)}%` +
        ` | 胜者均分 ${((winner / SEEDS) as number).toFixed(1)} | 分差 ${((spread / SEEDS) as number).toFixed(1)}` +
        ` | 均回合手数 ${(turns / SEEDS / n).toFixed(0)} (${SEEDS}种子)`,
    )
  }
}
