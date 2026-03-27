import { InfluxDB } from '@influxdata/influxdb-client-browser'

import { createInfluxExplorerDataSource } from '@/services/influx/dataSourceCore'
import type {
  InfluxAuthMethod,
  InfluxConnectionConfig,
  InfluxPingResult,
  InfluxRow,
} from '@/services/influx/types'

const DEFAULT_AUTH_METHOD: InfluxAuthMethod = 'token'
const WORKBENCH_SESSION_TOKEN_DESCRIPTION =
  'Influx Vue Workbench session token'

interface InfluxUserResponse {
  id: string
  name: string
}

interface InfluxOrgListResponse {
  orgs?: Array<{
    id: string
    name: string
  }>
}

interface InfluxAuthorizationResponse {
  token?: string
}

function normalizeBaseUrl(url: string): string {
  return url.replace(/\/+$/, '')
}

function resolveAuthMethod(config: InfluxConnectionConfig): InfluxAuthMethod {
  return config.authMethod ?? DEFAULT_AUTH_METHOD
}

function usesSessionAuth(config: InfluxConnectionConfig): boolean {
  return resolveAuthMethod(config) === 'password' && !config.token.trim()
}

function encodeBasicCredentials(username: string, password: string): string {
  if (typeof btoa === 'function') {
    return btoa(`${username}:${password}`)
  }

  const bytes = new TextEncoder().encode(`${username}:${password}`)
  const alphabet =
    'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/'
  let result = ''

  for (let index = 0; index < bytes.length; index += 3) {
    const chunk =
      (bytes[index] << 16) |
      ((bytes[index + 1] ?? 0) << 8) |
      (bytes[index + 2] ?? 0)

    result += alphabet[(chunk >> 18) & 63]
    result += alphabet[(chunk >> 12) & 63]
    result += index + 1 < bytes.length ? alphabet[(chunk >> 6) & 63] : '='
    result += index + 2 < bytes.length ? alphabet[chunk & 63] : '='
  }

  return result
}

function resolveRequestCredentials(config: InfluxConnectionConfig) {
  return usesSessionAuth(config) ? 'include' : 'omit'
}

function buildAuthHeaders(config: InfluxConnectionConfig): HeadersInit {
  if (usesSessionAuth(config)) {
    return {
      Accept: 'application/json',
    }
  }

  return {
    Accept: 'application/json',
    Authorization: `Token ${config.token}`,
  }
}

function isSameOriginBrowserUrl(url: string): boolean {
  if (typeof window === 'undefined' || !window.location?.origin) {
    return true
  }

  try {
    return new URL(url, window.location.origin).origin === window.location.origin
  } catch {
    return false
  }
}

async function readErrorMessage(response: Response): Promise<string> {
  const contentType = response.headers.get('content-type') ?? ''
  if (contentType.includes('application/json')) {
    const payload = (await response.json()) as {
      message?: string
      error?: string
    }
    return payload.message ?? payload.error ?? response.statusText
  }

  const text = await response.text()
  return text || response.statusText
}

async function requestJson<T>(
  baseUrl: string,
  config: InfluxConnectionConfig,
  path: string,
): Promise<T> {
  const response = await fetch(`${baseUrl}${path}`, {
    credentials: resolveRequestCredentials(config),
    headers: buildAuthHeaders(config),
  })

  if (!response.ok) {
    throw new Error(await readErrorMessage(response))
  }

  return (await response.json()) as T
}

async function requestSessionJson<T>(
  baseUrl: string,
  path: string,
  init: RequestInit = {},
): Promise<T> {
  const response = await fetch(`${baseUrl}${path}`, {
    ...init,
    credentials: 'include',
    headers: {
      Accept: 'application/json',
      ...(init.body ? { 'Content-Type': 'application/json' } : {}),
      ...init.headers,
    },
  })

  if (!response.ok) {
    throw new Error(await readErrorMessage(response))
  }

  return (await response.json()) as T
}

