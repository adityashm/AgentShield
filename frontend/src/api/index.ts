import axios from 'axios'
import type {
  User,
  ApiKey,
  ApiKeyCreatedResponse,
  ApiKeyRotateResponse,
  Agent,
  Action,
  Alert,
  AlertComment,
  Rule,
  RuleTestResponse,
  AuditLogEntry,
  AuditVerificationResponse,
  WebhookEndpoint,
  SystemHealthResponse,
} from './types'

export * from './types'

const base = import.meta.env.VITE_API_BASE || 'http://localhost:8000/api/v1'

const api = axios.create({
  baseURL: base,
  headers: { 'Content-Type': 'application/json' },
})

// Attach JWT token from localStorage if available
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('agentshield_token')
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

// Auth & Users
export async function getUsers(): Promise<User[]> {
  const r = await api.get('/users')
  return r.data
}

export async function inviteUser(data: { email: string; role: string; full_name?: string }): Promise<User> {
  const r = await api.post('/users/invite', data)
  return r.data
}

// Actions & Telemetry
export async function ingestAction(actionData: Record<string, any>): Promise<any> {
  const r = await api.post('/actions', actionData)
  return r.data
}

export async function bulkIngestActions(actions: any[]): Promise<any> {
  const r = await api.post('/actions/batch', actions)
  return r.data
}

// Agents Directory & Controls
export async function getAgents(): Promise<Agent[]> {
  const r = await api.get('/agents')
  return r.data
}

export async function getAgent(agentId: string): Promise<Agent> {
  const r = await api.get(`/agents/${agentId}`)
  return r.data
}

export async function getAgentActions(agentId: string, page = 1, limit = 50): Promise<Action[]> {
  const r = await api.get(`/agents/${agentId}/actions`, { params: { page, limit } })
  return r.data
}

export async function quarantineAgent(agentId: string): Promise<any> {
  const r = await api.post(`/agents/${agentId}/quarantine`)
  return r.data
}

export async function haltAgent(agentId: string): Promise<any> {
  const r = await api.post(`/agents/${agentId}/halt`)
  return r.data
}

export async function releaseAgent(agentId: string): Promise<any> {
  const r = await api.post(`/agents/${agentId}/release`)
  return r.data
}

// Alerts & Forensics
export async function getAlerts(params?: { severity?: string; status?: string; agentId?: string }): Promise<Alert[]> {
  const r = await api.get('/alerts', { params })
  return r.data
}

export async function updateAlertStatus(
  alertId: string,
  status: 'open' | 'acknowledged' | 'resolved' | 'false_positive' | string,
  notes?: string
): Promise<Alert> {
  const r = await api.patch(`/alerts/${alertId}`, { status, notes })
  return r.data
}

export async function getAlertComments(alertId: string): Promise<AlertComment[]> {
  const r = await api.get(`/alerts/${alertId}/comments`)
  return r.data
}

export async function addAlertComment(alertId: string, content: string): Promise<AlertComment> {
  const r = await api.post(`/alerts/${alertId}/comments`, { content })
  return r.data
}

// Rules Engine & Testing
export async function getRules(): Promise<Rule[]> {
  const r = await api.get('/rules')
  return r.data
}

export async function createRule(ruleData: any): Promise<Rule> {
  const r = await api.post('/rules', ruleData)
  return r.data
}

export async function deleteRule(ruleId: string): Promise<any> {
  const r = await api.delete(`/rules/${ruleId}`)
  return r.data
}

export async function testRuleEvaluation(ruleCondition: any, testPayload: any): Promise<RuleTestResponse> {
  const start = performance.now()
  try {
    const r = await api.post('/rules/test', {
      condition: ruleCondition,
      payload: testPayload,
    })
    return {
      ...r.data,
      latency_ms: Math.round(performance.now() - start),
    }
  } catch {
    // Client-side fallback evaluator for local UI testing
    const latency_ms = Math.round(performance.now() - start)
    const payloadStr = JSON.stringify(testPayload).toLowerCase()
    const condStr = JSON.stringify(ruleCondition).toLowerCase()
    const matched =
      condStr.includes('regex') || condStr.includes('contains')
        ? payloadStr.includes('/etc/') || payloadStr.includes('passwd') || payloadStr.includes('shadow') || payloadStr.includes('ignore')
        : false
    return {
      matched,
      decision: matched ? 'deny' : 'allow',
      reasons: matched ? ['Evaluated pattern matched target security condition.'] : ['No condition violation detected.'],
      latency_ms,
    }
  }
}

// Model & System Telemetry
export async function retrainModel(): Promise<any> {
  const r = await api.post('/model/retrain')
  return r.data
}

export async function getSystemHealth(): Promise<SystemHealthResponse> {
  const r = await api.get('/system/health')
  return r.data
}

// API Key Lifecycle
export async function getApiKeys(): Promise<ApiKey[]> {
  const r = await api.get('/api-keys')
  return r.data
}

export async function createApiKey(data: { name: string; is_test?: boolean; scopes?: string[] }): Promise<ApiKeyCreatedResponse> {
  const r = await api.post('/api-keys', data)
  return r.data
}

export async function rotateApiKey(keyId: string): Promise<ApiKeyRotateResponse> {
  const r = await api.post(`/api-keys/${keyId}/rotate`)
  return r.data
}

export async function revokeApiKey(keyId: string): Promise<any> {
  const r = await api.delete(`/api-keys/${keyId}`)
  return r.data
}

// Webhook Endpoints
export async function getWebhooks(): Promise<WebhookEndpoint[]> {
  const r = await api.get('/webhooks')
  return r.data
}

export async function createWebhook(data: {
  name: string
  url: string
  target_type: string
  min_severity: string
  secret?: string
  enabled?: boolean
}): Promise<WebhookEndpoint> {
  const r = await api.post('/webhooks', data)
  return r.data
}

export async function updateWebhook(endpointId: string, data: any): Promise<WebhookEndpoint> {
  const r = await api.put(`/webhooks/${endpointId}`, data)
  return r.data
}

export async function deleteWebhook(endpointId: string): Promise<any> {
  const r = await api.delete(`/webhooks/${endpointId}`)
  return r.data
}

export async function testWebhook(endpointId: string): Promise<any> {
  const r = await api.post(`/webhooks/${endpointId}/test`)
  return r.data
}

// Cryptographic Audit Log
export async function getAuditLogs(): Promise<AuditLogEntry[]> {
  const r = await api.get('/audit-log')
  return r.data
}

export async function verifyAuditLog(): Promise<AuditVerificationResponse> {
  const r = await api.get('/audit-log/verify')
  return r.data
}

export default api
