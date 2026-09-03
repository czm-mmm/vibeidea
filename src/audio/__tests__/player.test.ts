import { afterEach, describe, expect, it, vi } from 'vitest'
import { SoundPlayer } from '../player'

function harness() {
  let now = 1000
  let visible = true
  const sources: Array<{ start: ReturnType<typeof vi.fn>; stop: ReturnType<typeof vi.fn>; disconnect: ReturnType<typeof vi.fn>; onended: (() => void) | null }> = []
  const gains: Array<{ gain: { value: number }; disconnect: ReturnType<typeof vi.fn> }> = []
  const context = {
    state: 'running', destination: {},
    resume: vi.fn(async () => { context.state = 'running' }),
    close: vi.fn(async () => { context.state = 'closed' }),
    decodeAudioData: vi.fn(async () => ({ duration: 0.1 } as AudioBuffer)),
    createBufferSource: vi.fn(() => {
      const source = { buffer: null, connect: vi.fn(), start: vi.fn(), stop: vi.fn(), disconnect: vi.fn(), onended: null as (() => void) | null }
      sources.push(source)
      return source
    }),
    createGain: vi.fn(() => {
      const gain = { gain: { value: 1 }, connect: vi.fn(), disconnect: vi.fn() }
      gains.push(gain)
      return gain
    }),
  }
  const createContext = vi.fn(() => context as unknown as AudioContext)
  const fetcher = vi.fn(async () => ({ ok: true, arrayBuffer: async () => new ArrayBuffer(8) }))
  vi.stubGlobal('fetch', fetcher)
  const player = new SoundPlayer({ select: '/select.wav', play: '/play.wav' }, {
    createContext, now: () => now, isVisible: () => visible,
  })
  return { player, context, sources, gains, createContext, fetcher,
    advance: (ms = 100) => { now += ms }, hide: () => { visible = false } }
}

afterEach(() => { vi.unstubAllGlobals(); vi.useRealTimers() })

describe('short sample player', () => {
  it('does not create audio or fetch samples while disabled', async () => {
    const h = harness()
    await h.player.unlock()
    expect(await h.player.play('select')).toBe(false)
    expect(h.createContext).not.toHaveBeenCalled()
    expect(h.fetcher).not.toHaveBeenCalled()
  })

  it('plays the approved sounds once at audition volume and reuses decoded buffers', async () => {
    const h = harness()
    h.player.setEnabled(true)
    expect(await h.player.play('select')).toBe(true)
    h.advance()
    expect(await h.player.play('play')).toBe(true)
    h.advance()
    expect(await h.player.play('select')).toBe(true)
    expect(h.createContext).toHaveBeenCalledTimes(1)
    expect(h.fetcher).toHaveBeenCalledTimes(2)
    expect(h.context.decodeAudioData).toHaveBeenCalledTimes(2)
    expect(h.sources).toHaveLength(3)
    for (const source of h.sources) expect(source.start).toHaveBeenCalledTimes(1)
    for (const gain of h.gains) expect(gain.gain.value).toBe(0.5)
  })

  it('resumes synchronously on the gesture and retries a pending blocked resume', async () => {
    const h = harness()
    h.context.state = 'suspended'
    h.context.resume.mockImplementationOnce(() => new Promise<void>(() => {}))
    h.player.setEnabled(true)
    void h.player.unlock()
    expect(h.context.resume).toHaveBeenCalledTimes(1)
    expect(await h.player.play('select')).toBe(true)
    expect(h.context.resume).toHaveBeenCalledTimes(2)
  })

  it('coalesces pending rapid clicks instead of playing a delayed burst', async () => {
    const h = harness()
    h.player.setEnabled(true)
    const pending = [h.player.play('select'), h.player.play('select'), h.player.play('select')]
    expect(await Promise.all(pending)).toEqual([false, false, true])
    expect(h.sources).toHaveLength(1)
    expect(await h.player.play('select')).toBe(false)
    h.advance(50)
    expect(await h.player.play('select')).toBe(true)
  })

  it('cancels in-flight playback on mute and immediately stops active sources', async () => {
    const h = harness()
    h.player.setEnabled(true)
    const pending = h.player.play('select')
    h.player.setEnabled(false)
    expect(await pending).toBe(false)
    expect(h.sources).toHaveLength(0)
    h.player.setEnabled(true)
    expect(await h.player.play('select')).toBe(true)
    h.player.setEnabled(false)
    expect(h.sources[0].stop).toHaveBeenCalledOnce()
    expect(h.sources[0].disconnect).toHaveBeenCalledOnce()
  })

  it('drops hidden-tab and stale network responses', async () => {
    const h = harness()
    h.player.setEnabled(true)
    const pending = h.player.play('play')
    h.advance(301)
    expect(await pending).toBe(false)
    h.hide()
    expect(await h.player.play('select')).toBe(false)
    expect(h.sources).toHaveLength(0)
  })

  it('times out a blocked context and leaves the game usable', async () => {
    vi.useFakeTimers()
    const h = harness()
    h.context.state = 'suspended'
    h.context.resume.mockImplementation(() => new Promise<void>(() => {}))
    h.player.setEnabled(true)
    const pending = h.player.play('select')
    await vi.advanceTimersByTimeAsync(301)
    expect(await pending).toBe(false)
  })

  it('allows a deliberate settings preview a longer loading window', async () => {
    const h = harness()
    h.player.setEnabled(true)
    const pending = h.player.play('select', true)
    h.advance(600)
    expect(await pending).toBe(true)
  })

  it('recovers from a download failure without throwing', async () => {
    const h = harness()
    h.fetcher.mockRejectedValueOnce(new Error('offline'))
    h.player.setEnabled(true)
    expect(await h.player.play('select')).toBe(false)
    h.advance()
    expect(await h.player.play('select')).toBe(true)
  })

  it('disconnects completed nodes, caps overlap and closes on disposal', async () => {
    const h = harness()
    h.player.setEnabled(true)
    for (let i = 0; i < 5; i++) { await h.player.play('play'); h.advance() }
    expect(h.sources[0].stop).toHaveBeenCalledOnce()
    h.sources[1].onended?.()
    expect(h.sources[1].disconnect).toHaveBeenCalledOnce()
    h.player.dispose()
    expect(h.context.close).toHaveBeenCalledOnce()
    expect(await h.player.play('play')).toBe(false)
  })
})
