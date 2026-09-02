// ===== 美术数据：数字色带 / 表演者 / 图标 =====
// 卡面结构还原自 Oink 国际版：双色波浪底（两色 = 这张牌两端的数字色），
// 超大数字 = 当前朝上端，黑色圆角小牌 = 另一端数字，左下角表演者小图标 + 姓名。

export const NUMBER_COLOR_VARS: Record<number, string> = {
  1: 'var(--n1)',
  2: 'var(--n2)',
  3: 'var(--n3)',
  4: 'var(--n4)',
  5: 'var(--n5)',
  6: 'var(--n6)',
  7: 'var(--n7)',
  8: 'var(--n8)',
  9: 'var(--n9)',
  10: 'var(--n10)',
}

/** 表演者名字池（致敬原版每张卡独一无二的表演者名） */
export const PERFORMERS = [
  'Xavier', 'Teresa', 'Rafael', 'Mila', 'Bruno', 'Cleo', 'Dante', 'Nadia',
  'Oskar', 'Paloma', 'Ivan', 'Sylvie', 'Marco', 'Ines', 'Felix', 'Zara',
  'Hugo', 'Lucia', 'Emil', 'Rosa', 'Theo', 'Alba', 'Nico', 'Vera',
  'Leon', 'Iris', 'Otto', 'Elsa', 'Ravi', 'Maya', 'Karl', 'Opal',
  'Sven', 'Lila', 'Arlo', 'Rita', 'Boris', 'Frida', 'Ciro', 'Enzo',
  'Dora', 'Silas', 'Nora', 'Pablo', 'Vito',
] as const

/** 用牌的两端数字确定表演者（每张物理牌名字稳定） */
export function performerName(top: number, bottom: number): string {
  const key = Math.min(top, bottom) * 10 + Math.max(top, bottom)
  return PERFORMERS[key % PERFORMERS.length]
}

/** 数字 → 马戏团节目图标（viewBox 0 0 24 24 的 path/形状组） */
export const ACT_ICONS: Record<number, string> = {
  1: 'M12 4c-1.2 0-1.8 1-1.2 1.9.4.6.1 1.1-.8 1.1h-2c-1.5 0-2.5 1.2-2.5 2.8 0 1.4.8 2.4 2 2.7l-1.5 5.5h3.2l.6-2.5.6 2.5h3.2l-1.5-5.5c1.2-.3 2-1.3 2-2.7 0-1.6-1-2.8-2.5-2.8h-2c-.9 0-1.2-.5-.8-1.1.6-.9 0-1.9-1.2-1.9z M8.5 17.5h7M9.5 20h5', // 小丑
  2: 'M12 3a2 2 0 100 4 2 2 0 000-4z M12 9l-2.5 4h5L12 9z M12 13a4.5 4.5 0 100 9 4.5 4.5 0 000-9z M12 15.5a2 2 0 100 4 2 2 0 000-4z', // 独轮车
  3: 'M6 9a2 2 0 100 4 2 2 0 000-4z M12 6a2 2 0 100 4 2 2 0 000-4z M18 9a2 2 0 100 4 2 2 0 000-4z M12 12l-5 8 M12 12l5 8', // 杂耍球
  4: 'M5 18c1-5 4-8 7-8s6 3 7 8H5z M12 10V7 M10 7h4 M12 4.5a1.2 1.2 0 100 2.4 1.2 1.2 0 000-2.4z', // 大象
  5: 'M12 3a7 7 0 017 7c0 4-3 5-3 8H8c0-3-3-4-3-8a7 7 0 017-7z M12 8a2.5 2.5 0 100 5 2.5 2.5 0 000-5z', // 火圈
  6: 'M7 20V6a2.5 2.5 0 015 0v14 M7 6h5 M4 20h11', // 礼帽
  7: 'M12 5c3 0 5 2 5 5l-1 3H8l-1-3c0-3 2-5 5-5z M8.5 13.5l-1 3 M15.5 13.5l1 3 M9 8.5h6', // 猛狮
  8: 'M4 5h16 M6 5l3 7-3 7 M18 5l-3 7 3 7 M9 12h6', // 空中秋千
  9: 'M12 3L3 11h3v9h12v-9h3L12 3z M12 8l4 3H8l4-3z', // 帐篷
  10: 'M6 17h9v-3H8V8H5v9z M15 8c2 0 3.5 2 3.5 4.5S17 17 15 17 M6 17l-1 3 M15 17l1 3', // 人肉炮弹
}

/** 牌背：紫色放射纹 + 白 S（还原原版牌背） */
export const CARD_BACK_BG = '#6a4fa3'
