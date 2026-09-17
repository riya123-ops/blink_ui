import { useEffect, useRef, useState } from 'react'
import { Plus, ShieldAlert, Trash2 } from 'lucide-react'
import { fetchStakeholderRoles } from '../api/blink'
import {
  STAKEHOLDER_ROLES,
  assignmentsFromRoles,
  roleLabel,
  type StakeholderRoleDef,
} from '../wizard/stakeholders'
import { syncRepositoriesFromArtifact, type WizardState } from '../wizard/types'

interface Props {
  state: WizardState
  onUpdate: (patch: Partial<WizardState>) => void
}

/** Matches backend ProjectRequest @Size limits. */
export const PROJECT_NAME_MAX = 255
export const PROJECT_DESCRIPTION_MAX = 8000

/** Show character count only when the field is getting long. */
const NAME_COUNT_SHOW_AT = Math.floor(PROJECT_NAME_MAX * 0.85)
const DESC_COUNT_SHOW_AT = Math.floor(PROJECT_DESCRIPTION_MAX * 0.9)

function slugify(value: string) {
  return value.trim().toLowerCase().replace(/\s+/g, '-').replace(/_/g, '-')
}

function toRoleDef(role: StakeholderRoleDef): StakeholderRoleDef {
  return {
    id: role.id,
    label: role.label,
    defaultName: role.defaultName,
    defaultEmail: role.defaultEmail,
  }
}

