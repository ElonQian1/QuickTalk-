// 提供 px -> rem 转换与统一 spacing/typography 映射，方便在迁移过程中逐步替换。
// 基准 root 字号：16px（由 html clamp 控制实际值）

export const BASE_FONT_SIZE = 16;
export const pxToRem = (px: number) => `${px / BASE_FONT_SIZE}rem`;

export const spacing = {
  // 极细间距 / 发丝线用途（谨慎使用：布局缝隙、分隔线对齐）
  hair: pxToRem(1),
  micro: pxToRem(2),
  xxs: pxToRem(4),
  xs: pxToRem(6),
  sm: pxToRem(8),
  smd: pxToRem(12),
  md: pxToRem(16),
  mlg: pxToRem(20),
  lg: pxToRem(24),
  xlg: pxToRem(28),
  xl: pxToRem(32),
  xxl: pxToRem(40),
};

export const typography = {
  display: pxToRem(32),
  h1: pxToRem(24),
  h2: pxToRem(20),
  h3: pxToRem(18),
  body: pxToRem(16),
  small: pxToRem(14),
  caption: pxToRem(12),
  micro: pxToRem(11),
};

// 未来：可加入 dynamicScale 系统，比如用户设置“紧凑/标准/宽松” -> 乘以额外系数。
