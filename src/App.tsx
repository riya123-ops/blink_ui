import { useCallback, useEffect, useRef, useState } from 'react'
import { ChevronLeft, ChevronRight, Download } from 'lucide-react'
import { downloadWorkspace, fetchWorkspaceStatus, fetchGovernanceStatus, saveProject, createRepositories, clarifyRequirement, createJiraComment, pollJiraComments, fetchMyProject, type ProjectPayload } from './api/blink'
import { useAuth } from './auth/AuthContext'
import { publishDeveloperSession, useDeveloperCapability } from './developer'
import { sendStakeholderQuestions } from './api/email'
import { WizardSidebar, STEP_ORDER } from './components/WizardSidebar'
import { ThemeBackground } from './components/ThemeBackground'
import {
  GenerationDownloadScreen,
  IdeAndToolsScreen,
  PlatformDeliveryScreen,
  ProjectPreviewScreen,
  ProjectShapeScreen,
  RepositoriesScreen,
  ReviewResolveScreen,
  TechnologyPerRepoScreen,
} from './screens/ExtendedScreens'
import {
  ProjectStakeholdersScreen,
  validateProjectStakeholders,
} from './screens/ProjectStakeholdersScreen'
import { RequirementsScreen, validateRequirements } from './screens/RequirementsScreen'
import { IntegrationsScreen } from './screens/IntegrationsScreen'
import {
  StakeholderQuestionsScreen,
  jiraCommentForQuestion,
  validateStakeholderQuestions,
} from './screens/StakeholderQuestionsScreen'
import {
  StakeholderResponsesScreen,
  validateStakeholderResponses,
} from './screens/StakeholderResponsesScreen'
import { WelcomeScreen } from './screens/WelcomeScreen'
import {
  assigneeForQuestion,
  carryClarifyQuestionsForward,
  mockResponsesForQuestions,
} from './wizard/questions'
import { roleLabel } from './wizard/stakeholders'
import { stepIndex } from './wizard/steps'
import { buildDownloadStructure, defaultRepositories, NEXT_SDLC_COMMAND } from './wizard/defaults'
import {
  clearGroomingPatch,
  defaultWizardState,
  generationStepDefs,
  type GroomAnswer,
  type WizardState,
  type WizardStep,
} from './wizard/types'
import { assignQuestionBands, groomingComplete, unansweredRequired } from './wizard/grooming'
import { createJiraIssuesFromState, isJiraReady, planScopeFromWording } from './wizard/jiraTickets'
import {
  allowedStep,
  isWizardHistoryState,
  seedWizardHistory,
  stepFromLocation,
  writeStepUrl,
} from './wizard/history'
import {
  draftFromRemote,
  hasWizardProgress,
  initialDraft,
  loadWizardDraft,
  loadSessionStep,
  resumeTarget,
  saveWizardDraft,
  saveSessionStep,
  serializeWizardState,
  stepLabel,
  canOfferResume,
} from './wizard/resume'

function withDraftProjectPayload(payload: ProjectPayload): ProjectPayload {
  const stakeholders = payload.stakeholders.filter((row) => row.name.trim() && row.email.trim())
  return {
    ...payload,
    projectName: payload.projectName.trim() || `Blink Dev ${new Date().toISOString().slice(0, 10)}`,
    description:
      payload.description.trim() ||
      'Developer-mode draft. Update this on Project & Stakeholders when you are ready.',
    stakeholders:
      stakeholders.length > 0
        ? stakeholders
        : defaultWizardState.stakeholderAssignments.map((row) => ({
            roleCode: row.roleId,
            name: row.personName,
            email: row.personEmail,
          })),
  }
}

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = filename
  anchor.click()
  URL.revokeObjectURL(url)
}

function buildEmailPayload(state: WizardState, questionIds: string[]) {
  return state.questions
    .filter((q) => questionIds.includes(q.id))
    .map((q) => {
      const assignee = assigneeForQuestion(state, q.assignedRoleId)
      return {
        question_id: q.id,
        question: q.question,
        recipient_email: assignee.email,
        recipient_name: assignee.name,
        role: roleLabel(q.assignedRoleId),
        project_name: state.projectName,
        proposed_answer: q.proposedAnswer || undefined,
      }
    })
    .filter((row) => Boolean(row.recipient_email.trim()))
}

