/**
 * UrgencyBadge — colored pill displaying a task's urgency score.
 *
 * Color bands:
 *   score > 8  → red   (--ctp-red)
 *   score >= 4 → peach (--ctp-peach)
 *   score < 4  → blue  (--ctp-blue)
 */

export function UrgencyBadge({ score }: { score: number }) {
  const color =
    score > 8
      ? 'var(--ctp-red)'
      : score >= 4
        ? 'var(--ctp-peach)'
        : 'var(--ctp-blue)'

  return (
    <span
      className="mono inline-flex shrink-0 items-center rounded-full px-1.5 py-0.5 text-[11px] font-semibold leading-none"
      style={{
        color,
        background: `color-mix(in srgb, ${color} 18%, transparent)`,
      }}
    >
      {score.toFixed(1)}
    </span>
  )
}
