export type SoundName = 'select' | 'play'

interface SoundEnvironment {
  createContext: () => AudioContext | null
  now: () => number
  isVisible: () => boolean
}

const browserEnvironment: SoundEnvironment = {
  createContext: () => {
    if (typeof window === 'undefined') return null
    const Constructor = window.AudioContext ?? (window as Window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
    return Constructor ? new Constructor({ latencyHint: 'interactive' }) : null
  },
  now: () => performance.now(),
  isVisible: () => typeof document !== 'undefined' && document.visibilityState !== 'hidden',
}

/** Two cached samples, one context, no music, timers for playback, or third-party requests. */
export class SoundPlayer {
  private enabled = false
  private context: AudioContext | null = null
  private resumePending: Promise<void> | null = null
  private buffers = new Map<SoundName, Promise<AudioBuffer>>()
  private active = new Map<AudioBufferSourceNode, GainNode>()
  private generation = 0
  private request = 0
  private lastPlayed: Partial<Record<SoundName, number>> = {}

  constructor(private urls: Record<SoundName, string>, private environment = browserEnvironment) {}

  setEnabled(enabled: boolean) {
    this.enabled = enabled
    if (!enabled) this.stop()
  }

  /** Called synchronously inside pointer/keyboard handlers, before any awaits. */
  unlock(): Promise<void> {
    if (!this.enabled || !this.environment.isVisible()) return Promise.resolve()
    try {
      if (!this.context || this.context.state === 'closed') {
        this.context = this.environment.createContext()
        this.buffers.clear()
        this.resumePending = null
      }
      const context = this.context
      if (!context) return Promise.resolve()
      if (context.state !== 'running') {
        // Retry on a new gesture even when an earlier autoplay-blocked resume
        // is still pending; otherwise a browser could remain silent forever.
        const pending = context.resume().catch(() => {}).finally(() => {
          if (this.resumePending === pending) this.resumePending = null
        })
        this.resumePending = pending
      }
      // Warm both short samples on the first gesture; reuse in-flight requests.
      for (const name of ['select', 'play'] as const) void this.buffer(name, context).catch(() => {})
      return this.resumePending ?? Promise.resolve()
    } catch {
      return Promise.resolve()
    }
  }

  private buffer(name: SoundName, context: AudioContext): Promise<AudioBuffer> {
    const cached = this.buffers.get(name)
    if (cached) return cached
    const loading = fetch(this.urls[name], { credentials: 'same-origin' })
      .then(response => {
        if (!response.ok) throw new Error(`Audio response ${response.status}`)
        return response.arrayBuffer()
      })
      .then(bytes => context.decodeAudioData(bytes))
      .catch(error => {
        if (this.buffers.get(name) === loading) this.buffers.delete(name)
        throw error
      })
    this.buffers.set(name, loading)
    return loading
  }

  async play(name: SoundName, preview = false): Promise<boolean> {
    if (!this.enabled || !this.environment.isVisible()) return false
    const started = this.environment.now()
    if (!preview && started - (this.lastPlayed[name] ?? -Infinity) < 45) return false
    const generation = this.generation
    const request = ++this.request
    const ready = this.unlock()
    const context = this.context
    if (!context) return false
    const deadline = preview ? 2500 : 300
    let timeout: ReturnType<typeof setTimeout> | undefined
    try {
      const buffer = await Promise.race([
        Promise.all([ready, this.buffer(name, context)]).then(([, decoded]) => decoded),
        new Promise<null>(resolve => { timeout = setTimeout(() => resolve(null), deadline) }),
      ])
      // Never replay stale clicks after loading, muting, navigation or backgrounding.
      if (!buffer || !this.enabled || !this.environment.isVisible() || generation !== this.generation
        || request !== this.request || context !== this.context || context.state !== 'running'
        || this.environment.now() - started > deadline) return false

      while (this.active.size >= 4) this.release(this.active.keys().next().value!, true)
      const source = context.createBufferSource()
      const gain = context.createGain()
      source.buffer = buffer
      gain.gain.value = 0.5 // Same -6 dB level as the selected auditions.
      source.connect(gain)
      gain.connect(context.destination)
      source.onended = () => this.release(source)
      this.active.set(source, gain)
      try { source.start() } catch { this.release(source, true); return false }
      this.lastPlayed[name] = this.environment.now()
      return true
    } catch {
      return false // Audio failure must never interrupt the game.
    } finally {
      if (timeout !== undefined) clearTimeout(timeout)
    }
  }

  private release(source: AudioBufferSourceNode, stop = false) {
    const gain = this.active.get(source)
    this.active.delete(source)
    source.onended = null
    if (stop) { try { source.stop() } catch { /* Already ended. */ } }
    source.disconnect()
    gain?.disconnect()
  }

  stop() {
    this.generation++
    this.request++
    this.lastPlayed = {}
    for (const source of this.active.keys()) this.release(source, true)
  }

  dispose() {
    this.enabled = false
    this.stop()
    const context = this.context
    this.context = null
    this.buffers.clear()
    if (context && context.state !== 'closed') void context.close().catch(() => {})
  }
}
