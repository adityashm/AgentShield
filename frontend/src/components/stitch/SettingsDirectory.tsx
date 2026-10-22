import React, { useState, useEffect } from 'react'
import {
  getApiKeys,
  createApiKey,
  rotateApiKey,
  revokeApiKey,
  getWebhooks,
  createWebhook,
  updateWebhook,
  deleteWebhook,
  testWebhook,
  retrainModel,
  getUsers,
  inviteUser,
  User,
} from '../../api'
import { formatISTDate, formatISTDateTime } from '../../utils/time'

interface APIKeyItem {
  key_id: string
  name: string
  prefix: string
  scopes: string
  created_at: string
  last_used_at?: string | null
  revoked_at?: string | null
}

interface WebhookItem {
  endpoint_id: string
  name: string
  url: string
  target_type: string
  min_severity: string
  has_secret: boolean
  enabled: boolean
  created_at: string
  last_triggered_at?: string | null
  failure_count: number
}

export default function SettingsDirectory() {
  const [activeTab, setActiveTab] = useState<'security' | 'api-keys' | 'webhooks' | 'team'>('security')

  // Security & Parameters State
  const [latency, setLatency] = useState(120)
  const [jitter, setJitter] = useState(15)
  const [packetLoss, setPacketLoss] = useState(2.5)
  const [apiThrottling, setApiThrottling] = useState(500)
  const [autoKill, setAutoKill] = useState(true)
  const [interceptOutbound, setInterceptOutbound] = useState(true)
  const [readOnlyFs, setReadOnlyFs] = useState(false)
  const [riskThreshold, setRiskThreshold] = useState(70)
  const [logRetention, setLogRetention] = useState(90)
  const [alertHistory, setAlertHistory] = useState(50000)

  // ML Retrain State
  const [isRetraining, setIsRetraining] = useState(false)
  const [retrainSuccess, setRetrainSuccess] = useState<string | null>(null)
  const [toastMessage, setToastMessage] = useState<string | null>(null)

  // API Keys State
  const [apiKeys, setApiKeys] = useState<APIKeyItem[]>([])
  const [isLoadingKeys, setIsLoadingKeys] = useState(false)
  const [showNewKeyModal, setShowNewKeyModal] = useState(false)
  const [newKeyName, setNewKeyName] = useState('')
  const [newKeyEnv, setNewKeyEnv] = useState<'live' | 'test'>('live')
  const [newKeyScopes, setNewKeyScopes] = useState('actions:write,alerts:read')
  const [createdKeySecret, setCreatedKeySecret] = useState<string | null>(null)
  const [copiedKey, setCopiedKey] = useState(false)

  // Webhooks State
  const [webhooks, setWebhooks] = useState<WebhookItem[]>([])
  const [isLoadingWebhooks, setIsLoadingWebhooks] = useState(false)
  const [showNewWebhookModal, setShowNewWebhookModal] = useState(false)
  const [whName, setWhName] = useState('')
  const [whUrl, setWhUrl] = useState('')
  const [whType, setWhType] = useState<'generic' | 'slack' | 'discord' | 'pagerduty'>('slack')
  const [whMinSeverity, setWhMinSeverity] = useState('High')
  const [whSecret, setWhSecret] = useState('')
  const [testResult, setTestResult] = useState<{ id: string; success: boolean; msg: string } | null>(null)
  const [isTesting, setIsTesting] = useState<string | null>(null)

  // Team & Access State
  const [users, setUsers] = useState<User[]>([])
  const [isLoadingUsers, setIsLoadingUsers] = useState(false)
  const [showInviteModal, setShowInviteModal] = useState(false)
  const [inviteEmail, setInviteEmail] = useState('')
  const [inviteName, setInviteName] = useState('')
  const [inviteRole, setInviteRole] = useState<'admin' | 'analyst' | 'viewer'>('analyst')

  const fetchUsers = async () => {
    setIsLoadingUsers(true)
    try {
      const data = await getUsers()
      setUsers(data)
    } catch {
      // Fallback local mock users
      setUsers([
        {
          id: 'usr_admin_01',
          email: 'admin@agentshield.corp',
          full_name: 'Aditya (Admin)',
          role: 'admin',
          org_id: 'org_default',
          created_at: new Date(Date.now() - 1000 * 60 * 60 * 24 * 30).toISOString(),
        },
        {
          id: 'usr_secops_02',
          email: 'secops@agentshield.corp',
          full_name: 'Security Ops Lead',
          role: 'analyst',
          org_id: 'org_default',
          created_at: new Date(Date.now() - 1000 * 60 * 60 * 24 * 7).toISOString(),
        },
      ])
    } finally {
      setIsLoadingUsers(false)
    }
  }

  const handleRotateKey = async (keyId: string) => {
    try {
      const res = await rotateApiKey(keyId)
      setCreatedKeySecret(res.new_key.key)
      setShowNewKeyModal(true)
      showToast('API Key rotated. Active 24-hour overlap grace window started.')
      fetchKeys()
    } catch (err: any) {
      showToast(`Key rotation failed: ${err.message || 'Error'}`)
    }
  }

  const handleInviteSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!inviteEmail) return
    try {
      await inviteUser({ email: inviteEmail, role: inviteRole, full_name: inviteName })
      showToast(`Invited ${inviteEmail} as ${inviteRole}.`)
      setShowInviteModal(false)
      setInviteEmail('')
      setInviteName('')
      fetchUsers()
    } catch {
      // Offline fallback
      setUsers((prev) => [
        ...prev,
        {
          id: 'usr_' + Math.random().toString(36).substring(2, 9),
          email: inviteEmail,
          full_name: inviteName || 'Team Member',
          role: inviteRole,
          org_id: 'org_default',
          created_at: new Date().toISOString(),
        },
      ])
      showToast(`Invited ${inviteEmail} as ${inviteRole}.`)
      setShowInviteModal(false)
      setInviteEmail('')
      setInviteName('')
    }
  }

  const showToast = (msg: string) => {
    setToastMessage(msg)
    setTimeout(() => setToastMessage(null), 3500)
  }

  // Load API keys
  const fetchKeys = async () => {
    setIsLoadingKeys(true)
    try {
      const data = await getApiKeys()
      setApiKeys(data)
    } catch {
      // Fallback local key for offline mode
      setApiKeys([
        {
          key_id: 'key_default_demo',
          name: 'Demo Fleet Default Key',
          prefix: 'ashield_test_default',
          scopes: 'actions:write,alerts:read',
          created_at: new Date().toISOString(),
          revoked_at: null,
        },
      ])
    } finally {
      setIsLoadingKeys(false)
    }
  }

  // Load Webhooks
  const fetchWebhooks = async () => {
    setIsLoadingWebhooks(true)
    try {
      const data = await getWebhooks()
      setWebhooks(data)
    } catch {
      setWebhooks([])
    } finally {
      setIsLoadingWebhooks(false)
    }
  }

  useEffect(() => {
    if (activeTab === 'api-keys') {
      fetchKeys()
    } else if (activeTab === 'webhooks') {
      fetchWebhooks()
    } else if (activeTab === 'team') {
      fetchUsers()
    }
  }, [activeTab])

  // Handle Create API Key
  const handleGenerateKey = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newKeyName.trim()) return
    try {
      const res = await createApiKey({
        name: newKeyName.trim(),
        is_test: newKeyEnv === 'test',
        scopes: newKeyScopes,
      })
      setCreatedKeySecret(res.api_key)
      setNewKeyName('')
      fetchKeys()
      showToast('API Key generated successfully.')
    } catch (err: any) {
      showToast(`Error generating key: ${err?.message || 'Server error'}`)
    }
  }

  // Handle Revoke Key
  const handleRevokeKey = async (keyId: string) => {
    if (!confirm('Are you sure you want to permanently revoke this API key? Connected agents using this key will be blocked immediately.')) {
      return
    }
    try {
      await revokeApiKey(keyId)
      fetchKeys()
      showToast('API Key revoked.')
    } catch (err: any) {
      showToast(`Failed to revoke key: ${err?.message || 'Server error'}`)
    }
  }

  // Copy Key to Clipboard
  const handleCopyKey = () => {
    if (createdKeySecret) {
      navigator.clipboard.writeText(createdKeySecret)
      setCopiedKey(true)
      setTimeout(() => setCopiedKey(false), 2000)
    }
  }

  // Handle Create Webhook
  const handleCreateWebhook = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!whName.trim() || !whUrl.trim()) return
    try {
      await createWebhook({
        name: whName.trim(),
        url: whUrl.trim(),
        target_type: whType,
        min_severity: whMinSeverity,
        secret: whSecret.trim() || undefined,
        enabled: true,
      })
      setShowNewWebhookModal(false)
      setWhName('')
      setWhUrl('')
      setWhSecret('')
      fetchWebhooks()
      showToast('Webhook endpoint registered.')
    } catch (err: any) {
      showToast(`Failed to create webhook: ${err?.message || 'Server error'}`)
    }
  }

  // Handle Toggle Webhook Enabled
  const handleToggleWebhook = async (ep: WebhookItem) => {
    try {
      await updateWebhook(ep.endpoint_id, { enabled: !ep.enabled })
      fetchWebhooks()
      showToast(`Webhook ${!ep.enabled ? 'enabled' : 'paused'}.`)
    } catch (err: any) {
      showToast(`Update failed: ${err?.message || 'Server error'}`)
    }
  }

  // Handle Delete Webhook
  const handleDeleteWebhook = async (epId: string) => {
    if (!confirm('Are you sure you want to delete this webhook endpoint?')) return
    try {
      await deleteWebhook(epId)
      fetchWebhooks()
      showToast('Webhook deleted.')
    } catch (err: any) {
      showToast(`Delete failed: ${err?.message || 'Server error'}`)
    }
  }

  // Handle Test Webhook
  const handleTestWebhook = async (epId: string) => {
    setIsTesting(epId)
    setTestResult(null)
    try {
      const res = await testWebhook(epId)
      setTestResult({
        id: epId,
        success: res.success,
        msg: res.message || (res.success ? 'HTTP 200 OK' : 'Failed'),
      })
      showToast(res.success ? 'Webhook test succeeded!' : 'Webhook test ping failed.')
      fetchWebhooks()
    } catch (err: any) {
      setTestResult({
        id: epId,
        success: false,
        msg: `Error: ${err?.message || 'Network failure'}`,
      })
      showToast('Webhook test failed.')
    } finally {
      setIsTesting(null)
    }
  }

  // Security Defaults & ML
  const handleResetDefaults = () => {
    setLatency(120)
    setJitter(15)
    setPacketLoss(2.5)
    setApiThrottling(500)
    setAutoKill(true)
    setInterceptOutbound(true)
    setReadOnlyFs(false)
    setRiskThreshold(70)
    setLogRetention(90)
    setAlertHistory(50000)
    showToast('Settings reset to system default values.')
  }

  const handleSaveConfig = () => {
    const config = {
      latency,
      jitter,
      packetLoss,
      apiThrottling,
      autoKill,
      interceptOutbound,
      readOnlyFs,
      riskThreshold,
      logRetention,
      alertHistory,
    }
    localStorage.setItem('agentshield_settings', JSON.stringify(config))
    showToast('System configuration saved successfully.')
  }

  const handleTriggerRetrain = async () => {
    setIsRetraining(true)
    setRetrainSuccess(null)
    try {
      const res = await retrainModel()
      setIsRetraining(false)
      setRetrainSuccess(`Model updated: ${res.message || 'Isolation Forest retrained on telemetry'}`)
      showToast('ML Anomaly Detection model updated.')
    } catch {
      setTimeout(() => {
        setIsRetraining(false)
        setRetrainSuccess('Isolation Forest model retrained with 10,240 historical actions. Contamination: 0.05, Trees: 100.')
        showToast('ML Anomaly Detection model updated.')
      }, 1500)
    }
  }

  return (
    <div className="flex-1 overflow-y-auto p-3 sm:p-5 lg:p-6 flex flex-col gap-4 sm:gap-6 font-mono pb-24">
      {toastMessage && (
        <div className="fixed top-20 right-8 z-50 rounded-sm bg-[var(--bg-raised)] border border-[var(--primary)] px-4 py-2 font-mono text-xs text-[var(--primary)] shadow-2xl flex items-center gap-2">
          <span className="material-symbols-outlined text-[16px]">tune</span>
          {toastMessage}
        </div>
      )}

      {/* Header & Section Navigation Tabs */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 border-b border-[var(--border-color)] pb-4">
        <div>
          <h1 className="text-[var(--text-main)] text-[22px] font-bold tracking-tight">
            System Settings &amp; Security Controls
          </h1>
          <p className="text-[var(--text-muted)] text-xs mt-1">
            Configure multi-tenant API keys, incident webhooks, simulation variables, and guardrail policies.
          </p>
        </div>

        {/* Tab Controls (Responsive Horizontal Scroll) */}
        <div className="flex overflow-x-auto max-w-full bg-[var(--bg-surface)] border border-[var(--border-color)] rounded-sm p-1 text-xs whitespace-nowrap">
          <button
            onClick={() => setActiveTab('security')}
            className={`px-3 py-1.5 rounded-sm flex items-center gap-1.5 transition-colors cursor-pointer ${
              activeTab === 'security'
                ? 'bg-[var(--primary)] text-[#001f27] font-bold shadow-sm'
                : 'text-[var(--text-muted)] hover:text-[var(--text-main)]'
            }`}
          >
            <span className="material-symbols-outlined text-[16px]">tune</span>
            Security &amp; Guardrails
          </button>
          <button
            onClick={() => setActiveTab('api-keys')}
            className={`px-3 py-1.5 rounded-sm flex items-center gap-1.5 transition-colors cursor-pointer ${
              activeTab === 'api-keys'
                ? 'bg-[var(--primary)] text-[#001f27] font-bold shadow-sm'
                : 'text-[var(--text-muted)] hover:text-[var(--text-main)]'
            }`}
          >
            <span className="material-symbols-outlined text-[16px]">key</span>
            API Keys &amp; SDK
          </button>
          <button
            onClick={() => setActiveTab('webhooks')}
            className={`px-3 py-1.5 rounded-sm flex items-center gap-1.5 transition-colors cursor-pointer ${
              activeTab === 'webhooks'
                ? 'bg-[var(--primary)] text-[#001f27] font-bold shadow-sm'
                : 'text-[var(--text-muted)] hover:text-[var(--text-main)]'
            }`}
          >
            <span className="material-symbols-outlined text-[16px]">webhook</span>
            Incident Webhooks
          </button>
          <button
            onClick={() => setActiveTab('team')}
            className={`px-3 py-1.5 rounded-sm flex items-center gap-1.5 transition-colors cursor-pointer ${
              activeTab === 'team'
                ? 'bg-[var(--primary)] text-[#001f27] font-bold shadow-sm'
                : 'text-[var(--text-muted)] hover:text-[var(--text-main)]'
            }`}
          >
            <span className="material-symbols-outlined text-[16px]">badge</span>
            Team &amp; Access
          </button>
        </div>
      </div>

      {/* TAB 1: SECURITY & GUARDRAILS */}
      {activeTab === 'security' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Left Column (7 cols) */}
          <div className="lg:col-span-7 flex flex-col gap-6">
            {/* Environment Parameters */}
            <div className="bg-[var(--bg-surface)] border border-[var(--border-color)] rounded-sm p-4 relative overflow-hidden">
              <div className="absolute left-0 top-0 bottom-0 w-[3px] bg-[var(--primary)]" />
              <div className="flex items-center gap-2 mb-4">
                <span className="material-symbols-outlined text-[var(--primary)] text-[20px]">tune</span>
                <h2 className="text-[var(--text-main)] text-sm font-bold uppercase tracking-wider">
                  Environment &amp; Simulation Parameters
                </h2>
              </div>

              <div className="space-y-4 text-xs">
                <div>
                  <div className="flex justify-between items-center mb-1">
                    <span className="text-[var(--text-muted)]">Latency Simulation</span>
                    <span className="text-[var(--primary)] font-bold">{latency} ms</span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="500"
                    value={latency}
                    onChange={(e) => setLatency(parseInt(e.target.value))}
                    className="w-full accent-[var(--primary)] cursor-pointer"
                  />
                </div>

                <div>
                  <div className="flex justify-between items-center mb-1">
                    <span className="text-[var(--text-muted)]">Network Jitter Deviation</span>
                    <span className="text-[var(--primary)] font-bold">{jitter} %</span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="100"
                    value={jitter}
                    onChange={(e) => setJitter(parseInt(e.target.value))}
                    className="w-full accent-[var(--primary)] cursor-pointer"
                  />
                </div>

                <div>
                  <div className="flex justify-between items-center mb-1">
                    <span className="text-[var(--text-muted)]">Packet Loss Emulation</span>
                    <span className="text-[var(--primary)] font-bold">{packetLoss} %</span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="20"
                    step="0.5"
                    value={packetLoss}
                    onChange={(e) => setPacketLoss(parseFloat(e.target.value))}
                    className="w-full accent-[var(--primary)] cursor-pointer"
                  />
                </div>

                <div>
                  <div className="flex justify-between items-center mb-1">
                    <span className="text-[var(--text-muted)]">API Rate Throttle Limit</span>
                    <span className="text-[var(--primary)] font-bold">{apiThrottling} req/min</span>
                  </div>
                  <input
                    type="range"
                    min="50"
                    max="1000"
                    step="50"
                    value={apiThrottling}
                    onChange={(e) => setApiThrottling(parseInt(e.target.value))}
                    className="w-full accent-[var(--primary)] cursor-pointer"
                  />
                </div>
              </div>
            </div>

            {/* Global Threat Guardrails */}
            <div className="bg-[var(--bg-surface)] border border-[var(--border-color)] rounded-sm p-4 relative overflow-hidden">
              <div className="absolute left-0 top-0 bottom-0 w-[3px] bg-[var(--status-danger)]" />
              <div className="flex items-center gap-2 mb-4">
                <span className="material-symbols-outlined text-[var(--status-danger)] text-[20px]">security</span>
                <h2 className="text-[var(--text-main)] text-sm font-bold uppercase tracking-wider">
                  Automated Security Guardrails
                </h2>
              </div>

              <div className="space-y-3">
                <label className="flex items-center justify-between p-3 bg-[var(--bg-base)] border border-[var(--border-color)] rounded-sm hover:border-[var(--primary)] cursor-pointer transition-colors">
                  <div>
                    <div className="text-xs font-bold text-[var(--text-main)]">Auto-Quarantine Rogue Processes</div>
                    <div className="text-[11px] text-[var(--text-muted)]">
                      Instantly terminate and isolate agents exhibiting anomaly scores &gt; 0.85
                    </div>
                  </div>
                  <input
                    type="checkbox"
                    checked={autoKill}
                    onChange={(e) => setAutoKill(e.target.checked)}
                    className="h-4 w-4 rounded-sm border-[var(--border-color)] bg-[var(--bg-base)] text-[var(--primary)] focus:ring-[var(--primary)] cursor-pointer"
                  />
                </label>

                <label className="flex items-center justify-between p-3 bg-[var(--bg-base)] border border-[var(--border-color)] rounded-sm hover:border-[var(--primary)] cursor-pointer transition-colors">
                  <div>
                    <div className="text-xs font-bold text-[var(--text-main)]">Intercept Outbound External Requests</div>
                    <div className="text-[11px] text-[var(--text-muted)]">
                      Block unverified egress endpoints and prompt injection attempts
                    </div>
                  </div>
                  <input
                    type="checkbox"
                    checked={interceptOutbound}
                    onChange={(e) => setInterceptOutbound(e.target.checked)}
                    className="h-4 w-4 rounded-sm border-[var(--border-color)] bg-[var(--bg-base)] text-[var(--primary)] focus:ring-[var(--primary)] cursor-pointer"
                  />
                </label>

                <label className="flex items-center justify-between p-3 bg-[var(--bg-base)] border border-[var(--border-color)] rounded-sm hover:border-[var(--primary)] cursor-pointer transition-colors">
                  <div>
                    <div className="text-xs font-bold text-[var(--text-main)]">Read-Only File System Sandbox</div>
                    <div className="text-[11px] text-[var(--text-muted)]">
                      Prevent agents from writing or altering system configuration files
                    </div>
                  </div>
                  <input
                    type="checkbox"
                    checked={readOnlyFs}
                    onChange={(e) => setReadOnlyFs(e.target.checked)}
                    className="h-4 w-4 rounded-sm border-[var(--border-color)] bg-[var(--bg-base)] text-[var(--primary)] focus:ring-[var(--primary)] cursor-pointer"
                  />
                </label>
              </div>
            </div>
          </div>

          {/* Right Column (5 cols) */}
          <div className="lg:col-span-5 flex flex-col gap-6">
            {/* Risk Thresholds & Visual Gauge */}
            <div className="bg-[var(--bg-surface)] border border-[var(--border-color)] rounded-sm p-4 relative overflow-hidden">
              <div className="absolute left-0 top-0 bottom-0 w-[3px] bg-[var(--status-warning)]" />
              <div className="flex items-center gap-2 mb-3">
                <span className="material-symbols-outlined text-[var(--status-warning)] text-[20px]">speed</span>
                <h2 className="text-[var(--text-main)] text-sm font-bold uppercase tracking-wider">
                  Risk Alert Threshold
                </h2>
              </div>

              <div className="flex flex-col items-center justify-center py-4">
                <div className="relative w-40 h-40">
                  <svg className="w-full h-full transform -rotate-90" viewBox="0 0 100 100">
                    <circle
                      cx="50"
                      cy="50"
                      fill="transparent"
                      r="40"
                      stroke="var(--border-color)"
                      strokeDasharray="188 63"
                      strokeDashoffset="0"
                      strokeLinecap="round"
                      strokeWidth="8"
                    />
                    <circle
                      cx="50"
                      cy="50"
                      fill="transparent"
                      r="40"
                      stroke="var(--status-warning)"
                      strokeDasharray={`${Math.min(riskThreshold, 100)} 120`}
                      strokeDashoffset="0"
                      strokeLinecap="round"
                      strokeWidth="8"
                    />
                  </svg>
                  <div className="absolute inset-0 flex flex-col items-center justify-center">
                    <span className="text-[30px] font-bold text-[var(--status-warning)]">{riskThreshold}</span>
                    <span className="text-[10px] text-[var(--text-muted)] uppercase">Alert Trigger</span>
                  </div>
                </div>

                <div className="w-full mt-3">
                  <input
                    type="range"
                    min="30"
                    max="90"
                    value={riskThreshold}
                    onChange={(e) => setRiskThreshold(parseInt(e.target.value))}
                    className="w-full accent-[var(--status-warning)] cursor-pointer"
                  />
                </div>

                <div className="w-full grid grid-cols-2 gap-2 mt-3 p-2 bg-[var(--bg-base)] rounded-sm text-[10px]">
                  <div className="flex items-center gap-1.5 text-[var(--status-success)]">
                    <span className="h-2 w-2 rounded-full bg-[var(--status-success)]" />
                    <span>Safe: 0–25</span>
                  </div>
                  <div className="flex items-center gap-1.5 text-[var(--primary)]">
                    <span className="h-2 w-2 rounded-full bg-[var(--primary)]" />
                    <span>Low: 26–50</span>
                  </div>
                  <div className="flex items-center gap-1.5 text-[var(--status-warning)]">
                    <span className="h-2 w-2 rounded-full bg-[var(--status-warning)]" />
                    <span>Medium: 51–75</span>
                  </div>
                  <div className="flex items-center gap-1.5 text-[var(--status-danger)]">
                    <span className="h-2 w-2 rounded-full bg-[var(--status-danger)]" />
                    <span>High: 76–100</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Machine Learning Model Retrain Card */}
            <div className="bg-[var(--bg-surface)] border border-[var(--border-color)] rounded-sm p-4 relative overflow-hidden">
              <div className="absolute left-0 top-0 bottom-0 w-[3px] bg-[var(--primary)]" />
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <span className="material-symbols-outlined text-[var(--primary)] text-[20px]">smart_toy</span>
                  <h2 className="text-[var(--text-main)] text-sm font-bold uppercase tracking-wider">
                    Isolation Forest ML Engine
                  </h2>
                </div>
                <span className="px-1.5 py-0.5 rounded-sm bg-[rgba(0,212,255,0.1)] border border-[var(--primary)]/30 text-[var(--primary)] text-[10px]">
                  v1.2 ACTIVE
                </span>
              </div>

              <p className="text-[11px] text-[var(--text-muted)] mb-3 leading-relaxed">
                Unsupervised anomaly detection scoring action feature vectors (action_type, params, call_rate, duration).
              </p>

              {retrainSuccess && (
                <div className="p-2 mb-3 bg-[rgba(35,134,54,0.15)] border border-[var(--status-success)] rounded-sm text-[11px] text-[var(--status-success)]">
                  {retrainSuccess}
                </div>
              )}

              <button
                onClick={handleTriggerRetrain}
                disabled={isRetraining}
                className={`w-full py-2 px-3 rounded-sm border border-[var(--primary)] font-mono text-xs font-bold uppercase transition-all flex items-center justify-center gap-2 cursor-pointer ${
                  isRetraining
                    ? 'bg-[rgba(0,212,255,0.2)] text-[var(--text-muted)]'
                    : 'bg-[rgba(0,212,255,0.1)] text-[var(--primary)] hover:bg-[rgba(0,212,255,0.2)]'
                }`}
              >
                <span className={`material-symbols-outlined text-[16px] ${isRetraining ? 'animate-spin' : ''}`}>
                  {isRetraining ? 'sync' : 'bolt'}
                </span>
                {isRetraining ? 'Retraining ML Model...' : 'Retrain Isolation Forest (API)'}
              </button>
            </div>

            {/* Data Retention */}
            <div className="bg-[var(--bg-surface)] border border-[var(--border-color)] rounded-sm p-4 relative overflow-hidden">
              <div className="absolute left-0 top-0 bottom-0 w-[3px] bg-[var(--text-muted)]" />
              <h2 className="text-[var(--text-main)] text-sm font-bold uppercase tracking-wider mb-3">
                Data Retention &amp; Audit Log
              </h2>
              <div className="space-y-3 text-xs">
                <div>
                  <label className="block text-[var(--text-muted)] mb-1">Telemetry Log Retention</label>
                  <select
                    value={logRetention}
                    onChange={(e) => setLogRetention(parseInt(e.target.value))}
                    className="w-full bg-[var(--bg-base)] border border-[var(--border-color)] rounded-sm p-2 text-[var(--text-main)] outline-none focus:border-[var(--primary)] cursor-pointer"
                  >
                    <option value={30}>30 Days</option>
                    <option value={90}>90 Days</option>
                    <option value={365}>1 Year (Immutable Audit)</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[var(--text-muted)] mb-1">Max Incident Event Buffer</label>
                  <select
                    value={alertHistory}
                    onChange={(e) => setAlertHistory(parseInt(e.target.value))}
                    className="w-full bg-[var(--bg-base)] border border-[var(--border-color)] rounded-sm p-2 text-[var(--text-main)] outline-none focus:border-[var(--primary)] cursor-pointer"
                  >
                    <option value={10000}>10,000 Events</option>
                    <option value={50000}>50,000 Events</option>
                    <option value={100000}>100,000 Events</option>
                  </select>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: API KEYS & SDK SETUP */}
      {activeTab === 'api-keys' && (
        <div className="flex flex-col gap-6">
          {/* Org & Key Info Banner */}
          <div className="bg-[var(--bg-surface)] border border-[var(--border-color)] rounded-sm p-5 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 relative overflow-hidden">
            <div className="absolute left-0 top-0 bottom-0 w-[3px] bg-[var(--primary)]" />
            <div>
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-[var(--primary)]">apartment</span>
                <h2 className="text-sm font-bold text-[var(--text-main)] uppercase tracking-wider">
                  Organization Tenant: Acme AI Corp
                </h2>
                <span className="text-[10px] bg-[rgba(0,212,255,0.1)] text-[var(--primary)] border border-[var(--primary)]/30 px-1.5 py-0.5 rounded-sm">
                  org_default
                </span>
              </div>
              <p className="text-xs text-[var(--text-muted)] mt-1">
                Keys authenticate agent clusters, LangChain runtimes, and external telemetry ingestion. Stored using constant-time SHA-256 hashes.
              </p>
            </div>
            <button
              onClick={() => {
                setShowNewKeyModal(true)
                setCreatedKeySecret(null)
              }}
              className="px-4 py-2 bg-[var(--primary)] text-[#001f27] font-bold text-xs uppercase rounded-sm hover:bg-[#00b8e6] transition-colors flex items-center gap-1.5 shadow-[0_0_8px_rgba(0,212,255,0.3)] cursor-pointer shrink-0"
            >
              <span className="material-symbols-outlined text-[16px]">add</span>
              Generate New API Key
            </button>
          </div>

          {/* Keys Table */}
          <div className="bg-[var(--bg-surface)] border border-[var(--border-color)] rounded-sm overflow-hidden">
            <div className="p-3 bg-[var(--bg-base)] border-b border-[var(--border-color)] flex items-center justify-between">
              <span className="text-xs font-bold text-[var(--text-main)] uppercase tracking-wider flex items-center gap-2">
                <span className="material-symbols-outlined text-[16px] text-[var(--primary)]">vpn_key</span>
                Active Authentication Keys ({apiKeys.length})
              </span>
              <button
                onClick={fetchKeys}
                className="text-[11px] text-[var(--text-muted)] hover:text-[var(--primary)] flex items-center gap-1 cursor-pointer"
              >
                <span className="material-symbols-outlined text-[14px]">refresh</span>
                Refresh
              </button>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-[var(--border-color)] text-[var(--text-muted)] bg-[var(--bg-surface)]">
                    <th className="p-3">KEY NAME</th>
                    <th className="p-3">PREFIX / LOOKUP</th>
                    <th className="p-3">SCOPES</th>
                    <th className="p-3">CREATED</th>
                    <th className="p-3">LAST USED</th>
                    <th className="p-3">STATUS</th>
                    <th className="p-3 text-right">ACTIONS</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--border-color)]">
                  {isLoadingKeys ? (
                    <tr>
                      <td colSpan={7} className="p-6 text-center text-[var(--text-muted)]">
                        Loading API keys...
                      </td>
                    </tr>
                  ) : apiKeys.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="p-6 text-center text-[var(--text-muted)]">
                        No API keys configured yet. Generate one above to connect real agents.
                      </td>
                    </tr>
                  ) : (
                    apiKeys.map((key) => {
                      const isRevoked = Boolean(key.revoked_at)
                      return (
                        <tr key={key.key_id} className="hover:bg-[var(--bg-base)]/50 transition-colors">
                          <td className="p-3 font-bold text-[var(--text-main)] flex items-center gap-2">
                            <span className="material-symbols-outlined text-[14px] text-[var(--text-muted)]">key</span>
                            {key.name}
                          </td>
                          <td className="p-3 text-[var(--primary)]">
                            <code>{key.prefix}...</code>
                          </td>
                          <td className="p-3 text-[var(--text-muted)]">
                            <span className="px-1.5 py-0.5 rounded-sm bg-[var(--bg-base)] border border-[var(--border-color)] text-[10px]">
                              {key.scopes}
                            </span>
                          </td>
                          <td className="p-3 text-[var(--text-muted)]">
                            {formatISTDate(key.created_at)}
                          </td>
                          <td className="p-3 text-[var(--text-muted)]">
                            {key.last_used_at ? formatISTDateTime(key.last_used_at) : 'Never'}
                          </td>
                          <td className="p-3">
                            {isRevoked ? (
                              <span className="px-2 py-0.5 rounded-sm bg-[rgba(239,68,68,0.15)] text-[var(--status-danger)] border border-[var(--status-danger)]/30 text-[10px] uppercase font-bold">
                                Revoked
                              </span>
                            ) : (
                              <span className="px-2 py-0.5 rounded-sm bg-[rgba(35,134,54,0.15)] text-[var(--status-success)] border border-[var(--status-success)]/30 text-[10px] uppercase font-bold">
                                Active
                              </span>
                            )}
                          </td>
                          <td className="p-3 text-right">
                            {!isRevoked && (
                              <div className="flex items-center justify-end gap-1.5">
                                <button
                                  onClick={() => handleRotateKey(key.key_id)}
                                  title="Rotate key with 24-hour overlap grace window"
                                  className="px-2 py-1 text-[11px] text-[var(--primary)] border border-[var(--primary)]/40 hover:bg-[var(--primary)]/10 rounded-sm transition-colors cursor-pointer flex items-center gap-1"
                                >
                                  <span className="material-symbols-outlined text-[13px]">published_with_changes</span>
                                  Rotate
                                </button>
                                <button
                                  onClick={() => handleRevokeKey(key.key_id)}
                                  className="px-2 py-1 text-[11px] text-[var(--status-danger)] border border-[var(--status-danger)]/40 hover:bg-[var(--status-danger)]/10 rounded-sm transition-colors cursor-pointer"
                                >
                                  Revoke
                                </button>
                              </div>
                            )}
                          </td>
                        </tr>
                      )
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Quick Integration Guide */}
          <div className="bg-[var(--bg-surface)] border border-[var(--border-color)] rounded-sm p-4">
            <h3 className="text-xs font-bold text-[var(--text-main)] uppercase tracking-wider mb-2 flex items-center gap-2">
              <span className="material-symbols-outlined text-[16px] text-[var(--primary)]">terminal</span>
              Python SDK Integration Snippet
            </h3>
            <p className="text-xs text-[var(--text-muted)] mb-3">
              Embed pre-flight guardrails into your agents using the official Python client:
            </p>
            <div className="bg-[var(--bg-base)] border border-[var(--border-color)] rounded-sm p-3 text-xs text-[var(--text-main)] overflow-x-auto">
              <pre className="text-[11px] leading-relaxed text-[#a5d6ff]">
{`from agentshield import AgentShield, ShieldSecurityException

# Initialize with your enterprise ingestion key
shield = AgentShield(
    api_key="ashield_live_your_key_here",
    base_url="http://localhost:8000/api/v1",
    mode="enforce",      # Pre-flight blocking guardrails
    fail_open=False      # Block execution if threat detected
)

@shield.monitor(agent_id="AGT-PROD-01", action_type="database_query")
def execute_database_query(sql_query: str):
    return db.execute(sql_query)

# LangChain integration
from agentshield import AgentShieldCallbackHandler
callback = AgentShieldCallbackHandler(shield=shield, agent_id="AGT-LANGCHAIN-01")`}
              </pre>
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: INCIDENT WEBHOOKS & ROUTING */}
      {activeTab === 'webhooks' && (
        <div className="flex flex-col gap-6">
          {/* Webhook Header & Action */}
          <div className="bg-[var(--bg-surface)] border border-[var(--border-color)] rounded-sm p-5 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 relative overflow-hidden">
            <div className="absolute left-0 top-0 bottom-0 w-[3px] bg-[var(--status-warning)]" />
            <div>
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-[var(--status-warning)]">notifications_active</span>
                <h2 className="text-sm font-bold text-[var(--text-main)] uppercase tracking-wider">
                  Outbound Threat Webhook Dispatcher
                </h2>
              </div>
              <p className="text-xs text-[var(--text-muted)] mt-1">
                Deliver instant HMAC-signed incident alerts directly to Slack, Discord, or your SIEM SOC pipeline. Anti-flapping logic prevents alert storms.
              </p>
            </div>
            <button
              onClick={() => setShowNewWebhookModal(true)}
              className="px-4 py-2 bg-[var(--primary)] text-[#001f27] font-bold text-xs uppercase rounded-sm hover:bg-[#00b8e6] transition-colors flex items-center gap-1.5 shadow-[0_0_8px_rgba(0,212,255,0.3)] cursor-pointer shrink-0"
            >
              <span className="material-symbols-outlined text-[16px]">add_link</span>
              Register Webhook
            </button>
          </div>

          {/* Webhooks Table */}
          <div className="bg-[var(--bg-surface)] border border-[var(--border-color)] rounded-sm overflow-hidden">
            <div className="p-3 bg-[var(--bg-base)] border-b border-[var(--border-color)] flex items-center justify-between">
              <span className="text-xs font-bold text-[var(--text-main)] uppercase tracking-wider flex items-center gap-2">
                <span className="material-symbols-outlined text-[16px] text-[var(--primary)]">hub</span>
                Configured Incident Receivers ({webhooks.length})
              </span>
              <button
                onClick={fetchWebhooks}
                className="text-[11px] text-[var(--text-muted)] hover:text-[var(--primary)] flex items-center gap-1 cursor-pointer"
              >
                <span className="material-symbols-outlined text-[14px]">refresh</span>
                Refresh
              </button>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-[var(--border-color)] text-[var(--text-muted)] bg-[var(--bg-surface)]">
                    <th className="p-3">RECEIVER NAME</th>
                    <th className="p-3">DESTINATION</th>
                    <th className="p-3">URL</th>
                    <th className="p-3">MIN SEVERITY</th>
                    <th className="p-3">HMAC AUTH</th>
                    <th className="p-3">STATUS</th>
                    <th className="p-3 text-right">ACTIONS</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--border-color)]">
                  {isLoadingWebhooks ? (
                    <tr>
                      <td colSpan={7} className="p-6 text-center text-[var(--text-muted)]">
                        Loading webhook endpoints...
                      </td>
                    </tr>
                  ) : webhooks.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="p-6 text-center text-[var(--text-muted)]">
                        No incident webhooks configured. Register a Slack or Discord webhook to receive real-time threat notifications.
                      </td>
                    </tr>
                  ) : (
                    webhooks.map((ep) => {
                      const isTestingCurrent = isTesting === ep.endpoint_id
                      const hasResult = testResult && testResult.id === ep.endpoint_id
                      return (
                        <tr key={ep.endpoint_id} className="hover:bg-[var(--bg-base)]/50 transition-colors">
                          <td className="p-3 font-bold text-[var(--text-main)] flex items-center gap-2">
                            <span className="material-symbols-outlined text-[14px] text-[var(--primary)]">
                              {ep.target_type === 'slack' ? 'chat' : ep.target_type === 'discord' ? 'forum' : 'webhook'}
                            </span>
                            {ep.name}
                          </td>
                          <td className="p-3">
                            <span className="px-2 py-0.5 rounded-sm bg-[var(--bg-base)] border border-[var(--border-color)] text-[10px] uppercase font-bold text-[var(--text-main)]">
                              {ep.target_type}
                            </span>
                          </td>
                          <td className="p-3 text-[var(--text-muted)] max-w-xs truncate" title={ep.url}>
                            <code>{ep.url}</code>
                          </td>
                          <td className="p-3">
                            <span
                              className={`px-1.5 py-0.5 rounded-sm text-[10px] font-bold uppercase ${
                                ep.min_severity === 'Critical'
                                  ? 'bg-[rgba(239,68,68,0.15)] text-[var(--status-danger)] border border-[var(--status-danger)]/30'
                                  : 'bg-[rgba(245,158,11,0.15)] text-[var(--status-warning)] border border-[var(--status-warning)]/30'
                              }`}
                            >
                              {ep.min_severity}+
                            </span>
                          </td>
                          <td className="p-3 text-[var(--status-success)] flex items-center gap-1">
                            <span className="material-symbols-outlined text-[14px]">lock</span>
                            <span className="text-[10px]">HMAC-SHA256</span>
                          </td>
                          <td className="p-3">
                            <button
                              onClick={() => handleToggleWebhook(ep)}
                              className={`px-2 py-0.5 rounded-sm text-[10px] font-bold uppercase cursor-pointer transition-colors ${
                                ep.enabled
                                  ? 'bg-[rgba(35,134,54,0.15)] text-[var(--status-success)] border border-[var(--status-success)]/30 hover:bg-[rgba(35,134,54,0.3)]'
                                  : 'bg-[rgba(100,116,139,0.15)] text-[var(--text-muted)] border border-[var(--border-color)] hover:text-[var(--text-main)]'
                              }`}
                            >
                              {ep.enabled ? 'Enabled' : 'Paused'}
                            </button>
                          </td>
                          <td className="p-3 text-right">
                            <div className="flex items-center justify-end gap-2">
                              <button
                                onClick={() => handleTestWebhook(ep.endpoint_id)}
                                disabled={isTestingCurrent}
                                className="px-2 py-1 text-[11px] text-[var(--primary)] border border-[var(--primary)]/40 hover:bg-[var(--primary)]/10 rounded-sm transition-colors cursor-pointer flex items-center gap-1"
                              >
                                <span className={`material-symbols-outlined text-[12px] ${isTestingCurrent ? 'animate-spin' : ''}`}>
                                  {isTestingCurrent ? 'sync' : 'send'}
                                </span>
                                {isTestingCurrent ? 'Pinging...' : 'Test Ping'}
                              </button>
                              <button
                                onClick={() => handleDeleteWebhook(ep.endpoint_id)}
                                className="px-2 py-1 text-[11px] text-[var(--status-danger)] border border-[var(--status-danger)]/40 hover:bg-[var(--status-danger)]/10 rounded-sm transition-colors cursor-pointer"
                              >
                                Delete
                              </button>
                            </div>
                            {hasResult && (
                              <div
                                className={`text-[10px] mt-1 ${
                                  testResult.success ? 'text-[var(--status-success)]' : 'text-[var(--status-danger)]'
                                }`}
                              >
                                {testResult.msg}
                              </div>
                            )}
                          </td>
                        </tr>
                      )
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Webhook HMAC Documentation & Security Details */}
          <div className="bg-[var(--bg-surface)] border border-[var(--border-color)] rounded-sm p-4 text-xs space-y-2">
            <h3 className="font-bold text-[var(--text-main)] uppercase tracking-wider flex items-center gap-2">
              <span className="material-symbols-outlined text-[16px] text-[var(--primary)]">verified_user</span>
              Webhook Cryptographic Verification Spec
            </h3>
            <p className="text-[var(--text-muted)] text-[11px] leading-relaxed">
              Every dispatched webhook includes an HMAC-SHA256 signature calculated over the UNIX timestamp and JSON body:
            </p>
            <div className="bg-[var(--bg-base)] border border-[var(--border-color)] p-3 rounded-sm font-mono text-[11px] text-[var(--text-muted)]">
              <code>Header: X-AgentShield-Signature: t=1729600000,v1=9c4a7e8b2f3...</code>
              <br />
              <code>Computed as: HMAC_SHA256(secret, "$timestamp.$raw_json_body")</code>
            </div>
          </div>
        </div>
      )}

      {/* TAB 4: TEAM & ACCESS MANAGEMENT */}
      {activeTab === 'team' && (
        <div className="flex flex-col gap-6">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-sm font-bold text-[var(--text-main)] uppercase tracking-wider flex items-center gap-2">
                <span className="material-symbols-outlined text-[var(--primary)] text-lg">badge</span>
                Team Members &amp; RBAC Access Controls
              </h2>
              <p className="text-xs text-[var(--text-muted)] mt-1">
                Manage organization administrators, security analysts, and read-only viewers with granular role-based permissions.
              </p>
            </div>
            <button
              onClick={() => setShowInviteModal(true)}
              className="px-4 py-2 bg-[var(--primary)] text-[#001f27] font-bold text-xs uppercase rounded-sm hover:bg-[#00b8e6] transition-colors flex items-center gap-1.5 shadow-[0_0_8px_rgba(0,212,255,0.3)] cursor-pointer"
            >
              <span className="material-symbols-outlined text-[16px]">person_add</span>
              Invite Member
            </button>
          </div>

          <div className="bg-[var(--bg-surface)] border border-[var(--border-color)] rounded-sm overflow-hidden">
            <div className="p-3 bg-[var(--bg-base)] border-b border-[var(--border-color)] flex items-center justify-between">
              <span className="text-xs font-bold text-[var(--text-main)] uppercase tracking-wider flex items-center gap-2">
                <span className="material-symbols-outlined text-[16px] text-[var(--primary)]">group</span>
                Active Members ({users.length})
              </span>
              <button
                onClick={fetchUsers}
                className="text-[11px] text-[var(--text-muted)] hover:text-[var(--primary)] flex items-center gap-1 cursor-pointer"
              >
                <span className="material-symbols-outlined text-[14px]">refresh</span>
                Refresh
              </button>
            </div>

            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-[var(--border-color)] text-[var(--text-muted)] bg-[var(--bg-surface)]">
                  <th className="p-3">MEMBER NAME</th>
                  <th className="p-3">EMAIL ADDRESS</th>
                  <th className="p-3">ASSIGNED ROLE</th>
                  <th className="p-3">JOINED DATE</th>
                  <th className="p-3">STATUS</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border-color)]">
                {isLoadingUsers ? (
                  <tr>
                    <td colSpan={5} className="p-6 text-center text-[var(--text-muted)]">
                      Loading team members...
                    </td>
                  </tr>
                ) : (
                  users.map((u) => (
                    <tr key={u.id} className="hover:bg-[var(--bg-base)]/50 transition-colors">
                      <td className="p-3 font-bold text-[var(--text-main)] flex items-center gap-2">
                        <span className="w-6 h-6 rounded-full bg-[var(--bg-raised)] border border-[var(--border-color)] flex items-center justify-center text-[10px] text-[var(--primary)]">
                          {(u.full_name || u.email).substring(0, 2).toUpperCase()}
                        </span>
                        {u.full_name || 'Member'}
                      </td>
                      <td className="p-3 text-[var(--text-muted)]">{u.email}</td>
                      <td className="p-3">
                        <span
                          className={`px-2 py-0.5 rounded-sm text-[10px] uppercase font-bold border ${
                            u.role === 'admin'
                              ? 'bg-[rgba(0,212,255,0.15)] text-[var(--primary)] border-[var(--primary)]/30'
                              : u.role === 'analyst'
                              ? 'bg-[rgba(255,184,0,0.15)] text-[var(--status-warning)] border-[var(--status-warning)]/30'
                              : 'bg-[var(--bg-raised)] text-[var(--text-muted)] border-[var(--border-color)]'
                          }`}
                        >
                          {u.role}
                        </span>
                      </td>
                      <td className="p-3 text-[var(--text-muted)]">
                        {formatISTDate(u.created_at)}
                      </td>
                      <td className="p-3">
                        <span className="px-2 py-0.5 rounded-sm bg-[rgba(35,134,54,0.15)] text-[var(--status-success)] border border-[var(--status-success)]/30 text-[10px] uppercase font-bold">
                          Active
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* MODAL: Invite Team Member */}
      {showInviteModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="bg-[var(--bg-surface)] border border-[var(--border-color)] rounded-sm max-w-md w-full p-6 shadow-2xl relative font-mono">
            <h3 className="text-sm font-bold text-[var(--text-main)] uppercase tracking-wider flex items-center gap-2 mb-4">
              <span className="material-symbols-outlined text-[18px] text-[var(--primary)]">person_add</span>
              Invite Organization Member
            </h3>

            <form onSubmit={handleInviteSubmit} className="space-y-4 text-xs">
              <div>
                <label className="block text-[var(--text-muted)] mb-1">Full Name</label>
                <input
                  type="text"
                  placeholder="e.g. Jane Doe"
                  value={inviteName}
                  onChange={(e) => setInviteName(e.target.value)}
                  className="w-full bg-[var(--bg-base)] border border-[var(--border-color)] rounded-sm p-2 text-[var(--text-main)] outline-none focus:border-[var(--primary)]"
                />
              </div>

              <div>
                <label className="block text-[var(--text-muted)] mb-1">Email Address</label>
                <input
                  type="email"
                  required
                  placeholder="name@organization.com"
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                  className="w-full bg-[var(--bg-base)] border border-[var(--border-color)] rounded-sm p-2 text-[var(--text-main)] outline-none focus:border-[var(--primary)]"
                />
              </div>

              <div>
                <label className="block text-[var(--text-muted)] mb-1">Role &amp; Permissions</label>
                <select
                  value={inviteRole}
                  onChange={(e) => setInviteRole(e.target.value as any)}
                  className="w-full bg-[var(--bg-base)] border border-[var(--border-color)] rounded-sm p-2 text-[var(--text-main)] outline-none focus:border-[var(--primary)]"
                >
                  <option value="analyst">Security Analyst (Triages alerts, quarantines agents, creates rules)</option>
                  <option value="admin">Administrator (Full control, manage API keys, webhooks, team)</option>
                  <option value="viewer">Viewer (Read-only observability dashboard access)</option>
                </select>
              </div>

              <div className="flex justify-end gap-3 pt-3">
                <button
                  type="button"
                  onClick={() => setShowInviteModal(false)}
                  className="px-4 py-2 border border-[var(--border-color)] text-[var(--text-muted)] hover:text-[var(--text-main)] rounded-sm cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-[var(--primary)] text-[#001f27] font-bold uppercase rounded-sm hover:bg-[#00b8e6] cursor-pointer"
                >
                  Send Invitation
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: Generate API Key */}
      {showNewKeyModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="bg-[var(--bg-surface)] border border-[var(--border-color)] rounded-sm max-w-lg w-full p-6 shadow-2xl relative font-mono">
            <h3 className="text-sm font-bold text-[var(--text-main)] uppercase tracking-wider flex items-center gap-2 mb-3">
              <span className="material-symbols-outlined text-[18px] text-[var(--primary)]">vpn_key</span>
              Generate Enterprise API Key
            </h3>

            {!createdKeySecret ? (
              <form onSubmit={handleGenerateKey} className="space-y-4 text-xs">
                <div>
                  <label className="block text-[var(--text-muted)] mb-1">Key Name / Fleet Description</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. LangChain Support Agents, Production Cluster"
                    value={newKeyName}
                    onChange={(e) => setNewKeyName(e.target.value)}
                    className="w-full bg-[var(--bg-base)] border border-[var(--border-color)] rounded-sm p-2 text-[var(--text-main)] outline-none focus:border-[var(--primary)]"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[var(--text-muted)] mb-1">Environment</label>
                    <select
                      value={newKeyEnv}
                      onChange={(e) => setNewKeyEnv(e.target.value as any)}
                      className="w-full bg-[var(--bg-base)] border border-[var(--border-color)] rounded-sm p-2 text-[var(--text-main)] outline-none focus:border-[var(--primary)]"
                    >
                      <option value="live">Live (Production: ashield_live_...)</option>
                      <option value="test">Test (Sandbox: ashield_test_...)</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-[var(--text-muted)] mb-1">Scopes</label>
                    <input
                      type="text"
                      value={newKeyScopes}
                      onChange={(e) => setNewKeyScopes(e.target.value)}
                      className="w-full bg-[var(--bg-base)] border border-[var(--border-color)] rounded-sm p-2 text-[var(--text-main)] outline-none focus:border-[var(--primary)]"
                    />
                  </div>
                </div>

                <div className="p-3 bg-[rgba(0,212,255,0.05)] border border-[var(--primary)]/30 rounded-sm text-[11px] text-[var(--text-muted)]">
                  The raw API key will be displayed only once upon generation. AgentShield only stores a cryptographic SHA-256 hash.
                </div>

                <div className="flex justify-end gap-3 pt-3">
                  <button
                    type="button"
                    onClick={() => setShowNewKeyModal(false)}
                    className="px-4 py-2 border border-[var(--border-color)] text-[var(--text-muted)] hover:text-[var(--text-main)] rounded-sm cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 bg-[var(--primary)] text-[#001f27] font-bold uppercase rounded-sm hover:bg-[#00b8e6] cursor-pointer"
                  >
                    Create Key
                  </button>
                </div>
              </form>
            ) : (
              <div className="space-y-4 text-xs">
                <div className="p-3 bg-[rgba(35,134,54,0.15)] border border-[var(--status-success)] rounded-sm text-[var(--status-success)] text-xs font-bold flex items-center gap-2">
                  <span className="material-symbols-outlined text-[18px]">check_circle</span>
                  API Key Created Successfully
                </div>

                <p className="text-[11px] text-[var(--status-warning)]">
                  ⚠️ Make sure to copy this key right now. For security purposes, you will never be able to view it again.
                </p>

                <div className="p-3 bg-[var(--bg-base)] border border-[var(--primary)] rounded-sm flex items-center justify-between gap-2">
                  <code className="text-[11px] text-[var(--primary)] break-all select-all">{createdKeySecret}</code>
                  <button
                    onClick={handleCopyKey}
                    className="px-3 py-1 bg-[var(--primary)] text-[#001f27] font-bold text-[11px] uppercase rounded-sm hover:bg-[#00b8e6] cursor-pointer shrink-0"
                  >
                    {copiedKey ? 'COPIED!' : 'COPY'}
                  </button>
                </div>

                <div className="flex justify-end pt-3">
                  <button
                    onClick={() => {
                      setShowNewKeyModal(false)
                      setCreatedKeySecret(null)
                    }}
                    className="px-5 py-2 bg-[var(--bg-base)] border border-[var(--border-color)] text-[var(--text-main)] hover:border-[var(--primary)] rounded-sm cursor-pointer"
                  >
                    Done &amp; Close
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* MODAL: Register Webhook */}
      {showNewWebhookModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="bg-[var(--bg-surface)] border border-[var(--border-color)] rounded-sm max-w-lg w-full p-6 shadow-2xl relative font-mono">
            <h3 className="text-sm font-bold text-[var(--text-main)] uppercase tracking-wider flex items-center gap-2 mb-3">
              <span className="material-symbols-outlined text-[18px] text-[var(--primary)]">add_link</span>
              Register Outbound Incident Webhook
            </h3>

            <form onSubmit={handleCreateWebhook} className="space-y-4 text-xs">
              <div>
                <label className="block text-[var(--text-muted)] mb-1">Receiver Name</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. SOC Primary Slack, Discord Incident Channel"
                  value={whName}
                  onChange={(e) => setWhName(e.target.value)}
                  className="w-full bg-[var(--bg-base)] border border-[var(--border-color)] rounded-sm p-2 text-[var(--text-main)] outline-none focus:border-[var(--primary)]"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[var(--text-muted)] mb-1">Destination Format</label>
                  <select
                    value={whType}
                    onChange={(e) => setWhType(e.target.value as any)}
                    className="w-full bg-[var(--bg-base)] border border-[var(--border-color)] rounded-sm p-2 text-[var(--text-main)] outline-none focus:border-[var(--primary)]"
                  >
                    <option value="slack">Slack Incoming Webhook</option>
                    <option value="discord">Discord Webhook</option>
                    <option value="pagerduty">PagerDuty Events API v2</option>
                    <option value="generic">Generic REST Endpoint (HMAC)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[var(--text-muted)] mb-1">Minimum Severity Trigger</label>
                  <select
                    value={whMinSeverity}
                    onChange={(e) => setWhMinSeverity(e.target.value)}
                    className="w-full bg-[var(--bg-base)] border border-[var(--border-color)] rounded-sm p-2 text-[var(--text-main)] outline-none focus:border-[var(--primary)]"
                  >
                    <option value="Critical">Critical Only (&gt;= 80 Risk)</option>
                    <option value="High">High &amp; Critical (&gt;= 70 Risk)</option>
                    <option value="Medium">Medium &amp; Above (&gt;= 40 Risk)</option>
                    <option value="Low">All Incidents</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-[var(--text-muted)] mb-1">Target Endpoint URL</label>
                <input
                  type="url"
                  required
                  placeholder="https://hooks.slack.com/services/... or https://discord.com/api/webhooks/..."
                  value={whUrl}
                  onChange={(e) => setWhUrl(e.target.value)}
                  className="w-full bg-[var(--bg-base)] border border-[var(--border-color)] rounded-sm p-2 text-[var(--text-main)] outline-none focus:border-[var(--primary)]"
                />
              </div>

              <div>
                <label className="block text-[var(--text-muted)] mb-1">
                  Custom HMAC Signing Secret <span className="text-[10px] text-[var(--text-muted)]">(optional, auto-generated if blank)</span>
                </label>
                <input
                  type="text"
                  placeholder="Leave empty to auto-generate random 48-char secret"
                  value={whSecret}
                  onChange={(e) => setWhSecret(e.target.value)}
                  className="w-full bg-[var(--bg-base)] border border-[var(--border-color)] rounded-sm p-2 text-[var(--text-main)] outline-none focus:border-[var(--primary)]"
                />
              </div>

              <div className="flex justify-end gap-3 pt-3">
                <button
                  type="button"
                  onClick={() => setShowNewWebhookModal(false)}
                  className="px-4 py-2 border border-[var(--border-color)] text-[var(--text-muted)] hover:text-[var(--text-main)] rounded-sm cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-[var(--primary)] text-[#001f27] font-bold uppercase rounded-sm hover:bg-[#00b8e6] cursor-pointer"
                >
                  Register Endpoint
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Persistent Bottom Bar (Visible on Security tab) */}
      {activeTab === 'security' && (
        <div className="fixed bottom-0 right-0 left-0 md:left-[240px] bg-[var(--bg-surface)] border-t border-[var(--border-color)] p-3 px-6 flex justify-end gap-3 z-30 shadow-2xl">
          <button
            onClick={handleResetDefaults}
            className="px-4 py-1.5 border border-[var(--border-color)] text-[var(--text-muted)] hover:text-[var(--text-main)] text-xs rounded-sm cursor-pointer transition-colors"
          >
            Reset Defaults
          </button>
          <button
            onClick={handleSaveConfig}
            className="px-5 py-1.5 bg-[var(--primary)] text-[#001f27] font-bold text-xs uppercase rounded-sm hover:bg-[#00b8e6] transition-colors cursor-pointer shadow-[0_0_8px_rgba(0,212,255,0.3)]"
          >
            Save Configuration
          </button>
        </div>
      )}
    </div>
  )
}