export default function App() {
  const { session } = useAuth()
  const boot = initialDraft(session?.email ?? null)
  const sessionStep = loadSessionStep()
  const bootStep = sessionStep
    ? allowedStep(
        sessionStep,
        sessionStep,
        boot.completedThrough,
        groomingComplete(boot.state),
        false,
      )
    : 'welcome'
  const [state, setState] = useState<WizardState>(boot.state)
  const [step, setStep] = useState<WizardStep>(bootStep)
  const [completedThrough, setCompletedThrough] = useState(boot.completedThrough)
  const [status, setStatus] = useState<{ type: 'error' | 'success' | 'info'; message: string } | null>(null)
  const [loading, setLoading] = useState(false)
  const [grooming, setGrooming] = useState(false)
  const [saving, setSaving] = useState(false)
  const [sending, setSending] = useState(false)
  const [postingJira, setPostingJira] = useState(false)
  const [refreshingJira, setRefreshingJira] = useState(false)
  const [creatingRepos, setCreatingRepos] = useState(false)
  const [folderPrep, setFolderPrep] = useState<'idle' | 'preparing' | 'ready' | 'failed'>('idle')
  const [folderProgress, setFolderProgress] = useState({ percent: 0, copied: 0, total: 0 })
  const [folderQuery, setFolderQuery] = useState<{ name: string; id?: string } | null>(null)
  const [governancePrep, setGovernancePrep] = useState<'idle' | 'preparing' | 'ready' | 'failed'>('idle')
  const lastSavedPayloadRef = useRef<string | null>(null)
  const stepRef = useRef(step)
  const completedRef = useRef(completedThrough)
  const skipRemoteResumeRef = useRef(false)
  const freshStartRef = useRef(Boolean(boot.freshStart))
  stepRef.current = step
  completedRef.current = completedThrough
  const skipStepValidation = useDeveloperCapability('skipStepValidation')
  const autoEnsureProject = useDeveloperCapability('autoEnsureProject')
  const unrestrictedNav = useDeveloperCapability('unrestrictedStepNav')

  const patch = useCallback((updates: Partial<WizardState>) => {
    setState((prev) => ({ ...prev, ...updates }))
  }, [])

  const validateCurrentStep = useCallback((): string | null => {
    switch (step) {
      case 'welcome':
        return null
      case 'project-stakeholders':
        return validateProjectStakeholders(state)
      case 'requirements':
        return validateRequirements(state)
      case 'stakeholder-questions':
        return validateStakeholderQuestions(state)
      case 'stakeholder-responses':
        return validateStakeholderResponses(state)
      default:
        return null
    }
  }, [step, state])

  const projectPayload = useCallback((): ProjectPayload => ({
    projectType: state.projectType,
    projectName: state.projectName,
    description: state.description,
    stakeholders: state.stakeholderAssignments.map((row) => ({
      roleCode: row.roleId,
      name: row.personName,
      email: row.personEmail,
    })),
  }), [state.projectType, state.projectName, state.description, state.stakeholderAssignments])

  const persistProject = useCallback(async (opts?: { draft?: boolean }): Promise<{
    id: string
    workspaceStatus?: 'preparing' | 'ready' | 'failed' | null
    sodWarnings?: string[]
    nextCommand?: string
    governanceStatus?: 'idle' | 'preparing' | 'ready' | 'failed' | null
  }> => {
    const payload = opts?.draft ? withDraftProjectPayload(projectPayload()) : projectPayload()
    const payloadStr = JSON.stringify(payload)
    const withWizard: ProjectPayload = {
      ...payload,
      wizardStep: stepRef.current,
      wizardCompletedThrough: completedRef.current,
      wizardState: serializeWizardState(state),
    }
    if (state.projectId && lastSavedPayloadRef.current === payloadStr) {
      try {
        await saveProject(withWizard, state.projectId)
      } catch {
        // Local draft is still stored; server can catch up on the next save.
      }
      return {
        id: state.projectId,
        workspaceStatus: folderPrep === 'idle' ? null : folderPrep,
        sodWarnings: state.sodWarnings,
        nextCommand: state.nextSdlcCommand || undefined,
        governanceStatus: governancePrep === 'idle' ? state.governanceStatus : governancePrep,
      }
    }
    const saved = await saveProject(withWizard, state.projectId)
    lastSavedPayloadRef.current = payloadStr
    const id = String(saved.id)
    const governanceStatus = saved.governanceStatus || (saved.sodWarnings?.length ? 'ready' : 'idle')
    patch({
      projectId: id,
      projectName: payload.projectName,
      description: payload.description,
      sodWarnings: saved.sodWarnings || [],
      nextSdlcCommand: saved.nextCommand || state.nextSdlcCommand,
      governanceStatus,
    })
    setFolderQuery({ name: saved.projectName || payload.projectName, id })
    if (saved.workspaceStatus === 'preparing' || saved.workspaceStatus === 'ready' || saved.workspaceStatus === 'failed') {
      setFolderPrep(saved.workspaceStatus)
    }
    if (governanceStatus === 'preparing' || governanceStatus === 'ready' || governanceStatus === 'failed') {
      setGovernancePrep(governanceStatus)
    }
    return {
      id,
      workspaceStatus: saved.workspaceStatus,
      sodWarnings: saved.sodWarnings,
      nextCommand: saved.nextCommand,
      governanceStatus,
    }
  }, [projectPayload, state, folderPrep, governancePrep, patch])

  const ensureDraftProject = useCallback(async (): Promise<{ id: string; created: boolean }> => {
    if (state.projectId) {
      return { id: state.projectId, created: false }
    }
    const saved = await persistProject({ draft: true })
    return { id: saved.id, created: true }
  }, [state.projectId, persistProject])

  const goToStep = useCallback((next: WizardStep, historyMode: 'push' | 'replace' | 'silent' = 'push') => {
    if (next === stepRef.current && historyMode === 'push') {
      return
    }
    setStep(next)
    if (historyMode === 'silent') {
      return
    }
    writeStepUrl(next, historyMode)
  }, [])

  const startFresh = useCallback((type: 'new' | 'existing') => {
    skipRemoteResumeRef.current = true
    freshStartRef.current = true
    lastSavedPayloadRef.current = null
    setFolderPrep('idle')
    setGovernancePrep('idle')
    setFolderQuery(null)
    setStatus(null)
    const fresh: WizardState = {
      ...defaultWizardState,
      projectType: type,
      existingSourceMode: 'none',
    }
    setState(fresh)
    setCompletedThrough(0)
    if (session?.email) {
      saveWizardDraft(session.email, {
        step: 'project-stakeholders',
        completedThrough: 0,
        state: fresh,
        updatedAt: Date.now(),
        freshStart: true,
      })
    }
    goToStep('project-stakeholders')
    seedWizardHistory('project-stakeholders', true)
  }, [goToStep, session?.email])

  useEffect(() => {
    seedWizardHistory(stepRef.current)
  }, [])

  useEffect(() => {
    const onPop = (event: PopStateEvent) => {
      if (isWizardHistoryState(event.state)) {
        setStep(event.state.step)
        return
      }
      const fromUrl = stepFromLocation()
      if (fromUrl) {
        setStep(fromUrl)
        return
      }
      const idx = stepIndex(stepRef.current)
      if (idx > 0) {
        const prev = STEP_ORDER[idx - 1]
        setStep(prev)
        writeStepUrl(prev, 'push')
      }
    }
    window.addEventListener('popstate', onPop)
    return () => window.removeEventListener('popstate', onPop)
  }, [])

  useEffect(() => {
    if (state.projectId) {
      freshStartRef.current = false
    }
  }, [state.projectId])

  useEffect(() => {
    if (!session?.email) return
    saveWizardDraft(session.email, {
      step,
      completedThrough,
      state,
      updatedAt: Date.now(),
      freshStart: freshStartRef.current && !state.projectId,
    })
    saveSessionStep(step)
  }, [session?.email, step, completedThrough, state])

  useEffect(() => {
    if (!session?.email || !state.projectId) return
    const timer = window.setTimeout(() => {
      const payload = withDraftProjectPayload(projectPayload())
      void saveProject({
        ...payload,
        wizardStep: step,
        wizardCompletedThrough: completedThrough,
        wizardState: serializeWizardState(state),
      }, state.projectId).catch(() => undefined)
    }, 900)
    return () => window.clearTimeout(timer)
  }, [session?.email, state, step, completedThrough, projectPayload])

  useEffect(() => {
    if (!session?.email || skipRemoteResumeRef.current) return
    const localNow = loadWizardDraft(session.email)
    if (localNow?.freshStart) return
    let cancelled = false
    const email = session.email
    void fetchMyProject()
      .then((remote) => {
        if (cancelled || !remote) return
        if (freshStartRef.current || loadWizardDraft(email)?.freshStart) return
        const local = initialDraft(email)
        const remoteDraft = draftFromRemote(email, remote)
        if (local.updatedAt >= remoteDraft.updatedAt && hasWizardProgress(local)) return
        if (!hasWizardProgress(remoteDraft)) return
        skipRemoteResumeRef.current = true
        setState(remoteDraft.state)
        setCompletedThrough(remoteDraft.completedThrough)
        const active = loadSessionStep()
        if (!active || active === 'welcome') {
          goToStep('welcome', 'replace')
          seedWizardHistory('welcome', true)
          return
        }
        const nextStep = allowedStep(
          active,
          remoteDraft.step,
          remoteDraft.completedThrough,
          groomingComplete(remoteDraft.state),
          false,
        )
        goToStep(nextStep, 'replace')
        seedWizardHistory(nextStep, true)
      })
      .catch(() => undefined)
    return () => {
      cancelled = true
    }
  }, [session?.email, goToStep])

  useEffect(() => {
    publishDeveloperSession({
      step,
      projectId: state.projectId,
      groomingUnlocked: groomingComplete(state),
    })
  }, [step, state])

  useEffect(() => {
    if (folderPrep !== 'preparing' || !folderQuery?.name.trim()) return
    let cancelled = false
    const check = async () => {
      try {
        const progress = await fetchWorkspaceStatus(folderQuery.name, folderQuery.id)
        if (cancelled) return
        setFolderProgress({
          percent: progress.percent ?? 0,
          copied: progress.filesCopied ?? 0,
          total: progress.filesTotal ?? 0,
        })
        if (progress.status === 'ready') {
          setFolderProgress((prev) => ({ ...prev, percent: 100 }))
          setFolderPrep('ready')
          return
        }
        if (progress.status === 'failed') setFolderPrep('failed')
      } catch {
        /* keep the note until a later poll succeeds */
      }
    }
    void check()
    const timer = window.setInterval(() => void check(), 1000)
    return () => {
      cancelled = true
      window.clearInterval(timer)
    }
  }, [folderQuery, folderPrep])

  useEffect(() => {
    if (folderPrep !== 'ready') return
    const timer = window.setTimeout(() => setFolderPrep('idle'), 5000)
    return () => window.clearTimeout(timer)
  }, [folderPrep])

  useEffect(() => {
    if (governancePrep !== 'preparing' || !state.projectId) return
    let cancelled = false
    const check = async () => {
      try {
        const progress = await fetchGovernanceStatus(state.projectId as string)
        if (cancelled) return
        const status = progress.status || 'idle'
        if (status === 'preparing') return
        if (status === 'ready') {
          const warnings = progress.sodWarnings || []
          patch({
            sodWarnings: warnings,
            nextSdlcCommand: progress.nextCommand || state.nextSdlcCommand,
            governanceStatus: 'ready',
          })
          setGovernancePrep('ready')
          if (warnings.length > 0) {
            setStatus({
              type: 'info',
              message: `Stakeholder governance note: ${warnings[0]}`,
            })
          } else {
            setStatus({ type: 'success', message: progress.message || 'Stakeholder roles are configured.' })
          }
          return
        }
        if (status === 'failed') {
          patch({ governanceStatus: 'failed' })
          setGovernancePrep('failed')
          setStatus({
            type: 'info',
            message: progress.message || 'Could not finish stakeholder checks. You can keep going.',
          })
        }
      } catch {
        /* keep the preparing note until a later poll succeeds */
      }
    }
    void check()
    const timer = window.setInterval(() => void check(), 1000)
    return () => {
      cancelled = true
      window.clearInterval(timer)
    }
  }, [governancePrep, state.projectId, state.nextSdlcCommand, patch])

  useEffect(() => {
    if (governancePrep !== 'ready' && governancePrep !== 'failed') return
    const timer = window.setTimeout(() => setGovernancePrep('idle'), 8000)
    return () => window.clearTimeout(timer)
  }, [governancePrep])

  const handleCreateGithubRepos = useCallback(async (): Promise<boolean> => {
    const github = state.integrations.find((item) => item.id === 'github')
    if (!github?.connected || !state.projectId) {
      setStatus({ type: 'error', message: 'Connect GitHub on the Integrations screen first.' })
      return false
    }
    const pending = state.repositories.filter(
      (repo) => repo.name.trim() && repo.createStatus !== 'created' && repo.createStatus !== 'exists',
    )
    if (!pending.length) {
      if (!state.repositories.some((repo) => repo.name.trim())) {
        setStatus({ type: 'error', message: 'Add at least one repository name.' })
        return false
      }
      return true
    }
    setCreatingRepos(true)
    setStatus(null)
    try {
      const result = await createRepositories({
        provider: 'github',
        projectId: state.projectId,
        organization: github.organization,
        repositories: pending.map((repo) => ({ name: repo.name.trim(), description: repo.description })),
      })
      patch({
        repositories: state.repositories.map((repo) => {
          const created = result.repositories.find((item) => item.name === repo.name.trim())
          if (!created) return repo
          return {
            ...repo,
            htmlUrl: created.htmlUrl ?? repo.htmlUrl,
            createStatus: created.status as 'created' | 'exists' | 'failed',
            createMessage: created.message,
          }
        }),
      })
      const created = result.repositories.filter((item) => item.status === 'created').length
      const exists = result.repositories.filter((item) => item.status === 'exists').length
      const failed = result.repositories.filter((item) => item.status === 'failed').length
      if (failed && !created && !exists) {
        setStatus({ type: 'error', message: result.repositories.map((item) => item.message).join(' ') })
        return false
      }
      setStatus({
        type: failed ? 'info' : 'success',
        message: `GitHub: ${created} created, ${exists} already existed, ${failed} failed.`,
      })
      return failed === 0
    } catch (e) {
      setStatus({ type: 'error', message: e instanceof Error ? e.message : 'Could not create GitHub repositories.' })
      return false
    } finally {
      setCreatingRepos(false)
    }
  }, [state.integrations, state.repositories, state.projectId, patch])

  const goNext = useCallback(async () => {
    const err = skipStepValidation ? null : validateCurrentStep()
    if (err) {
      setStatus({ type: 'error', message: err })
      return
    }
    if (step === 'project-stakeholders') {
      const payload = projectPayload()
      const payloadStr = JSON.stringify(payload)
      const alreadyPersisted = Boolean(state.projectId && lastSavedPayloadRef.current === payloadStr)

      if (!alreadyPersisted) {
        setSaving(true)
        setStatus(null)
      }
      try {
        const saved = await persistProject({
          draft: skipStepValidation && (!state.projectName.trim() || !state.description.trim()),
        })
        if (saved.sodWarnings && saved.sodWarnings.length > 0) {
          setStatus({
            type: 'info',
            message: `Project & stakeholders configured with governance note: ${saved.sodWarnings[0]}`,
          })
        } else if (!alreadyPersisted) {
          const folderBusy = saved.workspaceStatus === 'preparing'
          const governanceBusy = saved.governanceStatus === 'preparing'
          setStatus({
            type: folderBusy || governanceBusy ? 'info' : 'success',
            message: governanceBusy && folderBusy
              ? 'Saved. Preparing your project folder and checking stakeholder roles — you can keep going.'
              : governanceBusy
                ? 'Saved. Checking stakeholder roles — you can keep going.'
                : folderBusy
                  ? 'Saved. We are preparing your project folder — you can keep going.'
                  : 'Project & stakeholders configured successfully.',
          })
        }
      } catch (e) {
        setStatus({ type: 'error', message: e instanceof Error ? e.message : 'Could not save project.' })
        return
      } finally {
        if (!alreadyPersisted) {
          setSaving(false)
        }
      }
    } else if (step === 'repositories') {
      if (!skipStepValidation && !state.repositories.some((repo) => repo.name.trim())) {
        setStatus({ type: 'error', message: 'Keep at least one repository, or add one.' })
        return
      }
      const github = state.integrations.find((item) => item.id === 'github')
      if (github?.connected && state.projectId) {
        const created = await handleCreateGithubRepos()
        if (!created) return
      } else {
        setStatus(null)
      }
    } else if (step === 'requirements') {
      setStatus(null)
      const wording = (state.groomDraft || state.requirementsText).trim() || state.requirementsText
      const nextState = { ...state, requirementsText: wording }
      const questions = carryClarifyQuestionsForward(nextState)
      const baseReqPatch = {
        requirementsText: wording,
        questions,
        requirementsAnalyzed: true,
        responses: questions.map((q) => ({
          questionId: q.id,
          status: 'pending' as const,
          response: q.proposedAnswer || '',
          receivedAt: null,
        })),
        questionsSent: false,
      }
      const alreadyPlanned = Boolean(state.productScope?.epics?.length)
      if (!alreadyPlanned && wording.trim()) {
        setSaving(true)
        try {
          const scopePatch = await planScopeFromWording(state, wording)
          const planned = { ...state, ...baseReqPatch, ...scopePatch }
          let createdPatch: Partial<WizardState> = {}
          if (isJiraReady(planned) && !(state.jiraCreatedIssues || []).some((item) => item.status === 'created')) {
            try {
              const result = await createJiraIssuesFromState(planned)
              createdPatch = { jiraCreatedIssues: result.issues }
            } catch (err) {
              console.warn('Jira create after requirements:', err)
            }
          }
          patch({ ...baseReqPatch, ...scopePatch, ...createdPatch })
        } catch (err) {
          console.warn('Product scope planning note:', err)
          patch(baseReqPatch)
        } finally {
          setSaving(false)
        }
      } else {
        patch(baseReqPatch)
      }
    } else {
      setStatus(null)
    }
    const idx = stepIndex(step)
    setCompletedThrough((prev) => Math.max(prev, idx))
    const nextStep = STEP_ORDER[idx + 1]
    if (nextStep) goToStep(nextStep)
  }, [step, validateCurrentStep, persistProject, state, handleCreateGithubRepos, patch, skipStepValidation, goToStep])

  const goBack = useCallback(() => {
    setStatus(null)
    if (isWizardHistoryState(window.history.state) && stepIndex(step) > 0) {
      window.history.back()
      return
    }
    const idx = stepIndex(step)
    if (idx > 0) goToStep(STEP_ORDER[idx - 1])
  }, [step, goToStep])

  const handleGroomAsk = useCallback(async () => {
    if (state.groomQuestions.length) return
    const text = (state.groomOriginal || state.requirementsText).trim()
    if (!text) {
      setStatus({ type: 'error', message: 'Paste a short description first.' })
      return
    }
    setGrooming(true)
    setStatus(null)
    try {
      const result = await clarifyRequirement({
        projectId: state.projectId,
        projectName: state.projectName,
        requirementText: text,
      })
      if (result.status === 'error' || result.status === 'invalid_request') {
        patch({
          groomStatus: result.status,
          groomMessage: result.message,
          groomDraft: result.requirementDraft || text,
          groomOriginal: state.groomOriginal || result.originalRequirement || text,
        })
        setStatus({ type: 'error', message: result.message })
        return
      }
      patch({
        groomStatus: result.status,
        groomMessage: result.message,
        groomQuestions: assignQuestionBands(result.questions ?? []),
        groomDraft: result.requirementDraft || '',
        groomOriginal: state.groomOriginal || result.originalRequirement || text,
        groomAnswers: [],
        groomConfirmed: false,
      })
      setStatus({
        type: 'info',
        message:
          result.status === 'draft_ready'
            ? 'This is already clear enough. Use this wording, or Start over to change the paste.'
            : 'Answer the required questions. Important and suggestions are optional.',
      })
    } catch (e) {
      patch({
        groomStatus: 'error',
        groomMessage: e instanceof Error ? e.message : 'Could not reach the grooming helper.',
      })
      setStatus({ type: 'error', message: e instanceof Error ? e.message : 'Could not reach the grooming helper.' })
    } finally {
      setGrooming(false)
    }
  }, [state.groomQuestions.length, state.groomOriginal, state.requirementsText, state.projectId, state.projectName, patch])

  const handleGroomPick = useCallback((questionId: string, optionId: string, optionLabel: string) => {
    setState((prev) => {
      const q = prev.groomQuestions.find((item) => item.id === questionId)
      const isMultiple = Boolean(q?.allowMultiple)
      const isSame = (item: GroomAnswer) => item.questionId === questionId && item.optionId === optionId
      const exists = prev.groomAnswers.some(isSame)

      let nextAnswers: GroomAnswer[]
      if (isMultiple) {
        if (exists) {
          nextAnswers = prev.groomAnswers.filter((item) => !isSame(item))
        } else {
          nextAnswers = [...prev.groomAnswers, { questionId, optionId, optionLabel }]
        }
      } else {
        const withoutQuestion = prev.groomAnswers.filter((item) => item.questionId !== questionId)
        nextAnswers = exists ? withoutQuestion : [...withoutQuestion, { questionId, optionId, optionLabel }]
      }
      return { ...prev, groomAnswers: nextAnswers, groomConfirmed: false }
    })
  }, [])

  const handleGroomToggleOther = useCallback((questionId: string, checked: boolean) => {
    setState((prev) => {
      const q = prev.groomQuestions.find((item) => item.id === questionId)
      const isMultiple = Boolean(q?.allowMultiple)

      if (!checked) {
        const kept = prev.groomAnswers.filter(
          (item) => !(item.questionId === questionId && item.optionId === 'other'),
        )
        return { ...prev, groomAnswers: kept, groomConfirmed: false }
      }

      const existingOther = prev.groomAnswers.find(
        (item) => item.questionId === questionId && item.optionId === 'other',
      )
      const otherItem: GroomAnswer = {
        questionId,
        optionId: 'other',
        optionLabel: 'Other',
        otherText: existingOther?.otherText ?? '',
      }

      if (isMultiple) {
        const kept = prev.groomAnswers.filter(
          (item) => !(item.questionId === questionId && item.optionId === 'other'),
        )
        return { ...prev, groomAnswers: [...kept, otherItem], groomConfirmed: false }
      } else {
        const kept = prev.groomAnswers.filter((item) => item.questionId !== questionId)
        return { ...prev, groomAnswers: [...kept, otherItem], groomConfirmed: false }
      }
    })
  }, [])

  const handleGroomOther = useCallback((questionId: string, text: string) => {
    setState((prev) => {
      const rest = prev.groomAnswers.filter((item) => !(item.questionId === questionId && item.optionId === 'other'))
      const next: GroomAnswer = { questionId, optionId: 'other', optionLabel: 'Other', otherText: text }
      return { ...prev, groomAnswers: [...rest, next], groomConfirmed: false }
    })
  }, [])

  const handleGroomLooksGood = useCallback(async () => {
    if (state.groomConfirmed) return
    if (unansweredRequired(state).length && state.groomStatus !== 'error') {
      setStatus({ type: 'error', message: 'Answer every required question under Need clarification.' })
      return
    }
    const original = (state.groomOriginal || state.requirementsText).trim()
    const answers = state.groomAnswers.filter(
      (item) => item.optionId !== 'other' || Boolean(item.otherText?.trim()),
    )
    let draft = (state.groomDraft || state.requirementsText).trim()
    if (answers.length && state.groomStatus !== 'error') {
      setGrooming(true)
      setStatus(null)
      try {
        const result = await clarifyRequirement({
          projectId: state.projectId,
          projectName: state.projectName,
          requirementText: original || draft,
          answers,
        })
        if (result.status === 'error' || result.status === 'invalid_request') {
          setStatus({ type: 'error', message: result.message })
          patch({ groomStatus: result.status, groomMessage: result.message })
          return
        }
        draft = (result.requirementDraft || draft).trim()
      } catch (e) {
        setStatus({ type: 'error', message: e instanceof Error ? e.message : 'Could not update the wording.' })
        return
      } finally {
        setGrooming(false)
      }
    }
    if (!draft) return
    const nextState = { ...state, requirementsText: draft, groomConfirmed: true, groomDraft: draft }
    const questions = carryClarifyQuestionsForward(nextState)
    const basePatch: Partial<WizardState> = {
      requirementsText: draft,
      groomDraft: draft,
      groomConfirmed: true,
      groomStatus: 'draft_ready',
      questions,
      requirementsAnalyzed: true,
      responses: questions.map((q) => ({
        questionId: q.id,
        status: 'pending' as const,
        response: q.proposedAnswer || '',
        receivedAt: null,
      })),
      questionsSent: false,
    }
    setSaving(true)
    setStatus({ type: 'info', message: 'Planning epics and stories from the cleared wording…' })
    try {
      const scopePatch = await planScopeFromWording({ ...state, ...basePatch }, draft)
      const planned = { ...state, ...basePatch, ...scopePatch }
      let createdPatch: Partial<WizardState> = {}
      let extra = ''
      if (isJiraReady(planned) && !(state.jiraCreatedIssues || []).some((item) => item.status === 'created')) {
        setStatus({ type: 'info', message: 'Creating Jira tickets…' })
        try {
          const result = await createJiraIssuesFromState(planned)
          createdPatch = { jiraCreatedIssues: result.issues }
          const createdCount = (result.issues || []).filter((item) => item.status === 'created').length
          extra =
            result.status === 'error'
              ? ` Jira create failed: ${result.message}`
              : ` Created ${createdCount} Jira item${createdCount === 1 ? '' : 's'}.`
        } catch (err) {
          extra = ` Jira create failed: ${err instanceof Error ? err.message : 'Could not create Jira issues.'}`
        }
      } else if (!isJiraReady(planned)) {
        extra = ' Connect Atlassian on Integrations to create these tickets.'
      }
      patch({ ...basePatch, ...scopePatch, ...createdPatch })
      setStatus({
        type: extra.includes('failed') ? 'error' : 'success',
        message: `Requirement wording saved.${extra}`,
      })
    } catch (e) {
      patch(basePatch)
      setStatus({
        type: 'error',
        message: e instanceof Error ? e.message : 'Could not plan Jira tickets from the cleared wording.',
      })
    } finally {
      setSaving(false)
    }
  }, [state, patch])

  const handleGroomStartOver = useCallback(() => {
    patch(clearGroomingPatch())
    setStatus(null)
  }, [patch])

  const applySendResults = useCallback(
    (results: { question_id: string; status: string; message: string }[], deliveryMode: string, outboxDir: string | null) => {
      const now = new Date().toISOString()
      setState((prev) => {
        const questions = prev.questions.map((q) => {
          const result = results.find((r) => r.question_id === q.id)
          if (!result) return q
          return {
            ...q,
            sent: result.status === 'sent',
            deliveryStatus: result.status === 'sent' ? ('sent' as const) : ('failed' as const),
            sentAt: result.status === 'sent' ? now : q.sentAt,
            deliveryMessage: result.message,
          }
        })
        const responses = questions.map((q) => {
          const existing = prev.responses.find((r) => r.questionId === q.id)
          return existing ?? { questionId: q.id, status: 'pending' as const, response: '', receivedAt: null }
        })
        const allSent = questions.every((q) => q.sent)
        return { ...prev, questions, responses, questionsSent: allSent }
      })

      const failed = results.filter((r) => r.status === 'failed')
      if (failed.length) {
        setStatus({ type: 'error', message: failed.map((f) => f.message).join(' ') })
      } else if (deliveryMode === 'outbox') {
        setStatus({
          type: 'success',
          message: `Emails saved to outbox folder${outboxDir ? `: ${outboxDir}` : ''}. Configure BLINK_SMTP_* env vars for live SMTP.`,
        })
      } else {
        setStatus({ type: 'success', message: 'Emails sent successfully via SMTP.' })
      }
    },
    [],
  )

  const handleSendOne = useCallback(
    async (questionId: string) => {
      setSending(true)
      setStatus(null)
      try {
        const payload = buildEmailPayload(state, [questionId])
        if (!payload.length) {
          setStatus({ type: 'error', message: 'Assign name and email on Project & Stakeholders before emailing.' })
          return
        }
        const res = await sendStakeholderQuestions(payload)
        applySendResults(res.results, res.delivery_mode, res.outbox_dir)
      } catch (e) {
        setStatus({ type: 'error', message: e instanceof Error ? e.message : 'Failed to send email.' })
      } finally {
        setSending(false)
      }
    },
    [state, applySendResults],
  )

  const handleSendAll = useCallback(async () => {
    const unsent = state.questions
      .filter((q) => !q.sent && assigneeForQuestion(state, q.assignedRoleId).assigned)
      .map((q) => q.id)
    if (!unsent.length) {
      setStatus({ type: 'error', message: 'No questions with assigned recipients to email.' })
      return
    }
    setSending(true)
    setStatus(null)
    try {
      const payload = buildEmailPayload(state, unsent)
      if (!payload.length) {
        setStatus({ type: 'error', message: 'Assign name and email on Project & Stakeholders before emailing.' })
        return
      }
      const res = await sendStakeholderQuestions(payload)
      applySendResults(res.results, res.delivery_mode, res.outbox_dir)
    } catch (e) {
      setStatus({ type: 'error', message: e instanceof Error ? e.message : 'Failed to send emails.' })
    } finally {
      setSending(false)
    }
  }, [state, applySendResults])

  const applyJiraPollReplies = useCallback(
    (replies: { blinkQuestionId: string; body: string; created?: string | null }[]) => {
      if (!replies.length) return
      const now = new Date().toISOString()
      setState((prev) => {
        const questionIds = new Set(replies.map((r) => r.blinkQuestionId))
        const questions = prev.questions.map((q) =>
          questionIds.has(q.id)
            ? { ...q, jiraCommentStatus: 'replied' as const, jiraCommentMessage: 'Reply received from Jira' }
            : q,
        )
        const responses = prev.questions.map((q) => {
          const reply = replies.find((r) => r.blinkQuestionId === q.id)
          const existing = prev.responses.find((r) => r.questionId === q.id)
          if (!reply) {
            return existing ?? { questionId: q.id, status: 'pending' as const, response: q.proposedAnswer || '', receivedAt: null }
          }
          return {
            questionId: q.id,
            status: 'answered' as const,
            response: reply.body,
            receivedAt: reply.created || now,
          }
        })
        return { ...prev, questions, responses }
      })
    },
    [],
  )

  const handleRefreshJira = useCallback(async () => {
    const items = state.questions
      .filter((q) => q.jiraIssueKey && (q.jiraCommentStatus === 'posted' || q.jiraCommentStatus === 'replied'))
      .map((q) => ({ issueKey: q.jiraIssueKey!, blinkQuestionId: q.id }))
    if (!items.length || !state.projectId) {
      setStatus({ type: 'info', message: 'No posted Jira comments to refresh yet.' })
      return
    }
    setRefreshingJira(true)
    setStatus(null)
    try {
      const res = await pollJiraComments({ projectId: state.projectId, items })
      applyJiraPollReplies(res.replies || [])
      setStatus({
        type: 'success',
        message: res.replies?.length
          ? `Loaded ${res.replies.length} Jira reply(ies).`
          : res.message || 'No new Jira replies.',
      })
    } catch (e) {
      setStatus({ type: 'error', message: e instanceof Error ? e.message : 'Failed to poll Jira comments.' })
    } finally {
      setRefreshingJira(false)
    }
  }, [state.questions, state.projectId, applyJiraPollReplies])

  const handlePostJiraOne = useCallback(
    async (questionId: string) => {
      const question = state.questions.find((q) => q.id === questionId)
      if (!question?.jiraIssueKey || !state.projectId) {
        setStatus({ type: 'error', message: 'Pick a Jira ticket before posting.' })
        return
      }
      if (!assigneeForQuestion(state, question.assignedRoleId).assigned) {
        setStatus({ type: 'error', message: 'Assign a person with email before posting to Jira.' })
        return
      }
      setPostingJira(true)
      setStatus(null)
      try {
        const body = jiraCommentForQuestion(state, question)
        const res = await createJiraComment({
          projectId: state.projectId,
          issueKey: question.jiraIssueKey,
          body,
          blinkQuestionId: question.id,
        })
        setState((prev) => ({
          ...prev,
          questions: prev.questions.map((q) =>
            q.id === questionId
              ? {
                  ...q,
                  jiraCommentId: res.commentId || null,
                  jiraCommentStatus: 'posted' as const,
                  jiraCommentMessage: res.message,
                }
              : q,
          ),
        }))
        setStatus({ type: 'success', message: res.message || `Posted to ${question.jiraIssueKey}.` })
      } catch (e) {
        setState((prev) => ({
          ...prev,
          questions: prev.questions.map((q) =>
            q.id === questionId
              ? {
                  ...q,
                  jiraCommentStatus: 'failed' as const,
                  jiraCommentMessage: e instanceof Error ? e.message : 'Post failed',
                }
              : q,
          ),
        }))
        setStatus({ type: 'error', message: e instanceof Error ? e.message : 'Failed to post Jira comment.' })
      } finally {
        setPostingJira(false)
      }
    },
    [state],
  )

  const handlePostJiraAll = useCallback(async () => {
    const ids = state.questions
      .filter(
        (q) =>
          q.jiraIssueKey &&
          assigneeForQuestion(state, q.assignedRoleId).assigned &&
          q.jiraCommentStatus !== 'posted' &&
          q.jiraCommentStatus !== 'replied',
      )
      .map((q) => q.id)
    for (const id of ids) {
      await handlePostJiraOne(id)
    }
  }, [state, handlePostJiraOne])

  const handleSimulateResponses = useCallback(() => {
    const answers = mockResponsesForQuestions(state.questions)
    const now = new Date().toISOString()
    patch({
      responses: state.questions.map((q) => ({
        questionId: q.id,
        status: 'answered' as const,
        response: answers[q.id] ?? 'Confirmed.',
        receivedAt: now,
      })),
    })
    setStatus({ type: 'success', message: 'Stakeholder responses recorded.' })
  }, [state.questions, patch])

  const runGeneration = useCallback(async () => {
    setLoading(true)
    setStatus(null)
    const start = Date.now()
    const steps = generationStepDefs(state.ideTool).map((s) => ({ ...s, status: 'pending' as const }))
    const fromIdx = stepIndex(step)
    setCompletedThrough((prev) => Math.max(prev, fromIdx))
    patch({ generationSteps: steps, generationComplete: false })
    goToStep('generation')

    const advanceStep = (id: string, st: 'running' | 'done' | 'error') => {
      setState((prev) => ({
        ...prev,
        generationSteps: prev.generationSteps.map((s) => (s.id === id ? { ...s, status: st } : s)),
      }))
    }

    try {
      for (const def of generationStepDefs(state.ideTool).slice(0, -1)) {
        advanceStep(def.id, 'running')
        await new Promise((r) => setTimeout(r, 350))
        advanceStep(def.id, 'done')
      }

      advanceStep('package', 'running')
      let projectId = state.projectId
      if (!projectId) {
        projectId = (await persistProject()).id
      }
      const repositories = (
        state.repositoriesTouched ? state.repositories : defaultRepositories(state.projectName)
      ).map((repo) => ({
        name: repo.name,
        purpose: repo.purpose,
        description: repo.description,
      }))
      const setupRequirement =
        state.groomConfirmed && state.groomDraft.trim() ? state.groomDraft.trim() : state.requirementsText
      const connected = state.integrations.filter((item) => item.connected)
      const jira = connected.find((item) => item.id === 'jira')
      const confluence = connected.find((item) => item.id === 'confluence')
      const {
        blob,
        filename,
        structure,
        fileCount,
        nextCommand,
        setupStatus,
        setupValidated,
        identitySource,
        overlayCount,
        contextReady,
        deliveryReady,
        folderStatus,
      } =
        await downloadWorkspace({
        projectId,
        file: state.requirementFile,
        requirementsText: setupRequirement,
        repositories,
        setupContext: {
          projectId,
          projectName: state.projectName,
          projectType: state.projectType,
          requirementConfirmed: state.groomConfirmed,
          stakeholderAssignments: state.stakeholderAssignments.map(({ roleId, personName, personEmail }) => ({
            roleId,
            personName,
            personEmail,
          })),
          topology: state.topology,
          repositoryModel: state.repositoryModel,
          architectureStyle: state.architectureStyle,
          repositories,
          integrations: state.integrations
            .filter((integration) => integration.connected)
            .map(({ id, account, baseUrl, organization, workspace, projectKey, projectName, cloudId, authType, spaceKey }) => ({
              provider: id,
              account,
              baseUrl,
              organization,
              workspace,
              projectKey,
              projectName,
              cloudId,
              authType,
              spaceKey,
            })),
        },
        mcpProviders: connected.map((item) => item.id),
        mcpSiteHints: {
          jiraUrl: jira?.baseUrl,
          jiraEmail: jira?.email,
          confluenceUrl: confluence?.baseUrl,
          confluenceEmail: confluence?.email,
          jiraCloudId: jira?.cloudId,
        },
      })
      if (!setupValidated) {
        advanceStep('package', 'error')
        patch({
          setupStatus: setupStatus || null,
          setupValidated: false,
          setupIdentitySource: identitySource || null,
          setupOverlayCount: overlayCount,
          setupContextReady: contextReady,
          setupDeliveryReady: deliveryReady,
        })
        setStatus({ type: 'error', message: 'Canonical workspace setup was not validated. Try again after updating the backend.' })
        return
      }

      advanceStep('package', 'done')
      downloadBlob(blob, filename)
      const fallbackStructure = buildDownloadStructure(repositories)
      patch({
        downloadFilename: filename,
        downloadStructure: structure.length ? structure : fallbackStructure,
        nextSdlcCommand: nextCommand || NEXT_SDLC_COMMAND,
        generationComplete: true,
        filesGenerated: fileCount || structure.length,
        generationTimeSec: Math.round((Date.now() - start) / 1000),
        setupStatus: setupStatus || null,
        setupValidated: true,
        setupIdentitySource: identitySource || null,
        setupOverlayCount: overlayCount,
        setupContextReady: contextReady,
        setupDeliveryReady: deliveryReady,
      })
      setStatus({
        type: folderStatus === 'preparing' ? 'info' : 'success',
        message:
          folderStatus === 'preparing'
            ? 'Your zip downloaded. The cloud project folder is still copying in the background.'
            : 'Project generated and downloaded.',
      })
      if (folderStatus === 'preparing') {
        setFolderQuery({ name: state.projectName, id: projectId })
        setFolderPrep('preparing')
      } else if (folderStatus === 'ready') {
        setFolderPrep('ready')
      }
    } catch (e) {
      advanceStep('package', 'error')
      setStatus({ type: 'error', message: e instanceof Error ? e.message : 'Generation failed.' })
    } finally {
      setLoading(false)
    }
  }, [state, patch, persistProject, step, goToStep])

  const handleQuickDownload = useCallback(() => {
    if (loading) return
    if (!state.requirementsText.trim() && !state.requirementFileName) {
      setStatus({ type: 'error', message: 'Upload a document or paste requirements first.' })
      return
    }
    void runGeneration()
  }, [loading, state.requirementsText, state.requirementFileName, runGeneration])

  const renderScreen = () => {
    switch (step) {
      case 'welcome':
        return (
          <WelcomeScreen
            state={state}
            resume={
              canOfferResume({ step, completedThrough, state, freshStart: freshStartRef.current })
                ? {
                    projectName: state.projectName.trim() || 'your project',
                    stepLabel: stepLabel(resumeTarget({ step: 'welcome', completedThrough, state })),
                  }
                : null
            }
            onContinue={(type) => startFresh(type)}
            onResume={() => {
              setStatus(null)
              goToStep(resumeTarget({ step: 'welcome', completedThrough, state }))
            }}
            onStartNew={() => startFresh('new')}
          />
        )
      case 'project-stakeholders':
        return <ProjectStakeholdersScreen state={state} onUpdate={patch} />
      case 'integrations':
        return (
          <IntegrationsScreen
            state={state}
            onUpdate={patch}
            onEnsureProject={autoEnsureProject ? ensureDraftProject : undefined}
          />
        )
      case 'repositories':
        return (
          <RepositoriesScreen
            state={state}
            onUpdate={patch}
            creating={creatingRepos}
          />
        )
      case 'requirements':
        return (
          <RequirementsScreen
            state={state}
            onUpdate={(updates) => {
              const resetGroom =
                'requirementsText' in updates || 'requirementFileName' in updates || 'requirementFile' in updates
              patch(resetGroom ? { ...clearGroomingPatch(), ...updates } : updates)
            }}
            grooming={grooming || saving}
            onAsk={() => void handleGroomAsk()}
            onPick={handleGroomPick}
            onOther={handleGroomOther}
            onToggleOther={handleGroomToggleOther}
            onUseWording={() => void handleGroomLooksGood()}
            onStartOver={handleGroomStartOver}
          />
        )
      case 'stakeholder-questions':
        return (
          <StakeholderQuestionsScreen
            state={state}
            onUpdate={patch}
            onSendOne={handleSendOne}
            onSendAll={handleSendAll}
            onPostJira={handlePostJiraOne}
            onPostAllJira={handlePostJiraAll}
            onRefreshJira={handleRefreshJira}
            sending={sending}
            posting={postingJira}
            refreshing={refreshingJira}
          />
        )
      case 'stakeholder-responses':
        return (
          <StakeholderResponsesScreen
            state={state}
            onSimulateResponses={handleSimulateResponses}
            onRefreshJira={() => void handleRefreshJira()}
            refreshing={refreshingJira}
          />
        )
      case 'project-shape':
        return <ProjectShapeScreen state={state} onUpdate={patch} />
      case 'technology-per-repo':
        return <TechnologyPerRepoScreen state={state} onUpdate={patch} />
      case 'ide-and-tools':
        return <IdeAndToolsScreen state={state} onUpdate={patch} />
      case 'platform-delivery':
        return <PlatformDeliveryScreen state={state} onUpdate={patch} />
      case 'review-resolve':
        return (
          <ReviewResolveScreen
            state={state}
            onNavigate={(s) => {
              setStatus(null)
              goToStep(s)
            }}
          />
        )
      case 'project-preview':
        return <ProjectPreviewScreen state={state} onGenerate={() => void runGeneration()} loading={loading} />
      case 'generation':
        return (
          <GenerationDownloadScreen
            state={state}
            loading={loading}
            exporting={creatingRepos}
            onExportGithub={() => void handleCreateGithubRepos()}
            onBack={() => goToStep('welcome')}
          />
        )
    }
  }

  const showBack = step !== 'welcome' && !(step === 'generation' && state.generationComplete)
  const showNext = step !== 'welcome' && step !== 'generation' && step !== 'project-preview'
  const isWelcome = step === 'welcome'
  const isSuccessScreen = step === 'generation' && state.generationComplete
  const generationIdx = stepIndex('generation')
  const currentSkipped = state.generationComplete && stepIndex(step) > completedThrough && stepIndex(step) < generationIdx
  const showQuickDownload =
    !isWelcome &&
    step !== 'project-preview' &&
    step !== 'generation' &&
    stepIndex(step) >= stepIndex('requirements')

  return (
    <div className={`app-shell${isWelcome ? ' welcome-mode' : ''}`}>
      <ThemeBackground />
      {!isWelcome && (
        <aside className="sidebar">
          <WizardSidebar
            currentStep={step}
            completedThrough={completedThrough}
            generationComplete={state.generationComplete}
            groomingUnlocked={groomingComplete(state)}
            unrestrictedNav={unrestrictedNav}
            onNavigate={(s) => {
              setStatus(null)
              goToStep(s)
            }}
          />
        </aside>
      )}

      <div className={`main${isWelcome ? ' main-welcome' : ''}${isSuccessScreen ? ' main-success' : ''}`}>
        {(!isSuccessScreen || folderPrep === 'preparing' || governancePrep === 'preparing') && !isWelcome && (
          <header className="top-bar">
            <div className="top-bar-start">
              <span className="step-indicator">
                Step {stepIndex(step) + 1} of {STEP_ORDER.length}
              </span>
              <div className="prep-stack">
              {folderPrep === 'preparing' && (
                <div className={`folder-prep${folderProgress.total === 0 ? ' is-waiting' : ''}`}>
                  <div className="folder-prep-copy">
                    <span>Preparing your project folder</span>
                    <strong>
                      {folderProgress.percent}%
                      {folderProgress.total > 0
                        ? ` · ${folderProgress.copied.toLocaleString()} / ${folderProgress.total.toLocaleString()}`
                        : ''}
                    </strong>
                  </div>
                  <div
                    className="folder-prep-bar"
                    role="progressbar"
                    aria-label="Project folder progress"
                    aria-valuemin={0}
                    aria-valuemax={100}
                    aria-valuenow={folderProgress.percent}
                  >
                    <span className="folder-prep-bar-fill" style={{ width: `${folderProgress.percent}%` }} />
                  </div>
                </div>
              )}
              {folderPrep === 'ready' && (
                <div className="folder-prep is-ready">
                  <div className="folder-prep-copy">
                    <span>Your project folder is ready.</span>
                    <strong>100%</strong>
                  </div>
                  <div className="folder-prep-bar" role="progressbar" aria-valuenow={100} aria-valuemin={0} aria-valuemax={100}>
                    <span className="folder-prep-bar-fill" style={{ width: '100%' }} />
                  </div>
                </div>
              )}
              {folderPrep === 'failed' && (
                <span className="folder-prep is-failed">We will finish your project folder when you download.</span>
              )}
              {governancePrep === 'preparing' && (
                <div className="folder-prep is-waiting">
                  <div className="folder-prep-copy">
                    <span>Checking stakeholder roles</span>
                    <strong>In progress</strong>
                  </div>
                  <div
                    className="folder-prep-bar"
                    role="progressbar"
                    aria-label="Stakeholder governance progress"
                    aria-valuemin={0}
                    aria-valuemax={100}
                    aria-valuenow={35}
                  >
                    <span className="folder-prep-bar-fill" />
                  </div>
                </div>
              )}
              {governancePrep === 'ready' && (
                <div className={`folder-prep ${state.sodWarnings.length ? 'is-note' : 'is-ready'}`}>
                  <div className="folder-prep-copy">
                    <span>
                      {state.sodWarnings.length
                        ? 'Stakeholder governance note is ready on Project & Stakeholders.'
                        : 'Stakeholder roles are configured.'}
                    </span>
                    <strong>Done</strong>
                  </div>
                  <div className="folder-prep-bar" role="progressbar" aria-valuenow={100} aria-valuemin={0} aria-valuemax={100}>
                    <span className="folder-prep-bar-fill" style={{ width: '100%' }} />
                  </div>
                </div>
              )}
              {governancePrep === 'failed' && (
                <span className="folder-prep is-failed">Could not finish stakeholder checks. You can keep going.</span>
              )}
              </div>
            </div>
            {showQuickDownload && (
              <button
                type="button"
                className="header-download-btn"
                disabled={loading || grooming}
                onClick={handleQuickDownload}
              >
                <Download size={16} />
                Download Project
              </button>
            )}
          </header>
        )}

        <div className={`content${isSuccessScreen ? ' content-fill' : ''}${isWelcome ? ' content-welcome' : ''}${currentSkipped ? ' content-skipped' : ''}`}>
          {status && !isWelcome && <div className={`status-banner ${status.type}`}>{status.message}</div>}
          {renderScreen()}
        </div>

        {!isSuccessScreen && !isWelcome && (
          <div className="action-bar">
          {showBack && (
            <button type="button" className="secondary-btn back-btn" onClick={goBack}>
              <ChevronLeft size={14} /> Back
            </button>
          )}
          <div className="action-spacer" />
          {showNext && (
            <button type="button" className="primary-btn" disabled={saving || loading || grooming || creatingRepos} onClick={() => void goNext()}>
              {creatingRepos ? 'Creating on GitHub…' : saving ? 'Saving…' : 'Save & Continue'} <ChevronRight size={14} />
            </button>
          )}
        </div>
        )}
      </div>
    </div>
  )
}
