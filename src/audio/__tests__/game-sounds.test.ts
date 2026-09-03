import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { createGame } from '@/core/engine'
import { useGameStore } from '@/stores/game'
import { soundPlayer } from '@/audio'

vi.mock('@/audio', () => ({ soundPlayer: { play: vi.fn(async () => true) } }))

function gameReady() {
  const game = useGameStore()
  game.state = createGame({ seed: 42, players: [
    { name: 'Human', isHuman: true, difficulty: 'easy' },
    { name: 'AI 1', isHuman: false, difficulty: 'easy' },
    { name: 'AI 2', isHuman: false, difficulty: 'easy' },
  ] })
  game.state.phase = 'playing'
  game.state.current = 0
  game.view = 'game'
  return game
}

beforeEach(() => { setActivePinia(createPinia()); vi.useFakeTimers(); vi.clearAllMocks() })
afterEach(() => { vi.clearAllTimers(); vi.useRealTimers() })

describe('game sound events', () => {
  it('plays A1 only when a valid card selection changes', () => {
    const game = gameReady()
    game.tapCard(-1)
    game.tapCard(999)
    game.tapCard(0)
    game.tapCard(0)
    game.tapCard(1)
    expect(soundPlayer.play).toHaveBeenCalledTimes(2)
    expect(soundPlayer.play).toHaveBeenNthCalledWith(1, 'select')
    game.state!.current = 1
    game.tapCard(2)
    expect(soundPlayer.play).toHaveBeenCalledTimes(2)
  })

  it('plays B1 for a successful show, not for an invalid show or empty selection', () => {
    const game = gameReady()
    game.performShow()
    game.dispatch(0, { type: 'show', from: 999, to: 999 })
    expect(soundPlayer.play).not.toHaveBeenCalled()
    game.selection = { from: 0, to: 0 }
    game.performShow()
    expect(soundPlayer.play).toHaveBeenCalledExactlyOnceWith('play')
  })

  it('plays B1 for an AI show only while the game is visible', () => {
    const game = gameReady()
    game.state!.current = 1
    game.dispatch(1, { type: 'show', from: 0, to: 0 })
    expect(soundPlayer.play).toHaveBeenCalledExactlyOnceWith('play')
    const hiddenGame = gameReady()
    hiddenGame.view = 'settings'
    hiddenGame.dispatch(0, { type: 'show', from: 0, to: 0 })
    expect(soundPlayer.play).toHaveBeenCalledTimes(1)
  })

  it('plays selection and one show sound for a double action, not for scouting', () => {
    const game = gameReady()
    game.dispatch(0, { type: 'show', from: 0, to: 0 })
    game.humanSeat = 1
    game.state!.players[1].isHuman = true
    vi.mocked(soundPlayer.play).mockClear()
    game.beginDoubleAction()
    game.pickScoutEnd('left')
    game.pickScoutInsert(0)
    expect(soundPlayer.play).not.toHaveBeenCalled()
    game.tapCard(0)
    game.performDoubleShow()
    expect(soundPlayer.play).toHaveBeenNthCalledWith(1, 'select')
    expect(soundPlayer.play).toHaveBeenNthCalledWith(2, 'play')
    expect(soundPlayer.play).toHaveBeenCalledTimes(2)
  })
})
