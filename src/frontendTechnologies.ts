export interface FrontendOption {
  id: string
  label: string
  defaultSelected?: boolean
}

/** Core frontend stack — each option is separate (React, TypeScript, Vite, etc.) */
export const FRONTEND_STACK: FrontendOption[] = [
  { id: 'react', label: 'React', defaultSelected: true },
  { id: 'typescript', label: 'TypeScript', defaultSelected: true },
  { id: 'vite', label: 'Vite', defaultSelected: true },
  { id: 'javascript', label: 'JavaScript' },
  { id: 'vue', label: 'Vue.js' },
  { id: 'angular', label: 'Angular' },
  { id: 'nextjs', label: 'Next.js' },
  { id: 'nuxt', label: 'Nuxt.js' },
  { id: 'svelte', label: 'Svelte' },
  { id: 'remix', label: 'Remix' },
  { id: 'webpack', label: 'Webpack' },
  { id: 'tailwindcss', label: 'Tailwind CSS' },
]

/** Additional frontend libraries and tooling */
export const FRONTEND_ADDONS: FrontendOption[] = [
  { id: 'react-router', label: 'React Router' },
  { id: 'tanstack-query', label: 'TanStack Query' },
  { id: 'zustand', label: 'Zustand' },
  { id: 'redux', label: 'Redux Toolkit' },
  { id: 'eslint', label: 'ESLint', defaultSelected: true },
  { id: 'prettier', label: 'Prettier' },
  { id: 'sass', label: 'Sass / SCSS' },
  { id: 'jest', label: 'Jest' },
  { id: 'vitest', label: 'Vitest' },
  { id: 'cypress', label: 'Cypress' },
  { id: 'playwright', label: 'Playwright' },
  { id: 'pwa', label: 'PWA Support' },
]

export function defaultFrontendStack(): Record<string, boolean> {
  const selected: Record<string, boolean> = {}
  for (const opt of FRONTEND_STACK) {
    selected[opt.id] = Boolean(opt.defaultSelected)
  }
  return selected
}

export function defaultFrontendAddons(): Record<string, boolean> {
  const selected: Record<string, boolean> = {}
  for (const opt of FRONTEND_ADDONS) {
    selected[opt.id] = Boolean(opt.defaultSelected)
  }
  return selected
}

export function selectedFrontendIds(map: Record<string, boolean>): string[] {
  return Object.entries(map)
    .filter(([, on]) => on)
    .map(([id]) => id)
}

export function shouldScaffoldFrontend(stack: Record<string, boolean>): boolean {
  const triggers = ['react', 'vue', 'angular', 'nextjs', 'nuxt', 'svelte', 'remix']
  return triggers.some((id) => stack[id])
}

export function frontendStackLabel(stack: Record<string, boolean>): string {
  const ids = selectedFrontendIds(stack)
  return ids.length ? ids.join(' + ') : 'none'
}
