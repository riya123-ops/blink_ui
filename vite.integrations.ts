import type { IncomingMessage, ServerResponse } from 'node:http'
import type { Plugin } from 'vite'

type ConnectBody = {
  provider?: string
  token?: string
  username?: string
  email?: string
  organization?: string
  workspace?: string
  baseUrl?: string
  projectKey?: string
  spaceKey?: string
}

class ConnectError extends Error {
  status: number
  constructor(status: number, message: string) {
    super(message)
    this.status = status
  }
}

function sendJson(res: ServerResponse, status: number, body: unknown) {
  res.writeHead(status, { 'Content-Type': 'application/json' })
  res.end(JSON.stringify(body))
}

function readBody(req: IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = []
    req.on('data', (chunk) => chunks.push(Buffer.from(chunk)))
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')))
    req.on('error', reject)
  })
}

function required(value: string | undefined, message: string): string {
  const trimmed = value?.trim() ?? ''
  if (!trimmed) throw new ConnectError(400, message)
  return trimmed
}

function optional(value: string | undefined): string | undefined {
  const trimmed = value?.trim() ?? ''
  return trimmed ? trimmed : undefined
}

function jsonField(body: string, ...fields: string[]): string {
  for (const field of fields) {
    const match = body.match(new RegExp(`"${field}"\\s*:\\s*"((?:\\\\.|[^"\\\\])*)"`))
    if (match?.[1]) return match[1].replace(/\\"/g, '"')
  }
  return 'Connected account'
}

function atlassianHost(raw: string | undefined): string {
  let value = required(raw, 'Atlassian site URL is required.')
  if (!value.includes('://')) value = `https://${value}`
  let url: URL
  try {
    url = new URL(value)
  } catch {
    throw new ConnectError(400, 'Enter a valid https://your-site.atlassian.net URL.')
  }
  if (url.protocol !== 'https:' || !url.hostname.toLowerCase().endsWith('.atlassian.net')) {
    throw new ConnectError(400, 'Only https://*.atlassian.net Cloud sites are supported.')
  }
  return url.hostname.toLowerCase()
}

async function providerGet(url: string, headers: Record<string, string>) {
  const response = await fetch(url, {
    headers: {
      Accept: 'application/json',
      'User-Agent': 'BLINK-Integrator',
      ...headers,
    },
  })
  const text = await response.text()
  if (response.status === 401 || response.status === 403) {
    throw new ConnectError(401, 'Invalid credentials or insufficient permission.')
  }
  if (response.status === 404) {
    throw new ConnectError(400, 'Account, organization, project, or space was not found.')
  }
  if (response.status < 200 || response.status >= 300) {
    throw new ConnectError(502, `Provider returned HTTP ${response.status}.`)
  }
  return text
}

async function connectProvider(body: ConnectBody) {
  const provider = required(body.provider, 'Provider is required.').toLowerCase()
  const token = required(body.token, 'Token is required.')

  if (provider === 'github') {
    const user = await providerGet('https://api.github.com/user', {
      Authorization: `Bearer ${token}`,
      'X-GitHub-Api-Version': '2022-11-28',
    })
    const account = jsonField(user, 'login', 'name')
    const org = optional(body.organization)
    if (org) {
      await providerGet(`https://api.github.com/orgs/${encodeURIComponent(org)}`, {
        Authorization: `Bearer ${token}`,
        'X-GitHub-Api-Version': '2022-11-28',
      })
      return { connected: true, provider, account, detail: `Connected as ${account} to ${org}` }
    }
    return { connected: true, provider, account, detail: `Connected as ${account}` }
  }

  if (provider === 'bitbucket') {
    const username = required(body.username, 'Bitbucket username is required.')
    const workspace = required(body.workspace, 'Bitbucket workspace is required.')
    const auth = `Basic ${Buffer.from(`${username}:${token}`).toString('base64')}`
    const user = await providerGet('https://api.bitbucket.org/2.0/user', { Authorization: auth })
    const account = jsonField(user, 'display_name', 'username')
    await providerGet(`https://api.bitbucket.org/2.0/workspaces/${encodeURIComponent(workspace)}`, {
      Authorization: auth,
    })
    return { connected: true, provider, account, detail: `Connected as ${account} to ${workspace}` }
  }

  if (provider === 'jira' || provider === 'confluence') {
    const host = atlassianHost(body.baseUrl)
    const email = required(body.email, 'Atlassian account email is required.')
    const auth = `Basic ${Buffer.from(`${email}:${token}`).toString('base64')}`
    const path =
      provider === 'jira'
        ? `https://${host}/rest/api/3/myself`
        : `https://${host}/wiki/rest/api/user/current`
    const me = await providerGet(path, { Authorization: auth })
    const account = jsonField(me, 'displayName', 'emailAddress', 'username', 'accountId')
    const extra = provider === 'jira' ? optional(body.projectKey) : optional(body.spaceKey)

    let projects: { id: string; key: string; name: string; projectTypeKey?: string; avatarUrl?: string }[] = []
    if (provider === 'jira') {
      try {
        const prjRes = await providerGet(`https://${host}/rest/api/3/project`, { Authorization: auth })
        const parsed = JSON.parse(prjRes)
        if (Array.isArray(parsed)) {
          projects = parsed.map((p) => ({
            id: String(p.id || ''),
            key: String(p.key || ''),
            name: String(p.name || ''),
            projectTypeKey: p.projectTypeKey,
            avatarUrl: p.avatarUrls?.['48x48'],
          }))
        }
      } catch {
        // ignore
      }
    }

    if (extra) {
      const extraPath =
        provider === 'jira'
          ? `https://${host}/rest/api/3/project/${encodeURIComponent(extra)}`
          : `https://${host}/wiki/rest/api/space/${encodeURIComponent(extra)}`
      await providerGet(extraPath, { Authorization: auth })
      const kind = provider === 'jira' ? 'project' : 'space'
      const matched = projects.find((p) => p.key.toLowerCase() === extra.toLowerCase())
      return {
        connected: true,
        provider,
        account,
        detail: `Connected as ${account} to ${kind} ${extra}`,
        projectKey: extra,
        projectName: matched?.name,
        baseUrl: `https://${host}`,
        authType: 'token',
        token,
        projects,
      }
    }
    return {
      connected: true,
      provider,
      account,
      detail: projects.length > 0 ? `Connected as ${account} (${projects.length} projects available)` : `Connected as ${account}`,
      baseUrl: `https://${host}`,
      authType: 'token',
      token,
      projects,
    }
  }

  throw new ConnectError(400, 'Unsupported provider.')
}

async function providerPost(url: string, headers: Record<string, string>, jsonBody: string) {
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
      'User-Agent': 'BLINK-Integrator',
      ...headers,
    },
    body: jsonBody,
  })
  const text = await response.text()
  return { status: response.status, text }
}

