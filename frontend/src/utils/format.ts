export function formatBadgeCount(n?: number | null): string | undefined {
  if (!n || n <= 0) return undefined;
  if (n > 99) return '99+';
  return String(n);
}
