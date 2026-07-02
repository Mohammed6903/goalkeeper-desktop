/**
 * Skeleton — reusable loading shimmer bar for data-loading states.
 *
 * Usage:
 *   <Skeleton width="60%" />
 *   <SkeletonRow />   — a full placeholder task row
 *   <SkeletonList n={5} />  — N placeholder rows
 */

import React from 'react'

// ---------------------------------------------------------------------------
// Base shimmer bar
// ---------------------------------------------------------------------------

export function Skeleton({
  width = '100%',
  height = 14,
  borderRadius = 6,
  style,
}: {
  width?: string | number
  height?: string | number
  borderRadius?: string | number
  style?: React.CSSProperties
}) {
  return (
    <div
      style={{
        width,
        height,
        borderRadius,
        background: 'var(--surface-2)',
        position: 'relative',
        overflow: 'hidden',
        ...style,
      }}
    >
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background:
            'linear-gradient(90deg, transparent 0%, color-mix(in srgb, var(--text) 6%, transparent) 50%, transparent 100%)',
          animation: 'skeleton-shimmer 1.4s ease-in-out infinite',
        }}
      />
      <style>{`
        @keyframes skeleton-shimmer {
          0% { transform: translateX(-100%); }
          100% { transform: translateX(100%); }
        }
      `}</style>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Skeleton task row — matches ReadyRow / TaskRow rough layout
// ---------------------------------------------------------------------------

export function SkeletonRow() {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        padding: '10px 8px',
      }}
    >
      <Skeleton width={28} height={12} />
      <Skeleton width="55%" height={12} />
      <Skeleton width={40} height={12} style={{ marginLeft: 'auto' }} />
      <Skeleton width={32} height={20} borderRadius={99} />
    </div>
  )
}

// ---------------------------------------------------------------------------
// N skeleton rows
// ---------------------------------------------------------------------------

export function SkeletonList({ n = 5 }: { n?: number }) {
  return (
    <>
      {Array.from({ length: n }, (_, i) => (
        <SkeletonRow key={i} />
      ))}
    </>
  )
}
