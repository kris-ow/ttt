/** Square envelope button. Mounted twice — right-aligned in the mobile title
 *  row, and left of DAILY_FEED in the desktop nav — so callers pass the
 *  responsive visibility class. Hover treatment matches the nav tabs.
 *  `shine-sweep` (src/index.css) adds the periodic glint that separates it from
 *  the identically-styled inactive tabs; it pauses on hover. */
export function ContactButton({ onClick, className = '' }: { onClick: () => void; className?: string }) {
  return (
    <button
      onClick={onClick}
      aria-label="Send a message"
      title="SEND A MESSAGE"
      className={`shine-sweep h-[30px] w-[30px] shrink-0 items-center justify-center border cursor-pointer transition-colors border-green/50 text-green/50 hover:border-green hover:text-green ${className}`}
    >
      {/* Lucide "mail" (MIT), inlined rather than pulling in the package for one
          icon, with rx="2" dropped — sharp corners only. Redrawn on a 20-unit
          grid rather than scaled down from Lucide's native 24: at 1:1 units-to-
          pixels with integer body coordinates the 2px strokes land on whole
          pixels. Scaling 24 -> 20 directly is what made it blurry before. */}
      <svg
        width="20"
        height="20"
        viewBox="0 0 20 20"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <rect width="16" height="12" x="2" y="4" />
        <path d="m18 5.8-7.14 4.7a1.6 1.6 0 0 1-1.72 0L2 5.8" />
      </svg>
    </button>
  )
}
