import type { BackendLanguage } from './types'

export interface LibraryOption {
  id: string
  label: string
  description?: string
  defaultSelected?: boolean
}

export const LANGUAGE_LIBRARIES: Record<BackendLanguage, LibraryOption[]> = {
  python: [
    { id: 'fastapi', label: 'FastAPI', defaultSelected: true },
    { id: 'django', label: 'Django' },
    { id: 'flask', label: 'Flask' },
    { id: 'sqlalchemy', label: 'SQLAlchemy', defaultSelected: true },
    { id: 'pydantic', label: 'Pydantic', defaultSelected: true },
    { id: 'uvicorn', label: 'Uvicorn', defaultSelected: true },
    { id: 'pytest', label: 'pytest' },
    { id: 'celery', label: 'Celery' },
    { id: 'alembic', label: 'Alembic' },
  ],
  java: [
    { id: 'spring-boot', label: 'Spring Boot', defaultSelected: true },
    { id: 'spring-web', label: 'Spring Web', defaultSelected: true },
    { id: 'spring-data-jpa', label: 'Spring Data JPA', defaultSelected: true },
    { id: 'spring-security', label: 'Spring Security' },
    { id: 'spring-validation', label: 'Spring Validation' },
    { id: 'lombok', label: 'Lombok', defaultSelected: true },
    { id: 'hibernate', label: 'Hibernate' },
    { id: 'junit5', label: 'JUnit 5', defaultSelected: true },
    { id: 'mapstruct', label: 'MapStruct' },
  ],
  nodejs: [
    { id: 'express', label: 'Express', defaultSelected: true },
    { id: 'nestjs', label: 'NestJS' },
    { id: 'fastify', label: 'Fastify' },
    { id: 'typescript', label: 'TypeScript', defaultSelected: true },
    { id: 'prisma', label: 'Prisma' },
    { id: 'mongoose', label: 'Mongoose' },
    { id: 'jest', label: 'Jest', defaultSelected: true },
    { id: 'zod', label: 'Zod' },
    { id: 'socket-io', label: 'Socket.IO' },
  ],
  go: [
    { id: 'gin', label: 'Gin', defaultSelected: true },
    { id: 'echo', label: 'Echo' },
    { id: 'fiber', label: 'Fiber' },
    { id: 'gorm', label: 'GORM', defaultSelected: true },
    { id: 'chi', label: 'Chi Router' },
    { id: 'grpc', label: 'gRPC' },
    { id: 'testify', label: 'Testify', defaultSelected: true },
    { id: 'viper', label: 'Viper' },
    { id: 'zap', label: 'Zap Logger' },
  ],
}

export const SPRING_BOOT_VERSIONS = ['4.1.0', '4.0.8 (SNAPSHOT)', '4.0.7'] as const

export const FRONTEND_LIBRARIES: LibraryOption[] = [
  { id: 'react', label: 'React', defaultSelected: true },
  { id: 'typescript', label: 'TypeScript', defaultSelected: true },
  { id: 'vite', label: 'Vite', defaultSelected: true },
  { id: 'tailwindcss', label: 'Tailwind CSS' },
  { id: 'react-router', label: 'React Router' },
  { id: 'tanstack-query', label: 'TanStack Query' },
  { id: 'zustand', label: 'Zustand' },
  { id: 'eslint', label: 'ESLint', defaultSelected: true },
]

export function defaultLibrariesForLanguage(lang: BackendLanguage): Record<string, boolean> {
  const selected: Record<string, boolean> = {}
  for (const lib of LANGUAGE_LIBRARIES[lang]) {
    selected[lib.id] = Boolean(lib.defaultSelected)
  }
  return selected
}

export function defaultFrontendLibraries(): Record<string, boolean> {
  const selected: Record<string, boolean> = {}
  for (const lib of FRONTEND_LIBRARIES) {
    selected[lib.id] = Boolean(lib.defaultSelected)
  }
  return selected
}

export function selectedLibraryIds(map: Record<string, boolean>): string[] {
  return Object.entries(map)
    .filter(([, on]) => on)
    .map(([id]) => id)
}

export const LANGUAGE_LABELS: Record<BackendLanguage, string> = {
  python: 'Python',
  java: 'Java',
  nodejs: 'Node.js',
  go: 'Go',
}
