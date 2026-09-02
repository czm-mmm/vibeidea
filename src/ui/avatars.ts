// ===== 头像数据：马戏团角色（与卡面同一美术语言：奶油脸 + 马戏色盘圆底） =====

export type AvatarId =
  | 'clown'
  | 'magician'
  | 'ringmaster'
  | 'lion'
  | 'elephant'
  | 'monkey'
  | 'rabbit'
  | 'star'

export interface AvatarMeta {
  id: AvatarId
  label: string
  /** 圆底颜色（取自 design tokens 同源色） */
  bg: string
}

export const AVATARS: AvatarMeta[] = [
  { id: 'clown', label: '小丑', bg: '#3aa6a0' },
  { id: 'magician', label: '魔术师', bg: '#7b61ff' },
  { id: 'ringmaster', label: '团长', bg: '#d9432f' },
  { id: 'lion', label: '猛狮', bg: '#e9b23c' },
  { id: 'elephant', label: '大象', bg: '#3e7cc0' },
  { id: 'monkey', label: '猴子', bg: '#8a5a33' },
  { id: 'rabbit', label: '白兔', bg: '#c74fa0' },
  { id: 'star', label: '明星', bg: '#4f8f2f' },
]

export const AVATAR_IDS = AVATARS.map((a) => a.id)

export function avatarMeta(id: string): AvatarMeta {
  return AVATARS.find((a) => a.id === id) ?? AVATARS[0]
}

/** AI 按座位号从剩余角色中顺序分配（跳过玩家所选），保证同局不撞脸 */
export function avatarForSeat(seat: number, playerAvatar: string): AvatarId {
  const pool = AVATARS.filter((a) => a.id !== playerAvatar)
  return pool[(seat - 1) % pool.length].id
}
