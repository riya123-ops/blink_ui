import type { BackendLanguage } from '../types'
import {
  DATABASE_TYPES,
  visibleDatabaseDrivers,
} from '../databaseTypes'
import { LANGUAGE_LIBRARIES, SPRING_BOOT_VERSIONS } from '../languageLibraries'

interface LibraryCheckboxGridProps {
  language: BackendLanguage
  selected: Record<string, boolean>
  onToggle: (id: string, checked: boolean) => void
}

export function LanguageLibraryPanel({ language, selected, onToggle }: LibraryCheckboxGridProps) {
  const libraries = LANGUAGE_LIBRARIES[language]

  return (
    <div className="option-grid">
      {libraries.map((lib) => (
        <label className="checkbox-option" key={lib.id}>
          <input
            type="checkbox"
            checked={Boolean(selected[lib.id])}
            onChange={(e) => onToggle(lib.id, e.target.checked)}
          />
          {lib.label}
        </label>
      ))}
    </div>
  )
}

interface SpringBootPanelProps {
  version: string
  onChange: (version: string) => void
  dimmed?: boolean
}

export function SpringBootPanel({ version, onChange, dimmed }: SpringBootPanelProps) {
  return (
    <>
      <div className={`section-label${dimmed ? ' dimmed' : ''}`}>Spring Boot (if Java)</div>
      <div className="option-row" style={dimmed ? { opacity: 0.4, pointerEvents: 'none' } : undefined}>
        {SPRING_BOOT_VERSIONS.map((v) => {
          const value = v.replace(' (SNAPSHOT)', '')
          return (
            <label className="radio-option" key={v}>
              <input
                type="radio"
                name="springBoot"
                checked={version === value}
                disabled={dimmed}
                onChange={() => onChange(value)}
              />
              {v}
            </label>
          )
        })}
      </div>
    </>
  )
}

interface DatabasePanelProps {
  selected: Record<string, boolean>
  onToggle: (id: string, checked: boolean) => void
}

export function DatabaseTypesPanel({ selected, onToggle }: DatabasePanelProps) {
  return (
    <div className="option-grid">
      {DATABASE_TYPES.map((db) => (
        <label className="checkbox-option" key={db.id}>
          <input
            type="checkbox"
            checked={Boolean(selected[db.id])}
            onChange={(e) => onToggle(db.id, e.target.checked)}
          />
          {db.label}
        </label>
      ))}
    </div>
  )
}

interface DatabaseDriversPanelProps {
  language: BackendLanguage
  databaseTypes: Record<string, boolean>
  selected: Record<string, boolean>
  onToggle: (id: string, checked: boolean) => void
}

export function DatabaseDriversPanel({
  language,
  databaseTypes,
  selected,
  onToggle,
}: DatabaseDriversPanelProps) {
  const drivers = visibleDatabaseDrivers(language, databaseTypes)
  if (drivers.length === 0) return null

  return (
    <div className="option-grid">
      {drivers.map((driver) => (
        <label className="checkbox-option" key={driver.id}>
          <input
            type="checkbox"
            checked={Boolean(selected[driver.id])}
            onChange={(e) => onToggle(driver.id, e.target.checked)}
          />
          {driver.label}
        </label>
      ))}
    </div>
  )
}
