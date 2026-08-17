import { Cpu, Database, Layers, Monitor } from 'lucide-react'
import {
  DatabaseDriversPanel,
  DatabaseTypesPanel,
  LanguageLibraryPanel,
  SpringBootPanel,
} from '../components/LibraryPanels'
import { defaultDatabaseDrivers } from '../databaseTypes'
import { FRONTEND_ADDONS, FRONTEND_STACK, shouldScaffoldFrontend } from '../frontendTechnologies'
import { LANGUAGE_LABELS } from '../languageLibraries'
import {
  API_OPTIONS,
  APPLICATION_TYPES,
  JAVA_VERSIONS,
  LANGUAGES,
  ORM_OPTIONS_JAVA,
  PACKAGING_OPTIONS,
  SECURITY_OPTIONS_JAVA,
  TESTING_OPTIONS_JAVA,
  frameworksForLanguage,
  languagesForAppType,
} from '../wizard/technologyOptions'
import type { BackendLanguage, WizardState } from '../wizard/types'

interface Props {
  state: WizardState
  onUpdate: (patch: Partial<WizardState>) => void
}

const PRIMARY_FRONTEND = ['react', 'typescript', 'vite', 'javascript']

export function TechnologyConfigurationScreen({ state, onUpdate }: Props) {
  const availableLangs = languagesForAppType(state.applicationType)
  const langOptions = LANGUAGES.filter((l) => availableLangs.includes(l.id))
  const frameworks = frameworksForLanguage(state.backendLanguage)
  const isJava = state.backendLanguage === 'java'

  const update = (patch: Partial<WizardState>) => onUpdate(patch)

  const setLanguage = (lang: BackendLanguage) => {
    update({
      backendLanguage: lang,
      backendFramework: lang === 'java' ? 'java-spring' : lang === 'python' ? 'python' : lang === 'go' ? 'go-gin' : 'nodejs-express',
      databaseDrivers: defaultDatabaseDrivers(lang, state.databaseTypes),
    })
  }

  const toggleFrontend = (id: string, checked: boolean) => {
    update({ frontendStack: { ...state.frontendStack, [id]: checked } })
  }

  const toggleDb = (id: string, checked: boolean) => {
    const databaseTypes = { ...state.databaseTypes, [id]: checked }
    update({
      databaseTypes,
      databaseDrivers: defaultDatabaseDrivers(state.backendLanguage, databaseTypes),
    })
  }

  return (
    <div className="screen">
      <section className="card">
        <div className="card-header">
          <Layers size={16} />
          <h3>Application &amp; Language</h3>
        </div>
        <div className="setup-grid-2">
          <div className="field-block">
            <div className="section-label">Application Type</div>
            <div className="option-grid">
              {APPLICATION_TYPES.map((opt) => (
                <label className="radio-option" key={opt.id}>
                  <input
                    type="radio"
                    name="appType"
                    checked={state.applicationType === opt.id}
                    onChange={() => update({ applicationType: opt.id })}
                  />
                  {opt.label}
                </label>
              ))}
            </div>
          </div>
          <div className="field-block">
            <div className="section-label">Language</div>
            <div className="option-row">
              {langOptions.map((opt) => (
                <label className="radio-option" key={opt.id}>
                  <input
                    type="radio"
                    name="language"
                    checked={state.backendLanguage === opt.id}
                    onChange={() => setLanguage(opt.id as BackendLanguage)}
                  />
                  {opt.label}
                </label>
              ))}
            </div>
          </div>
        </div>

        <div className="setup-grid-2">
          <div className="field-block">
            <div className="section-label">Framework</div>
            <div className="option-row">
              {frameworks.map((fw) => (
                <label className="radio-option" key={fw.id}>
                  <input type="radio" name="framework" checked readOnly />
                  {fw.label}
                </label>
              ))}
            </div>
          </div>
          {isJava && (
            <div className="field-block">
              <SpringBootPanel
                version={state.springBootVersion}
                onChange={(v) => update({ springBootVersion: v })}
              />
            </div>
          )}
        </div>

        {isJava && (
          <div className="setup-grid-2">
            <div className="field-block">
              <div className="section-label">Java Version</div>
              <div className="option-row">
                {JAVA_VERSIONS.map((v) => (
                  <label className="radio-option" key={v}>
                    <input
                      type="radio"
                      name="javaVersion"
                      checked={state.javaVersion === v}
                      onChange={() => update({ javaVersion: v })}
                    />
                    Java {v}
                  </label>
                ))}
              </div>
            </div>
            <div className="field-block">
              <div className="section-label">Build Tool</div>
              <div className="option-row">
                {(
                  [
                    ['gradle-groovy', 'Gradle - Groovy'],
                    ['gradle-kotlin', 'Gradle - Kotlin'],
                    ['maven', 'Maven'],
                  ] as const
                ).map(([value, label]) => (
                  <label className="radio-option" key={value}>
                    <input
                      type="radio"
                      name="buildTool"
                      checked={state.buildTool === value}
                      onChange={() => update({ buildTool: value })}
                    />
                    {label}
                  </label>
                ))}
              </div>
            </div>
          </div>
        )}
      </section>

      <section className="card">
        <div className="card-header">
          <Monitor size={16} />
          <h3>Frontend Technologies</h3>
        </div>
        <div className="option-row">
          {FRONTEND_STACK.filter((o) => PRIMARY_FRONTEND.includes(o.id)).map((opt) => (
            <label className="checkbox-option" key={opt.id}>
              <input
                type="checkbox"
                checked={Boolean(state.frontendStack[opt.id])}
                onChange={(e) => toggleFrontend(opt.id, e.target.checked)}
              />
              {opt.label}
            </label>
          ))}
        </div>
        {shouldScaffoldFrontend(state.frontendStack) && (
          <details className="advanced-toggle">
            <summary>Frontend libraries</summary>
            <div className="advanced-body option-grid">
              {FRONTEND_ADDONS.map((lib) => (
                <label className="checkbox-option" key={lib.id}>
                  <input
                    type="checkbox"
                    checked={Boolean(state.frontendLibraries[lib.id])}
                    onChange={(e) =>
                      update({
                        frontendLibraries: { ...state.frontendLibraries, [lib.id]: e.target.checked },
                      })
                    }
                  />
                  {lib.label}
                </label>
              ))}
            </div>
          </details>
        )}
      </section>

      <section className="card">
        <div className="card-header">
          <Cpu size={16} />
          <h3>Backend Stack Options</h3>
        </div>
        <div className="setup-grid-2">
          <div className="field-block">
            <div className="section-label">Packaging</div>
            <div className="option-row">
              {PACKAGING_OPTIONS.map((opt) => (
                <label className="radio-option" key={opt.id}>
                  <input
                    type="radio"
                    name="packaging"
                    checked={state.packaging === opt.id}
                    onChange={() => update({ packaging: opt.id })}
                  />
                  {opt.label}
                </label>
              ))}
            </div>
          </div>
          <div className="field-block">
            <div className="section-label">Configuration</div>
            <div className="option-row">
              <label className="radio-option">
                <input
                  type="radio"
                  name="configFormat"
                  checked={state.configFormat === 'yaml'}
                  onChange={() => update({ configFormat: 'yaml' })}
                />
                YAML
              </label>
              <label className="radio-option">
                <input
                  type="radio"
                  name="configFormat"
                  checked={state.configFormat === 'properties'}
                  onChange={() => update({ configFormat: 'properties' })}
                />
                Properties
              </label>
            </div>
          </div>
        </div>

        {isJava && (
          <>
            <div className="setup-grid-2">
              <div className="field-block">
                <div className="section-label">ORM / Data Access</div>
                <div className="option-row">
                  {ORM_OPTIONS_JAVA.map((opt) => (
                    <label className="radio-option" key={opt.id}>
                      <input
                        type="radio"
                        name="orm"
                        checked={state.orm === opt.id}
                        onChange={() => update({ orm: opt.id })}
                      />
                      {opt.label}
                    </label>
                  ))}
                </div>
              </div>
              <div className="field-block">
                <div className="section-label">API Style</div>
                <div className="option-row">
                  {API_OPTIONS.map((opt) => (
                    <label className="radio-option" key={opt.id}>
                      <input
                        type="radio"
                        name="apiStyle"
                        checked={state.apiStyle === opt.id}
                        onChange={() => update({ apiStyle: opt.id })}
                      />
                      {opt.label}
                    </label>
                  ))}
                </div>
              </div>
            </div>
            <div className="setup-grid-2">
              <div className="field-block">
                <div className="section-label">Security</div>
                <div className="option-row">
                  {SECURITY_OPTIONS_JAVA.map((opt) => (
                    <label className="radio-option" key={opt.id}>
                      <input
                        type="radio"
                        name="security"
                        checked={state.securityOption === opt.id}
                        onChange={() => update({ securityOption: opt.id })}
                      />
                      {opt.label}
                    </label>
                  ))}
                </div>
              </div>
              <div className="field-block">
                <div className="section-label">Testing</div>
                <div className="option-row">
                  {TESTING_OPTIONS_JAVA.map((opt) => (
                    <label className="radio-option" key={opt.id}>
                      <input
                        type="radio"
                        name="testing"
                        checked={state.testingFramework === opt.id}
                        onChange={() => update({ testingFramework: opt.id })}
                      />
                      {opt.label}
                    </label>
                  ))}
                </div>
              </div>
            </div>
          </>
        )}

        <details className="advanced-toggle">
          <summary>{LANGUAGE_LABELS[state.backendLanguage]} libraries</summary>
          <div className="advanced-body">
            <LanguageLibraryPanel
              language={state.backendLanguage}
              selected={state.backendLibraries}
              onToggle={(id, checked) =>
                update({ backendLibraries: { ...state.backendLibraries, [id]: checked } })
              }
            />
          </div>
        </details>
      </section>

      <section className="card">
        <div className="card-header">
          <Database size={16} />
          <h3>Database</h3>
        </div>
        <DatabaseTypesPanel selected={state.databaseTypes} onToggle={toggleDb} />
        <details className="advanced-toggle">
          <summary>{LANGUAGE_LABELS[state.backendLanguage]} database drivers</summary>
          <div className="advanced-body">
            <DatabaseDriversPanel
              language={state.backendLanguage}
              databaseTypes={state.databaseTypes}
              selected={state.databaseDrivers}
              onToggle={(id, checked) =>
                update({ databaseDrivers: { ...state.databaseDrivers, [id]: checked } })
              }
            />
          </div>
        </details>
      </section>

      <section className="card">
        <div className="card-header">
          <Layers size={16} />
          <h3>Project Metadata</h3>
        </div>
        <div className="field-grid">
          <div className="field-group">
            <label htmlFor="artifactName">Artifact / Module Name</label>
            <input
              id="artifactName"
              value={state.artifactName}
              onChange={(e) => update({ artifactName: e.target.value })}
            />
          </div>
          <div className="field-group">
            <label htmlFor="version">Version</label>
            <input id="version" value={state.version} onChange={(e) => update({ version: e.target.value })} />
          </div>
          <div className="field-group">
            <label htmlFor="packageNamespace">Package / Namespace</label>
            <input
              id="packageNamespace"
              placeholder="com.blinkapp.backend"
              value={state.packageNamespace}
              onChange={(e) => update({ packageNamespace: e.target.value })}
            />
          </div>
        </div>
      </section>
    </div>
  )
}

export function validateTechnology(state: WizardState): string | null {
  if (!state.artifactName.trim()) return 'Artifact / module name is required.'
  if (!state.frontendStack.react || !state.frontendStack.typescript || !state.frontendStack.vite) {
    return 'Select React, TypeScript, and Vite for the frontend stack.'
  }
  if (state.backendLanguage !== 'java') return 'Backend must be Java Spring Boot for this configuration.'
  return null
}