type CreateReposBody = {
  provider?: string
  token?: string
  organization?: string
  repositories?: { name?: string; description?: string }[]
}

async function createGithubRepos(body: CreateReposBody) {
  const token = required(body.token, 'Token is required.')
  const provider = required(body.provider, 'Provider is required.').toLowerCase()
  if (provider !== 'github') {
    throw new ConnectError(400, 'Only GitHub repository creation is supported.')
  }
  const headers = {
    Authorization: `Bearer ${token}`,
    'X-GitHub-Api-Version': '2022-11-28',
  }
  const user = await providerGet('https://api.github.com/user', headers)
  const account = jsonField(user, 'login', 'name')
  const org = optional(body.organization)
  const endpoint = org
    ? `https://api.github.com/orgs/${encodeURIComponent(org)}/repos`
    : 'https://api.github.com/user/repos'
  const repos = body.repositories ?? []
  if (!repos.length) throw new ConnectError(400, 'At least one repository is required.')
  const results = []
  for (const spec of repos) {
    const name = required(spec.name, 'Repository name is required.')
    const payload = JSON.stringify({
      name,
      description: spec.description ?? '',
      private: true,
      auto_init: false,
    })
    const created = await providerPost(endpoint, headers, payload)
    if (created.status === 401 || created.status === 403) {
      throw new ConnectError(401, 'Invalid credentials or insufficient permission to create repositories.')
    }
    if (created.status === 422 && /already_exists/i.test(created.text)) {
      results.push({ name, status: 'exists', htmlUrl: null, message: 'Repository already exists.' })
      continue
    }
    if (created.status < 200 || created.status >= 300) {
      results.push({
        name,
        status: 'failed',
        htmlUrl: null,
        message: jsonField(created.text, 'message') || `GitHub returned HTTP ${created.status}.`,
      })
      continue
    }
    const htmlUrl = jsonField(created.text, 'html_url')
    results.push({
      name,
      status: 'created',
      htmlUrl: htmlUrl === 'Connected account' ? `https://github.com/${account}/${name}` : htmlUrl,
      message: `Created ${htmlUrl}`,
    })
  }
  return { provider: 'github', repositories: results }
}

