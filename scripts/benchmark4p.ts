// 4 人局：艺人 vs 团长 显著性复核（25 种子）
import { applyAction, createGame, startNextRound } from '../src/core/engine'
import { heuristicStrategy, oracleStrategy } from '../src/core/ai'
import { mulberry32 } from '../src/core/rng'
import type { AiStrategy } from '../src/core/ai'

function playGame(n: number, strat: AiStrategy, seed: number) {
  const players = Array.from({ length: n }, (_, i) => ({
    name: `AI-${i + 1}`,
    isHuman: false,
    difficulty: 'hard',
  }))
  let s = createGame({ players, seed })
  const pts = Array.from({ length: n }, () => 0)
  for (let round = 1; round <= n; round++) {
    let guard = 0
    while (s.phase !== 'roundEnd') {
      if (++guard > 2000) throw new Error('死锁')
      const seat = s.current
      const rng = mulberry32((s.seed ^ (guard * 2654435761)) >>> 0)
      s = applyAction(s, seat, strat.chooseAction(s, seat, rng)).state
    }
    for (const row of s.lastResult!.rows) pts[row.seat] += row.points
    if (round < n) s = startNextRound(s)
  }
  return [...pts].sort((a, b) => b - a)
}

const SEEDS = 40
for (const [name, strat] of [
  ['艺人', heuristicStrategy],
  ['团长', oracleStrategy],
] as const) {
  let win = 0
  let spread = 0
  for (let k = 0; k < SEEDS; k++) {
    const r = playGame(4, strat, 20000 + k * 104729)
    win += r[0]
    spread += r[0] - r[3]
  }
  console.log(`4人局 ${name}：胜者均分 ${(win / SEEDS).toFixed(1)} | 分差 ${(spread / SEEDS).toFixed(1)}`)
}