export function ProjectStakeholdersScreen({ state, onUpdate }: Props) {
  const [roles, setRoles] = useState<StakeholderRoleDef[]>(STAKEHOLDER_ROLES)
  const [catalogQuiet, setCatalogQuiet] = useState<string | null>('Loading directory…')
  const [removeTarget, setRemoveTarget] = useState<{ id: string; label: string } | null>(null)
  const dirtyRef = useRef(false)
  const catalogLoadedRef = useRef(state.stakeholdersCatalogLoaded)
  const assignmentsRef = useRef(state.stakeholderAssignments)
  catalogLoadedRef.current = state.stakeholdersCatalogLoaded
  assignmentsRef.current = state.stakeholderAssignments

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const remote = await fetchStakeholderRoles()
        if (cancelled) return
        const mapped = remote.map((role) =>
          toRoleDef({
            id: role.roleCode,
            label: role.roleName,
            defaultName: role.defaultName,
            defaultEmail: role.defaultEmail,
          }),
        )
        setRoles(mapped.length ? mapped : STAKEHOLDER_ROLES)
        setCatalogQuiet(null)
        if (!dirtyRef.current && !catalogLoadedRef.current) {
          onUpdate({
            stakeholderAssignments: assignmentsFromRoles(mapped.length ? mapped : STAKEHOLDER_ROLES),
            stakeholdersCatalogLoaded: true,
          })
        } else if (!catalogLoadedRef.current) {
          onUpdate({ stakeholdersCatalogLoaded: true })
        }
      } catch {
        if (cancelled) return
        setRoles(STAKEHOLDER_ROLES)
        setCatalogQuiet(null)
        const catalogIds = new Set(STAKEHOLDER_ROLES.map((role) => role.id))
        const stale = assignmentsRef.current.some((row) => !catalogIds.has(row.roleId))
        if (!dirtyRef.current && (stale || assignmentsRef.current.length === 0) && !catalogLoadedRef.current) {
          onUpdate({
            stakeholderAssignments: assignmentsFromRoles(STAKEHOLDER_ROLES),
            stakeholdersCatalogLoaded: true,
          })
        }
      }
    })()
    return () => {
      cancelled = true
    }
  }, [onUpdate])

  useEffect(() => {
    if (!removeTarget) return
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setRemoveTarget(null)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [removeTarget])

  const updateField = <K extends keyof WizardState>(key: K, value: WizardState[K]) => {
    let patch: Partial<WizardState> = { [key]: value }
    if (key === 'projectName' && typeof value === 'string') {
      const artifact = slugify(value)
      patch = { ...patch, artifactName: artifact, packageNamespace: `com.${artifact.replace(/-/g, '')}.backend` }
      patch = syncRepositoriesFromArtifact({ ...state, ...patch } as WizardState)
    }
    onUpdate(patch)
  }

  const updateRow = (id: string, field: 'roleId' | 'personName' | 'personEmail', value: string) => {
    dirtyRef.current = true
    onUpdate({
      stakeholderAssignments: state.stakeholderAssignments.map((a) => {
        if (a.id !== id) return a
        if (field !== 'roleId') return { ...a, [field]: value }
        const directory = roles.find((role) => role.id === value)
        return {
          ...a,
          roleId: value,
          personName: directory?.defaultName || a.personName,
          personEmail: directory?.defaultEmail || a.personEmail,
        }
      }),
    })
  }

  const addRow = () => {
    dirtyRef.current = true
    const fallback = roles[0] ?? STAKEHOLDER_ROLES[0]
    onUpdate({
      stakeholderAssignments: [
        ...state.stakeholderAssignments,
        {
          id: `sa-${Date.now()}`,
          roleId: fallback.id,
          personName: '',
          personEmail: '',
        },
      ],
    })
  }

  const requestRemove = (id: string) => {
    const row = state.stakeholderAssignments.find((a) => a.id === id)
    const label = row?.personName.trim() || (row ? roleLabel(row.roleId) : 'this stakeholder')
    setRemoveTarget({ id, label })
  }

  const confirmRemove = () => {
    if (!removeTarget) return
    dirtyRef.current = true
    onUpdate({
      stakeholderAssignments: state.stakeholderAssignments.filter((a) => a.id !== removeTarget.id),
    })
    setRemoveTarget(null)
  }

  const showNameCount = state.projectName.length >= NAME_COUNT_SHOW_AT
  const showDescCount = state.description.length >= DESC_COUNT_SHOW_AT

  return (
    <div className="screen screen-project">
      <div className="screen-header">
        <h2>Project & Stakeholders</h2>
        <p>Name the project and add the stakeholders who should be in the loop.</p>
      </div>

      {state.stakeholdersConfirmed ? (
        <div className="sod-banner is-note" role="status">
          <ShieldAlert size={18} aria-hidden />
          <div>
            <strong>Stakeholders confirmed</strong>
            <p className="muted small" style={{ margin: 0 }}>
              Freshness attestation recorded
              {state.stakeholdersConfirmationDigest
                ? ` · digest ${state.stakeholdersConfirmationDigest}`
                : ''}
              . This is not an approve-gate.
            </p>
          </div>
        </div>
      ) : null}
      {state.governanceStatus === 'preparing' && (
        <div className="sod-banner is-checking" role="status">
          Checking separation of duties for this roster. You can continue — this finishes in the background.
        </div>
      )}
      {state.governanceStatus === 'failed' && (
        <div className="sod-banner is-failed" role="status">
          Could not finish stakeholder checks. You can keep going; save this step again to retry.
        </div>
      )}
      {state.sodWarnings && state.sodWarnings.length > 0 && (
        <div className="sod-banner is-note" role="status">
          <ShieldAlert size={18} aria-hidden />
          <div>
            <strong>Governance note</strong>
            <ul>
              {state.sodWarnings.map((w, idx) => (
                <li key={idx}>{w}</li>
              ))}
            </ul>
          </div>
        </div>
      )}

      <section className="card project-setup-card">
        <div className="field-group">
          <div className="field-label-row">
            <label htmlFor="projectName">Project name</label>
            {showNameCount ? (
              <span
                id="projectName-count"
                className={`field-count${state.projectName.length >= PROJECT_NAME_MAX ? ' is-limit' : ''}`}
              >
                {state.projectName.length.toLocaleString()} / {PROJECT_NAME_MAX.toLocaleString()}
              </span>
            ) : null}
          </div>
          <input
            id="projectName"
            placeholder="e.g. Banking Application"
            value={state.projectName}
            maxLength={PROJECT_NAME_MAX}
            aria-describedby={showNameCount ? 'projectName-count' : undefined}
            onChange={(e) => updateField('projectName', e.target.value.slice(0, PROJECT_NAME_MAX))}
          />
        </div>

        <div className="field-group">
          <div className="field-label-row">
            <label htmlFor="description">Short description</label>
            {showDescCount ? (
              <span
                id="description-count"
                className={`field-count${state.description.length >= PROJECT_DESCRIPTION_MAX ? ' is-limit' : ''}`}
              >
                {state.description.length.toLocaleString()} / {PROJECT_DESCRIPTION_MAX.toLocaleString()}
              </span>
            ) : null}
          </div>
          <textarea
            id="description"
            rows={3}
            placeholder="What are we building, in a sentence or two?"
            value={state.description}
            maxLength={PROJECT_DESCRIPTION_MAX}
            aria-describedby={showDescCount ? 'description-count' : undefined}
            onChange={(e) => updateField('description', e.target.value.slice(0, PROJECT_DESCRIPTION_MAX))}
          />
        </div>

        <div className="field-group stakeholder-field">
          <div className="field-label-row">
            <label id="stakeholders-label">Stakeholders</label>
            <button type="button" className="text-btn stakeholder-add" onClick={addRow}>
              <Plus size={14} /> Add stakeholder
            </button>
          </div>

          {catalogQuiet ? <p className="quiet-hint">{catalogQuiet}</p> : null}

          {state.stakeholderAssignments.length === 0 ? (
            <p className="stakeholder-empty">Add at least one stakeholder so Blink knows who to ask.</p>
          ) : (
            <div className="stakeholder-roster" role="group" aria-labelledby="stakeholders-label">
              <ul className="stakeholder-roster-list">
                {state.stakeholderAssignments.map((row) => (
                  <li key={row.id} className="stakeholder-roster-item">
                    <input
                      placeholder="Full name"
                      value={row.personName}
                      aria-label={`Name for ${roleLabel(row.roleId)}`}
                      onChange={(e) => updateRow(row.id, 'personName', e.target.value)}
                    />
                    <input
                      type="email"
                      placeholder="email@example.com"
                      value={row.personEmail}
                      aria-label={`Email for ${roleLabel(row.roleId)}`}
                      onChange={(e) => updateRow(row.id, 'personEmail', e.target.value)}
                    />
                    <select
                      value={row.roleId}
                      aria-label={`Role for ${row.personName || 'stakeholder'}`}
                      onChange={(e) => updateRow(row.id, 'roleId', e.target.value)}
                    >
                      {roles.map((r) => (
                        <option key={r.id} value={r.id}>
                          {r.label}
                        </option>
                      ))}
                    </select>
                    <button
                      type="button"
                      className="icon-btn stakeholder-remove"
                      onClick={() => requestRemove(row.id)}
                      title="Remove"
                      aria-label={`Remove ${row.personName || roleLabel(row.roleId)}`}
                    >
                      <Trash2 size={14} />
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </section>

      {removeTarget && (
        <div className="modal-backdrop" onClick={() => setRemoveTarget(null)}>
          <div
            className="confirm-dialog"
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="remove-stakeholder-title"
            aria-describedby="remove-stakeholder-copy"
            onClick={(event) => event.stopPropagation()}
          >
            <h3 id="remove-stakeholder-title">Remove stakeholder?</h3>
            <p id="remove-stakeholder-copy">
              Remove {removeTarget.label} from this project? You can add them again later.
            </p>
            <div className="confirm-dialog-actions">
              <button type="button" className="secondary-btn" autoFocus onClick={() => setRemoveTarget(null)}>
                Cancel
              </button>
              <button type="button" className="danger-btn" onClick={confirmRemove}>
                Remove
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export function validateProjectStakeholders(state: WizardState): string | null {
  if (!state.projectName.trim()) return 'Project name is required.'
  if (state.projectName.length > PROJECT_NAME_MAX) {
    return `Project name can be at most ${PROJECT_NAME_MAX.toLocaleString()} characters.`
  }
  if (!state.description.trim()) return 'Project description is required.'
  if (state.description.length > PROJECT_DESCRIPTION_MAX) {
    return `Project description can be at most ${PROJECT_DESCRIPTION_MAX.toLocaleString()} characters.`
  }
  if (state.stakeholderAssignments.length === 0) return 'Add at least one stakeholder.'
  const missing = state.stakeholderAssignments.find((a) => !a.personEmail.trim() || !a.personName.trim())
  if (missing) return 'Every stakeholder must have a name and email.'
  return null
}
