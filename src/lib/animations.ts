/**
 * Shared animation presets for framer-motion.
 * Spread directly onto motion elements: <motion.div {...anim.slide} />
 */

export const anim = {
  /** Height + opacity reveal for conditionally-shown sections */
  slide: {
    initial: { opacity: 0, height: 0 },
    animate: { opacity: 1, height: 'auto' },
    exit: { opacity: 0, height: 0 },
    transition: { duration: 0.2, ease: [0.4, 0, 0.2, 1] as const },
  },

  /** Fade + small vertical shift — used for panel/tab content switching */
  fadeUp: {
    initial: { opacity: 0, y: 6 },
    animate: { opacity: 1, y: 0 },
    exit: { opacity: 0, y: -6 },
    transition: { duration: 0.15 },
  },

  /** Full-screen modal backdrop */
  modalBackdrop: {
    initial: { opacity: 0 },
    animate: { opacity: 1 },
    exit: { opacity: 0 },
    transition: { duration: 0.15 },
  },

  /** Modal panel — slides up + scales in */
  modalPanel: {
    initial: { opacity: 0, y: 16, scale: 0.97 },
    animate: { opacity: 1, y: 0, scale: 1 },
    exit: { opacity: 0, y: 8, scale: 0.97 },
    transition: { duration: 0.2, ease: [0.4, 0, 0.2, 1] as const },
  },
} as const

/** Spring transition for sliding tab indicators (layoutId elements) */
export const spring = { type: 'spring', duration: 0.25, bounce: 0.15 } as const