async function handleConnect(req: IncomingMessage, res: ServerResponse) {
  try {
    const raw = await readBody(req)
    const body = (raw.trim() ? JSON.parse(raw) : {}) as ConnectBody
    const result = await connectProvider(body)
    sendJson(res, 200, result)
  } catch (error) {
    if (error instanceof ConnectError) {
      sendJson(res, error.status, { message: error.message })
      return
    }
    sendJson(res, 502, { message: error instanceof Error ? error.message : 'Could not reach the provider.' })
  }
}

async function handleCreateRepos(req: IncomingMessage, res: ServerResponse) {
  try {
    const raw = await readBody(req)
    const body = (raw.trim() ? JSON.parse(raw) : {}) as CreateReposBody
    const result = await createGithubRepos(body)
    sendJson(res, 200, result)
  } catch (error) {
    if (error instanceof ConnectError) {
      sendJson(res, error.status, { message: error.message })
      return
    }
    sendJson(res, 502, { message: error instanceof Error ? error.message : 'Could not create repositories.' })
  }
}

async function handleFetchJiraProjects(req: IncomingMessage, res: ServerResponse) {
  try {
    const raw = await readBody(req)
    const body = (raw.trim() ? JSON.parse(raw) : {}) as {
      baseUrl?: string
      email?: string
      token?: string
      cloudId?: string
      accessToken?: string
    }
    let url = ''
    let headers: Record<string, string> = {}
    if (body.cloudId && body.accessToken) {
      url = `https://api.atlassian.com/ex/jira/${encodeURIComponent(body.cloudId)}/rest/api/3/project`
      headers = { Authorization: `Bearer ${body.accessToken}` }
    } else if (body.baseUrl && body.email && body.token) {
      const host = atlassianHost(body.baseUrl)
      url = `https://${host}/rest/api/3/project`
      headers = { Authorization: `Basic ${Buffer.from(`${body.email}:${body.token}`).toString('base64')}` }
    } else {
      sendJson(res, 200, [])
      return
    }

    const prjRes = await providerGet(url, headers)
    const parsed = JSON.parse(prjRes)
    const projects = Array.isArray(parsed)
      ? parsed.map((p) => ({
          id: String(p.id || ''),
          key: String(p.key || ''),
          name: String(p.name || ''),
          projectTypeKey: p.projectTypeKey,
          avatarUrl: p.avatarUrls?.['48x48'],
        }))
      : []
    sendJson(res, 200, projects)
  } catch (error) {
    if (error instanceof ConnectError) {
      sendJson(res, error.status, { message: error.message })
      return
    }
    sendJson(res, 502, { message: error instanceof Error ? error.message : 'Could not fetch projects.' })
  }
}

export function integrationsConnectPlugin(): Plugin {
  return {
    name: 'blink-integrations-connect',
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        const path = req.url?.split('?')[0]
        if (req.method !== 'POST') {
          next()
          return
        }
        if (path === '/api/integrations/connect') {
          void handleConnect(req, res)
          return
        }
        if (path === '/api/integrations/repositories') {
          void handleCreateRepos(req, res)
          return
        }
        if (path === '/api/integrations/jira/projects') {
          void handleFetchJiraProjects(req, res)
          return
        }
        next()
      })
    },
  }
}
