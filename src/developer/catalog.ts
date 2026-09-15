export const DEVELOPER_CAPABILITY_GROUPS = [
  {
    id: 'wizard',
    label: 'Wizard',
    description: 'Move through the initializer the way engineers do internally.',
  },
  {
    id: 'integrations',
    label: 'Integrations',
    description: 'Connect tools without finishing the guided save-first path.',
  },
  {
    id: 'inspect',
    label: 'Inspect',
    description: 'Surface internals while you debug a session.',
  },
  {
    id: 'aws',
    label: 'AWS workspaces',
    description: 'Manage Blink project folders in the S3 kit bucket.',
  },
  {
    id: 'jira',
    label: 'Jira reset',
    description: 'Remove Blink-created epics and stories from the connected Jira project.',
  },
] as const

export type DeveloperCapabilityGroupId = (typeof DEVELOPER_CAPABILITY_GROUPS)[number]['id']

export const DEVELOPER_CAPABILITIES = {
  unrestrictedStepNav: {
    id: 'unrestrictedStepNav',
    group: 'wizard',
    label: 'Jump to any wizard step',
    description: 'Open any sidebar tab without finishing earlier steps.',
  },
  skipStepValidation: {
    id: 'skipStepValidation',
    group: 'wizard',
    label: 'Skip step validation',
    description: 'Save & Continue even when required fields on the current step are empty.',
  },
  autoEnsureProject: {
    id: 'autoEnsureProject',
    group: 'integrations',
    label: 'Create draft project on connect',
    description:
      'GitHub, Jira, and other connections can be stored without saving Project & Stakeholders first. Blink creates a draft project in the background.',
  },
  showSessionInspector: {
    id: 'showSessionInspector',
    group: 'inspect',
    label: 'Session inspector',
    description: 'Show project id, current step, and grooming state in this developer window.',
  },
  manageS3Workspaces: {
    id: 'manageS3Workspaces',
    group: 'aws',
    label: 'S3 workspace browser',
    description: 'List Blink `*_workspace` folders on AWS and delete one or all.',
  },
  resetJiraEpics: {
    id: 'resetJiraEpics',
    group: 'jira',
    label: 'Reset Blink Jira issues',
    description:
      'List and delete epics/stories Blink created (Source epic:/Source story: markers). Never wipes the whole Jira project.',
  },
} as const

export type DeveloperCapabilityId = keyof typeof DEVELOPER_CAPABILITIES

export interface DeveloperModeState {
  enabled: boolean
  capabilities: Record<DeveloperCapabilityId, boolean>
}

export const DEFAULT_DEVELOPER_MODE: DeveloperModeState = {
  enabled: false,
  capabilities: {
    unrestrictedStepNav: true,
    skipStepValidation: false,
    autoEnsureProject: true,
    showSessionInspector: true,
    manageS3Workspaces: true,
    resetJiraEpics: true,
  },
}

export function hasDeveloperCapability(
  state: DeveloperModeState,
  id: DeveloperCapabilityId,
): boolean {
  return state.enabled && state.capabilities[id] === true
}

export function capabilitiesInGroup(groupId: DeveloperCapabilityGroupId): DeveloperCapabilityId[] {
  return (Object.keys(DEVELOPER_CAPABILITIES) as DeveloperCapabilityId[]).filter(
    (id) => DEVELOPER_CAPABILITIES[id].group === groupId,
  )
}
