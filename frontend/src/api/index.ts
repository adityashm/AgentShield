import axios from 'axios'

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

// Actions
export async function ingestAction(actionData: Record<string, any>) {
  const r = await api.post('/actions', actionData)
  return r.data
}

export async function bulkIngestActions(actions: any[]) {
  const r = await api.post('/actions/bulk', { actions })
  return r.data
}

// Agents
export async function getAgents() {
  const r = await api.get('/agents')
  return r.data
}

export async function getAgentActions(agentId: string, page = 1, limit = 50) {
  const r = await api.get(`/agents/${agentId}/actions`, { params: { page, limit } })
  return r.data
}

// Alerts
export async function getAlerts(params?: { severity?: string; status?: string; agentId?: string }) {
  const r = await api.get('/alerts', { params })
  return r.data
}

export async function updateAlertStatus(alertId: string, status: 'Open' | 'Acknowledged' | 'Resolved', notes?: string) {
  const r = await api.patch(`/alerts/${alertId}`, { status, notes })
  return r.data
}

// Rules
export async function getRules() {
  const r = await api.get('/rules')
  return r.data
}

export async function createRule(ruleData: any) {
  const r = await api.post('/rules', ruleData)
  return r.data
}

export async function deleteRule(ruleId: string) {
  const r = await api.delete(`/rules/${ruleId}`)
  return r.data
}

// Model Retraining
export async function retrainModel() {
  const r = await api.post('/model/retrain')
  return r.data
}

// System Telemetry & Health
export async function getSystemHealth() {
  const r = await api.get('/system/health')
  return r.data
}

export default api
