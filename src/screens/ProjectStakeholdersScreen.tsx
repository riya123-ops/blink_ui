import { Plus, Trash2 } from 'lucide-react'
import { STAKEHOLDER_ROLES } from '../wizard/stakeholders'
import { syncRepositoriesFromArtifact, type WizardState } from '../wizard/types'

interface Props {
  state: WizardState
  onUpdate: (patch: Partial<WizardState>) => void
}

function slugify(value: string) {
  return value.trim().toLowerCase().replace(/\s+/g, '-').replace(/_/g, '-')
}

export function ProjectStakeholdersScreen({ state, onUpdate }: Props) {
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
    onUpdate({
      stakeholderAssignments: state.stakeholderAssignments.map((a) =>
        a.id === id ? { ...a, [field]: value } : a,
      ),
    })
  }

  const addRow = () => {
    onUpdate({
      stakeholderAssignments: [
        ...state.stakeholderAssignments,
        { id: `sa-${Date.now()}`, roleId: 'qa', personName: '', personEmail: '' },
      ],
    })
  }

  const removeRow = (id: string) => {
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
                      {STAKEHOLDER_ROLES.map((r) => (
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
