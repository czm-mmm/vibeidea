import selectUrl from '@/assets/audio/select.wav'
import playUrl from '@/assets/audio/play.wav'
import { SoundPlayer } from './player'

export const soundPlayer = new SoundPlayer({ select: selectUrl, play: playUrl })
