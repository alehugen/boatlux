/** O sistema pede movimento reduzido: animações viram troca direta. */
export const prefersReducedMotion = (): boolean =>
  typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: reduce)').matches
