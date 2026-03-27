import { InfluxDB } from '@influxdata/influxdb-client-browser'

import { createInfluxExplorerDataSource } from '@/services/influx/dataSourceCore'
import type {
  InfluxAuthMethod,
  InfluxConnectionConfig,
  InfluxPingResult,
  InfluxRow,
} from '@/services/influx/types'

const DEFAULT_AUTH_METHOD: InfluxAuthMethod = 'token'

function normalizeBaseUrl(url: string): string {
  return url.replace(/\/+$/, '')
}

function resolveAuthMethod(config: InfluxConnectionConfig): InfluxAuthMethod {
  return config.authMethod ?? DEFAULT_AUTH_METHOD
}

function usesPasswordAuth(config: InfluxConnectionConfig): boolean {
  return resolveAuthMethod(config) === 'password'
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
  return usesPasswordAuth(config) ? 'include' : 'omit'
}

function buildAuthHeaders(config: InfluxConnectionConfig): HeadersInit {
  if (usesPasswordAuth(config)) {
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

export async function authenticateBrowserInfluxConnection(
  config: InfluxConnectionConfig,
): Promise<InfluxConnectionConfig> {
  if (!usesPasswordAuth(config)) {
    return {
      ...config,
      authMethod: resolveAuthMethod(config),
    }
  }

  if (!isSameOriginBrowserUrl(config.url)) {
    throw new Error(
      'Username/password login in the browser requires a same-origin URL or reverse proxy such as /influx.',
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
    token: '',
  }
}

export function createBrowserInfluxDataSource(config: InfluxConnectionConfig) {
  const baseUrl = normalizeBaseUrl(config.url)
  const influxDB = new InfluxDB({
    url: baseUrl,
    token: usesPasswordAuth(config) ? undefined : config.token,
    transportOptions: usesPasswordAuth(config)
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
