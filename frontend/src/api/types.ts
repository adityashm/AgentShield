/**
 * frontend/src/api/types.ts — TypeScript API Type Definitions for AgentShield AI.
 * Mirrors OpenAPI schema and backend SQLAlchemy models.
 */

export type UserRole = 'admin' | 'analyst' | 'viewer'

export interface User {
  id: string
  email: string
  full_name?: string | null
  role: UserRole
  org_id: string
  created_at: string
}

export interface LoginResponse {
  access_token: string
  token_type: string
  user: User
}

export interface ApiKey {
  key_id: string
  name: string
  prefix: string
  scopes: string[]
  is_test: boolean
  created_at: string
  expires_at?: string | null
  last_used_at?: string | null
  revoked_at?: string | null
  replaced_by?: string | null
}

export interface ApiKeyCreatedResponse {
  key_id: string
  name: string
  key: string
  prefix: string
  scopes: string[]
  created_at: string
}

export interface ApiKeyRotateResponse {
  old_key_id: string
  new_key: ApiKeyCreatedResponse
  grace_period_expires_at: string
}

export type AgentStatus = 'active' | 'quarantined' | 'halted' | 'idle'

export interface Agent {
  agent_id: string
  org_id: string
  name?: string | null
  framework?: string | null
  status: AgentStatus
  risk_score: number
  anomaly_score: number
  total_actions: number
  total_alerts: number
  first_seen_at: string
  last_seen_at: string
}

export interface Action {
  event_id: string
  agent_id: string
  session_id?: string | null
  action_type: string
  tool_name?: string | null
  parameters?: Record<string, any> | null
  output_excerpt?: string | null
  decision?: 'allow' | 'review' | 'deny' | null
  risk_score?: number | null
  anomaly_score?: number | null
  latency_ms?: number | null
  error?: string | null
  timestamp: string
}

export type AlertSeverity = 'critical' | 'high' | 'medium' | 'low' | 'info'
export type AlertStatus = 'open' | 'acknowledged' | 'resolved' | 'false_positive'

export interface AlertComment {
  comment_id: string
  author_id: string
  author_name?: string | null
  content: string
  created_at: string
}

export interface Alert {
  alert_id: string
  agent_id: string
  rule_id?: string | null
  severity: AlertSeverity
  title: string
  description?: string | null
  status: AlertStatus
  count: number
  first_seen_at: string
  last_seen_at: string
  mitre_technique?: string | null
  owasp_category?: string | null
  event_id?: string | null
  details?: Record<string, any> | null
  comments?: AlertComment[]
}

export interface Rule {
  rule_id: string
  name: string
  description?: string | null
  category: string
  severity: AlertSeverity
  enabled: boolean
  is_custom: boolean
  owasp_category?: string | null
  mitre_technique?: string | null
  condition: Record<string, any>
  matches?: number
}

export interface RuleTestResponse {
  matched: boolean
  decision: 'allow' | 'deny' | 'review'
  rule_id?: string | null
  reasons: string[]
  latency_ms: number
}

export interface AuditLogEntry {
  audit_id: string
  timestamp: string
  actor_type: string
  actor_id: string
  action: string
  target_type: string
  target_id: string
  details?: Record<string, any> | null
  prev_hash: string
  hash: string
}

export interface AuditVerificationResponse {
  verified: boolean
  total_records: number
  tampered_records: number
  verification_timestamp: string
  error?: string | null
}

export type WebhookTargetType = 'generic' | 'slack' | 'discord' | 'pagerduty'

export interface WebhookEndpoint {
  endpoint_id: string
  name: string
  url: string
  target_type: WebhookTargetType
  min_severity: AlertSeverity
  enabled: boolean
  has_secret: boolean
  failure_count: number
  created_at: string
  last_triggered_at?: string | null
}

export interface SystemHealthResponse {
  status: 'ok' | 'degraded' | 'error'
  database: boolean
  model_loaded: boolean
  active_agents_count: number
  total_actions_last_hour: number
  open_alerts_count: number
}
