export interface SendQuestionPayload {
  question_id: string
  question: string
  recipient_email: string
  recipient_name: string
  role: string
  project_name: string
}

export interface EmailDeliveryResult {
  question_id: string
  status: 'sent' | 'failed'
  delivery_method: string
  message: string
}

export interface SendQuestionsResponse {
  results: EmailDeliveryResult[]
  delivery_mode: string
  outbox_dir: string | null
}

export async function sendStakeholderQuestions(
  questions: SendQuestionPayload[],
): Promise<SendQuestionsResponse> {
  const response = await fetch('/api/stakeholder-questions/send', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ questions }),
  })
  if (!response.ok) {
    throw new Error(await response.text() || `Send failed (${response.status})`)
  }
  return response.json() as Promise<SendQuestionsResponse>
}
