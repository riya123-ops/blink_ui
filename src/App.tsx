import { useCallback, useState } from 'react'
import { ChevronLeft, ChevronRight, Download } from 'lucide-react'
import { downloadWorkspace, saveProject, createRepositories, type ProjectPayload } from './api/blink'
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
  validateStakeholderQuestions,
} from './screens/StakeholderQuestionsScreen'
import {
  StakeholderResponsesScreen,
  validateStakeholderResponses,
} from './screens/StakeholderResponsesScreen'
import { WelcomeScreen } from './screens/WelcomeScreen'
import {
  assigneeForQuestion,
  generateQuestionsFromRequirements,
  mockResponsesForQuestions,
} from './wizard/questions'
import { roleLabel } from './wizard/stakeholders'
import { stepIndex } from './wizard/steps'
import { buildDownloadStructure, defaultRepositories, NEXT_SDLC_COMMAND } from './wizard/defaults'
import {
  defaultWizardState,
  generationStepDefs,
  type WizardState,
  type WizardStep,
} from './wizard/types'

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
      }
    })
}

export default function App() {
  const [state, setState] = useState<WizardState>(defaultWizardState)
  const [step, setStep] = useState<WizardStep>('welcome')
  const [completedThrough, setCompletedThrough] = useState(0)
  const [status, setStatus] = useState<{ type: 'error' | 'success' | 'info'; message: string } | null>(null)
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [sending, setSending] = useState(false)
  const [creatingRepos, setCreatingRepos] = useState(false)

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

  const persistProject = useCallback(async (): Promise<string> => {
    const saved = await saveProject(projectPayload(), state.projectId)
    const id = String(saved.id)
    patch({ projectId: id })
    return id
  }, [projectPayload, state.projectId, patch])

  const handleCreateGithubRepos = useCallback(async (): Promise<boolean> => {
    const github = state.integrations.find((item) => item.id === 'github')
    if (!github?.connected || !github.token) {
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
        token: github.token,
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
  }, [state.integrations, state.repositories, patch])

  const goNext = useCallback(async () => {
    const err = validateCurrentStep()
    if (err) {
      setStatus({ type: 'error', message: err })
      return
    }
    if (step === 'project-stakeholders') {
      setSaving(true)
      setStatus(null)
      try {
        const id = await persistProject()
        setStatus({ type: 'success', message: `Project saved (id ${id}).` })
      } catch (e) {
        setStatus({ type: 'error', message: e instanceof Error ? e.message : 'Could not save project.' })
        return
      } finally {
        setSaving(false)
      }
    } else if (step === 'repositories') {
      if (!state.repositories.some((repo) => repo.name.trim())) {
        setStatus({ type: 'error', message: 'Keep at least one repository, or add one.' })
        return
      }
      const github = state.integrations.find((item) => item.id === 'github')
      if (github?.connected && github.token) {
        const created = await handleCreateGithubRepos()
        if (!created) return
      } else {
        setStatus(null)
      }
    } else {
      setStatus(null)
    }
    const idx = stepIndex(step)
    setCompletedThrough((prev) => Math.max(prev, idx))
    const nextStep = STEP_ORDER[idx + 1]
    if (nextStep) setStep(nextStep)
  }, [step, validateCurrentStep, persistProject, state.repositories, state.integrations, handleCreateGithubRepos])

  const goBack = useCallback(() => {
    setStatus(null)
    const idx = stepIndex(step)
    if (idx > 0) setStep(STEP_ORDER[idx - 1])
  }, [step])

  const handleAnalyze = useCallback(() => {
    if (!state.requirementsText.trim() && !state.requirementFileName) {
      setStatus({ type: 'error', message: 'Upload a document or paste requirements first.' })
      return
    }
    const questions = generateQuestionsFromRequirements(state)
    patch({ questions, requirementsAnalyzed: true, responses: [], questionsSent: false })
    setStatus({ type: 'success', message: `Generated ${questions.length} clarification questions.` })
  }, [state, patch])

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
    const unsent = state.questions.filter((q) => !q.sent).map((q) => q.id)
    if (!unsent.length) return
    setSending(true)
    setStatus(null)
    try {
      const payload = buildEmailPayload(state, unsent)
      const res = await sendStakeholderQuestions(payload)
      applySendResults(res.results, res.delivery_mode, res.outbox_dir)
    } catch (e) {
      setStatus({ type: 'error', message: e instanceof Error ? e.message : 'Failed to send emails.' })
    } finally {
      setSending(false)
    }
  }, [state, applySendResults])

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
    setStep('generation')

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
        projectId = await persistProject()
      }
      const repositories = (
        state.repositoriesTouched ? state.repositories : defaultRepositories(state.projectName)
      ).map((repo) => ({
        name: repo.name,
        purpose: repo.purpose,
        description: repo.description,
      }))
      const { blob, filename, structure, fileCount, nextCommand } = await downloadWorkspace({
        projectId,
        file: state.requirementFile,
        requirementsText: state.requirementsText,
        repositories,
      })

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
      })
      setStatus({ type: 'success', message: 'Project generated and downloaded.' })
    } catch (e) {
      advanceStep('package', 'error')
      setStatus({ type: 'error', message: e instanceof Error ? e.message : 'Generation failed.' })
    } finally {
      setLoading(false)
    }
  }, [state, patch, persistProject, step])

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
            onSelectType={(type) =>
              patch({ projectType: type, existingSourceMode: type === 'new' ? 'none' : state.existingSourceMode })
            }
            onContinue={(type) => {
              patch({ projectType: type, existingSourceMode: type === 'new' ? 'none' : state.existingSourceMode })
              setStatus(null)
              setCompletedThrough(0)
              setStep('project-stakeholders')
            }}
          />
        )
      case 'project-stakeholders':
        return <ProjectStakeholdersScreen state={state} onUpdate={patch} />
      case 'integrations':
        return <IntegrationsScreen state={state} onUpdate={patch} />
      case 'repositories':
        return (
          <RepositoriesScreen
            state={state}
            onUpdate={patch}
            creating={creatingRepos}
          />
        )
      case 'requirements':
        return <RequirementsScreen state={state} onUpdate={patch} onAnalyze={handleAnalyze} />
      case 'stakeholder-questions':
        return (
          <StakeholderQuestionsScreen
            state={state}
            onSendOne={handleSendOne}
            onSendAll={handleSendAll}
            sending={sending}
          />
        )
      case 'stakeholder-responses':
        return <StakeholderResponsesScreen state={state} onSimulateResponses={handleSimulateResponses} />
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
              setStep(s)
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
            onBack={() => setStep('welcome')}
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
            onNavigate={(s) => {
              setStatus(null)
              setStep(s)
            }}
          />
        </aside>
      )}

      <div className={`main${isWelcome ? ' main-welcome' : ''}${isSuccessScreen ? ' main-success' : ''}`}>
        {!isSuccessScreen && !isWelcome && (
          <header className="top-bar">
            <div className="top-bar-start">
              <span className="step-indicator">
                Step {stepIndex(step) + 1} of {STEP_ORDER.length}
              </span>
            </div>
            {showQuickDownload && (
              <button
                type="button"
                className="header-download-btn"
                disabled={loading}
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
            <button type="button" className="primary-btn" disabled={saving || loading || creatingRepos} onClick={() => void goNext()}>
              {creatingRepos ? 'Creating on GitHub…' : saving ? 'Saving…' : 'Save & Continue'} <ChevronRight size={14} />
            </button>
          )}
        </div>
        )}
      </div>
    </div>
  )
}
