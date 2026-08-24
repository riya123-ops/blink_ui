import { useCallback, useState } from 'react'
import { ChevronLeft, ChevronRight, Download } from 'lucide-react'
import { sendStakeholderQuestions } from './api/email'
import { WizardSidebar, STEP_ORDER } from './components/WizardSidebar'
import { ThemeBackground } from './components/ThemeBackground'
import {
  GenerationDownloadScreen,
  IdeAndToolsScreen,
  IntegrationsScreen,
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
import {
  StakeholderQuestionsScreen,
  validateStakeholderQuestions,
} from './screens/StakeholderQuestionsScreen'
import {
  StakeholderResponsesScreen,
  validateStakeholderResponses,
} from './screens/StakeholderResponsesScreen'
import { WelcomeScreen } from './screens/WelcomeScreen'
import { toApiPayload } from './types'
import {
  assigneeForQuestion,
  generateQuestionsFromRequirements,
  mockResponsesForQuestions,
} from './wizard/questions'
import { roleLabel } from './wizard/stakeholders'
import { stepIndex } from './wizard/steps'
import {
  defaultWizardState,
  generationStepDefs,
  syncEmailsFromStakeholders,
  wizardToSetupForm,
  type WizardState,
  type WizardStep,
} from './wizard/types'

function slugify(value: string) {
  return value.trim().toLowerCase().replace(/\s+/g, '-').replace(/_/g, '-')
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
      }
    })
}

export default function App() {
  const [state, setState] = useState<WizardState>(defaultWizardState)
  const [step, setStep] = useState<WizardStep>('welcome')
  const [completedThrough, setCompletedThrough] = useState(0)
  const [status, setStatus] = useState<{ type: 'error' | 'success' | 'info'; message: string } | null>(null)
  const [loading, setLoading] = useState(false)
  const [sending, setSending] = useState(false)
  const [zipBlob, setZipBlob] = useState<Blob | null>(null)

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

  const goNext = useCallback(() => {
    const err = validateCurrentStep()
    if (err) {
      setStatus({ type: 'error', message: err })
      return
    }
    setStatus(null)
    const idx = stepIndex(step)
    setCompletedThrough((prev) => Math.max(prev, idx))
    const nextStep = STEP_ORDER[idx + 1]
    if (nextStep) setStep(nextStep)
  }, [step, validateCurrentStep])

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
      const form = wizardToSetupForm(syncEmailsFromStakeholders(state))
      const response = await fetch('/api/setup-new-workspace/apply', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(toApiPayload(form)),
      })

      if (!response.ok) {
        advanceStep('package', 'error')
        throw new Error((await response.text()) || `Setup failed (${response.status})`)
      }

      const blob = await response.blob()
      const filename =
        response.headers.get('Content-Disposition')?.match(/filename="?([^";]+)"?/)?.[1] ??
        `${slugify(state.artifactName)}-workspace.zip`

      setZipBlob(blob)
      advanceStep('package', 'done')
      downloadBlob(blob, filename)
      patch({
        downloadFilename: filename,
        generationComplete: true,
        filesGenerated: 1248,
        generationTimeSec: Math.round((Date.now() - start) / 1000),
      })
      setStatus({ type: 'success', message: 'Project generated and downloaded.' })
    } catch (e) {
      setStatus({ type: 'error', message: e instanceof Error ? e.message : 'Generation failed.' })
    } finally {
      setLoading(false)
    }
  }, [state, patch])

  const handleDownloadAgain = useCallback(() => {
    if (zipBlob && state.downloadFilename) downloadBlob(zipBlob, state.downloadFilename)
  }, [zipBlob, state.downloadFilename])

  const handleQuickDownload = useCallback(() => {
    if (loading) return
    if (zipBlob && state.downloadFilename && state.generationComplete) {
      handleDownloadAgain()
      return
    }
    void runGeneration()
  }, [loading, zipBlob, state.downloadFilename, state.generationComplete, handleDownloadAgain, runGeneration])

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
      case 'repositories':
        return <RepositoriesScreen state={state} onUpdate={patch} />
      case 'technology-per-repo':
        return <TechnologyPerRepoScreen state={state} onUpdate={patch} />
      case 'ide-and-tools':
        return <IdeAndToolsScreen state={state} onUpdate={patch} />
      case 'platform-delivery':
        return <PlatformDeliveryScreen state={state} onUpdate={patch} />
      case 'integrations':
        return <IntegrationsScreen state={state} onUpdate={patch} />
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
            onDownload={handleDownloadAgain}
            onBack={() => setStep('welcome')}
          />
        )
    }
  }

  const showBack = step !== 'welcome' && !(step === 'generation' && state.generationComplete)
  const showNext = step !== 'welcome' && step !== 'generation' && step !== 'project-preview'
  const isWelcome = step === 'welcome'
  const isSuccessScreen = step === 'generation' && state.generationComplete
  const showQuickDownload = !isWelcome && stepIndex(step) > stepIndex('project-stakeholders')

  return (
    <div className={`app-shell${isWelcome ? ' welcome-mode' : ''}`}>
      <ThemeBackground />
      {!isWelcome && (
        <aside className="sidebar">
          <WizardSidebar
            currentStep={step}
            completedThrough={completedThrough}
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

        <div className={`content${isSuccessScreen ? ' content-fill' : ''}${isWelcome ? ' content-welcome' : ''}`}>
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
            <button type="button" className="primary-btn" onClick={goNext}>
              Save &amp; Continue <ChevronRight size={14} />
            </button>
          )}
        </div>
        )}
      </div>
    </div>
  )
}