async function ping(
  baseUrl: string,
  config: InfluxConnectionConfig,
): Promise<InfluxPingResult> {
  const response = await fetch(`${baseUrl}/api/v2/buckets?limit=1`, {
    credentials: resolveRequestCredentials(config),
    headers: buildAuthHeaders(config),
  })

  if (!response.ok) {
    throw new Error(await readErrorMessage(response))
  }

  await response.json()

  return {
    name: 'InfluxDB',
    message: 'CORS-compatible browser connectivity check succeeded.',
    status: 'pass',
    version: response.headers.get('X-Influxdb-Version') ?? undefined,
  }
}

async function createSessionBackedToken(
  baseUrl: string,
  config: InfluxConnectionConfig,
): Promise<string> {
  const user = await requestSessionJson<InfluxUserResponse>(baseUrl, '/api/v2/me')
  const orgs = await requestSessionJson<InfluxOrgListResponse>(
    baseUrl,
    `/api/v2/orgs?org=${encodeURIComponent(config.org)}`,
  )
  const org = orgs.orgs?.find((candidate) => candidate.name === config.org)

  if (!org) {
    throw new Error(`Could not resolve org "${config.org}" for this account.`)
  }

  let authorization: InfluxAuthorizationResponse

  try {
    authorization = await requestSessionJson<InfluxAuthorizationResponse>(
      baseUrl,
      '/api/v2/authorizations',
      {
        method: 'POST',
        body: JSON.stringify({
          status: 'active',
          description: WORKBENCH_SESSION_TOKEN_DESCRIPTION,
          orgID: org.id,
          userID: user.id,
          permissions: [
            {
              action: 'read',
              resource: {
                type: 'orgs',
                orgID: org.id,
              },
            },
            {
              action: 'read',
              resource: {
                type: 'buckets',
                orgID: org.id,
              },
            },
          ],
        }),
      },
    )
  } catch (error) {
    throw new Error(
      `Signed in, but token issuance failed. Ensure this account can write authorizations. ${error instanceof Error ? error.message : String(error)}`,
    )
  }

  if (!authorization.token) {
    throw new Error(
      'The account signed in, but InfluxDB did not return a token from /api/v2/authorizations.',
    )
  }

  return authorization.token
}

export async function authenticateBrowserInfluxConnection(
  config: InfluxConnectionConfig,
): Promise<InfluxConnectionConfig> {
  if (resolveAuthMethod(config) !== 'password') {
    return {
      ...config,
      authMethod: resolveAuthMethod(config),
    }
  }

  if (config.token.trim()) {
    return {
      ...config,
      authMethod: 'password',
    }
  }

  if (!isSameOriginBrowserUrl(config.url)) {
    throw new Error(
      'Username/password login in the browser requires a same-origin URL or reverse proxy on the current app origin.',
    )
  }

  const username = config.username?.trim() ?? ''
  const password = config.password ?? ''
  const baseUrl = normalizeBaseUrl(config.url)
  const response = await fetch(`${baseUrl}/api/v2/signin`, {
    method: 'POST',
    credentials: 'include',
    headers: {
      Accept: 'application/json',
      Authorization: `Basic ${encodeBasicCredentials(username, password)}`,
    },
  })

  if (!response.ok) {
    throw new Error(await readErrorMessage(response))
  }

  return {
    ...config,
    authMethod: 'password',
    token: await createSessionBackedToken(baseUrl, config),
  }
}

export function createBrowserInfluxDataSource(config: InfluxConnectionConfig) {
  const baseUrl = normalizeBaseUrl(config.url)
  const influxDB = new InfluxDB({
    url: baseUrl,
    token: usesSessionAuth(config) ? undefined : config.token,
    transportOptions: usesSessionAuth(config)
      ? { credentials: 'include' }
      : undefined,
  })
  const queryApi = influxDB.getQueryApi(config.org)

  return createInfluxExplorerDataSource({
    org: config.org,
    ping: () => ping(baseUrl, config),
    requestJson: <T>(path: string) =>
      requestJson<T>(baseUrl, config, path),
    collectRows: (flux: string) => queryApi.collectRows<InfluxRow>(flux),
  })
}
