export interface StakeholderRoleDef {
  id: string
  label: string
}

export const STAKEHOLDER_ROLES: StakeholderRoleDef[] = [
  { id: 'ba', label: 'Business Analyst' },
  { id: 'po', label: 'Product Owner' },
  { id: 'sa', label: 'Solution Architect' },
  { id: 'tl', label: 'Tech Lead' },
  { id: 'sc', label: 'Security Champion' },
  { id: 'qa', label: 'QA' },
  { id: 'devops', label: 'DevOps' },
]

export interface PersonRecord {
  id: string
  name: string
  email: string
}

/** Sample directory for person search (V1 mock). */
export const SAMPLE_PEOPLE: PersonRecord[] = [
  { id: 'p1', name: 'Atul Sharma', email: 'atul.sharma@example.com' },
  { id: 'p2', name: 'Priya Mehta', email: 'priya.mehta@example.com' },
  { id: 'p3', name: 'James Chen', email: 'james.chen@example.com' },
  { id: 'p4', name: 'Sarah Johnson', email: 'sarah.johnson@example.com' },
  { id: 'p5', name: 'Michael Brown', email: 'michael.brown@example.com' },
  { id: 'p6', name: 'Emily Davis', email: 'emily.davis@example.com' },
]

export function searchPeople(query: string): PersonRecord[] {
  const q = query.trim().toLowerCase()
  if (!q) return SAMPLE_PEOPLE
  return SAMPLE_PEOPLE.filter(
    (p) => p.name.toLowerCase().includes(q) || p.email.toLowerCase().includes(q),
  )
}

export function roleLabel(roleId: string): string {
  return STAKEHOLDER_ROLES.find((r) => r.id === roleId)?.label ?? roleId
}
