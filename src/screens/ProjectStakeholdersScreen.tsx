import { useEffect, useRef, useState } from 'react'
import { Plus, Trash2 } from 'lucide-react'
import { fetchStakeholderRoles } from '../api/blink'
import {
  STAKEHOLDER_ROLES,
  assignmentsFromRoles,
  type StakeholderRoleDef,
} from '../wizard/stakeholders'
import { syncRepositoriesFromArtifact, type WizardState } from '../wizard/types'

interface Props {
  state: WizardState
  onUpdate: (patch: Partial<WizardState>) => void
}

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
  const [catalogHint, setCatalogHint] = useState('Loading stakeholder directory…')
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
        setCatalogHint('Loaded from stakeholders.yaml')
        if (!dirtyRef.current && !catalogLoadedRef.current) {
          onUpdate({
            stakeholderAssignments: assignmentsFromRoles(mapped.length ? mapped : STAKEHOLDER_ROLES),
            stakeholdersCatalogLoaded: true,
          })
        } else if (!catalogLoadedRef.current) {
          onUpdate({ stakeholdersCatalogLoaded: true })
        }
      } catch (error) {
        if (cancelled) return
        setRoles(STAKEHOLDER_ROLES)
        setCatalogHint(
          error instanceof Error
            ? `Using local directory (${error.message})`
            : 'Using local directory (API unreachable)',
        )
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
          personName: fallback.defaultName ?? '',
          personEmail: fallback.defaultEmail ?? '',
        },
      ],
    })
  }

  const removeRow = (id: string) => {
    dirtyRef.current = true
    onUpdate({
      stakeholderAssignments: state.stakeholderAssignments.filter((a) => a.id !== id),
    })
  }

  return (
    <div className="screen">
      <div className="screen-header">
        <h2>Project &amp; Stakeholders</h2>
        <p>Define your project and assign stakeholders to roles.</p>
      </div>

      <section className="card">
        <h3 className="card-title">Project Details</h3>
        <div className="field-grid two-col">
          <div className="field-group">
            <label htmlFor="projectName">Project Name *</label>
            <input
              id="projectName"
              placeholder="e.g. Banking Application"
              value={state.projectName}
              onChange={(e) => updateField('projectName', e.target.value)}
            />
          </div>
          <div className="field-group span-full">
            <label htmlFor="description">Project Description</label>
            <textarea
              id="description"
              rows={3}
              placeholder="Short description of the application or intended work."
              value={state.description}
              onChange={(e) => updateField('description', e.target.value)}
            />
          </div>
        </div>
      </section>

      <section className="card">
        <div className="card-title-row">
          <h3 className="card-title">Stakeholders</h3>
          <button type="button" className="text-btn" onClick={addRow}>
            <Plus size={14} /> Add Stakeholder
          </button>
        </div>
        <p className="field-hint">{catalogHint}</p>
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>Role</th>
                <th>Name</th>
                <th>Email</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {state.stakeholderAssignments.map((row) => (
                <tr key={row.id}>
                  <td>
                    <select value={row.roleId} onChange={(e) => updateRow(row.id, 'roleId', e.target.value)}>
                      {roles.map((r) => (
                        <option key={r.id} value={r.id}>{r.label}</option>
                      ))}
                    </select>
                  </td>
                  <td>
                    <input
                      placeholder="Full name"
                      value={row.personName}
                      onChange={(e) => updateRow(row.id, 'personName', e.target.value)}
                    />
                  </td>
                  <td>
                    <input
                      type="email"
                      placeholder="email@example.com"
                      value={row.personEmail}
                      onChange={(e) => updateRow(row.id, 'personEmail', e.target.value)}
                    />
                  </td>
                  <td>
                    <button type="button" className="icon-btn" onClick={() => removeRow(row.id)} title="Remove">
                      <Trash2 size={14} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  )
}

export function validateProjectStakeholders(state: WizardState): string | null {
  if (!state.projectName.trim()) return 'Project name is required.'
  if (state.stakeholderAssignments.length === 0) return 'Add at least one stakeholder.'
  const missing = state.stakeholderAssignments.find((a) => !a.personEmail.trim() || !a.personName.trim())
  if (missing) return 'Every stakeholder must have a name and email.'
  return null
}
