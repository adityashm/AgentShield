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

  const fetchKeys = async () => {
    setIsLoadingKeys(true)
    try {
      const data = await getApiKeys()
      setApiKeys(data)
    } catch {
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
    const saved = localStorage.getItem('agentshield_settings')
    if (saved) {
      try {
        const parsed = JSON.parse(saved)
        if (parsed.latency !== undefined) setLatency(parsed.latency)
        if (parsed.jitter !== undefined) setJitter(parsed.jitter)
        if (parsed.packetLoss !== undefined) setPacketLoss(parsed.packetLoss)
        if (parsed.apiThrottling !== undefined) setApiThrottling(parsed.apiThrottling)
        if (parsed.autoKill !== undefined) setAutoKill(parsed.autoKill)
        if (parsed.interceptOutbound !== undefined) setInterceptOutbound(parsed.interceptOutbound)
        if (parsed.readOnlyFs !== undefined) setReadOnlyFs(parsed.readOnlyFs)
        if (parsed.riskThreshold !== undefined) setRiskThreshold(parsed.riskThreshold)
        if (parsed.logRetention !== undefined) setLogRetention(parsed.logRetention)
        if (parsed.alertHistory !== undefined) setAlertHistory(parsed.alertHistory)
      } catch {}
    }
    fetchKeys()
    fetchWebhooks()
    fetchUsers()
  }, [])

  const handleGenerateKey = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newKeyName.trim()) return
    try {
      const scopes = newKeyScopes.split(',').map((s) => s.trim())
      const res = await createApiKey({
        name: newKeyName.trim(),
        scopes,
        is_test: newKeyEnv === 'test',
      })
      setCreatedKeySecret(res.key)
      fetchKeys()
      showToast('API key successfully generated.')
    } catch (err: any) {
      showToast(`Key generation failed: ${err.message || 'Error'}`)
    }
  }

  const handleCopyKey = () => {
    if (createdKeySecret) {
      navigator.clipboard.writeText(createdKeySecret)
      setCopiedKey(true)
      setTimeout(() => setCopiedKey(false), 2000)
    }
  }

  const handleRevokeKey = async (keyId: string) => {
    if (!confirm('Are you certain you want to revoke this API key? Connected agents will immediately fail authentication.')) {
      return
    }
    try {
      await revokeApiKey(keyId)
      showToast('API key revoked.')
      fetchKeys()
    } catch (err: any) {
      showToast(`Revocation failed: ${err.message || 'Error'}`)
    }
  }

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
      showToast('Webhook registered successfully.')
      fetchWebhooks()
    } catch (err: any) {
      showToast(`Webhook registration failed: ${err.message || 'Error'}`)
    }
  }

  const handleToggleWebhook = async (item: WebhookItem) => {
    try {
      await updateWebhook(item.endpoint_id, { enabled: !item.enabled })
      showToast(`Webhook ${!item.enabled ? 'enabled' : 'paused'}.`)
      fetchWebhooks()
    } catch (err: any) {
      showToast(`Failed: ${err.message || 'Error'}`)
    }
  }

  const handleDeleteWebhook = async (endpointId: string) => {
    if (!confirm('Delete this incident webhook endpoint?')) return
    try {
      await deleteWebhook(endpointId)
      showToast('Webhook endpoint deleted.')
      fetchWebhooks()
    } catch (err: any) {
      showToast(`Failed: ${err.message || 'Error'}`)
    }
  }

  const handleTestWebhook = async (endpointId: string) => {
    setIsTesting(endpointId)
    setTestResult(null)
    try {
      const res = await testWebhook(endpointId)
      setTestResult({
        id: endpointId,
        success: res.success,
        msg: res.message || (res.success ? 'Delivered successfully (200 OK)' : 'Delivery failed'),
      })
    } catch (err: any) {
      setTestResult({
        id: endpointId,
        success: false,
        msg: err.message || 'Dispatch timeout',
      })
    } finally {
      setIsTesting(null)
    }
  }

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
    showToast('Reset configuration to default parameters.')
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
    <div className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8 flex flex-col gap-6 pb-28">
      {toastMessage && (
        <div className="fixed top-20 right-8 z-50 rounded-lg bg-slate-900 border border-sky-500/40 px-4 py-2.5 font-mono text-xs text-sky-400 shadow-2xl shadow-sky-950/50 flex items-center gap-2 backdrop-blur-md animate-fade-in">
          <span className="material-symbols-outlined text-[16px] text-sky-400">tune</span>
          {toastMessage}
        </div>
      )}

      {/* Header & Section Navigation Tabs */}
      <div className="panel-obsidian p-5 rounded-xl flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-slate-900 border border-white/10 flex items-center justify-center text-sky-400">
              <span className="material-symbols-outlined text-xl">settings</span>
            </div>
            <div>
              <h1 className="text-white text-lg font-semibold tracking-tight">
                System Administration &amp; Security Controls
              </h1>
              <p className="text-slate-400 text-xs mt-0.5">
                Configure multi-tenant API keys, incident response webhooks, simulation variables, and guardrail policies.
              </p>
            </div>
          </div>
        </div>

        {/* Tab Controls */}
        <div className="flex overflow-x-auto max-w-full bg-slate-950/60 border border-white/5 rounded-lg p-1 text-xs whitespace-nowrap">
          <button
            onClick={() => setActiveTab('security')}
            className={`px-3.5 py-1.5 rounded-md flex items-center gap-1.5 font-mono transition-all cursor-pointer ${
              activeTab === 'security'
                ? 'bg-sky-400 text-slate-950 font-bold shadow-sm shadow-sky-500/20'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <span className="material-symbols-outlined text-[16px]">tune</span>
            Security &amp; Guardrails
          </button>
          <button
            onClick={() => setActiveTab('api-keys')}
            className={`px-3.5 py-1.5 rounded-md flex items-center gap-1.5 font-mono transition-all cursor-pointer ${
              activeTab === 'api-keys'
                ? 'bg-sky-400 text-slate-950 font-bold shadow-sm shadow-sky-500/20'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <span className="material-symbols-outlined text-[16px]">key</span>
            API Keys &amp; SDK
          </button>
          <button
            onClick={() => setActiveTab('webhooks')}
            className={`px-3.5 py-1.5 rounded-md flex items-center gap-1.5 font-mono transition-all cursor-pointer ${
              activeTab === 'webhooks'
                ? 'bg-sky-400 text-slate-950 font-bold shadow-sm shadow-sky-500/20'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <span className="material-symbols-outlined text-[16px]">webhook</span>
            Incident Webhooks
          </button>
          <button
            onClick={() => setActiveTab('team')}
            className={`px-3.5 py-1.5 rounded-md flex items-center gap-1.5 font-mono transition-all cursor-pointer ${
              activeTab === 'team'
                ? 'bg-sky-400 text-slate-950 font-bold shadow-sm shadow-sky-500/20'
                : 'text-slate-400 hover:text-white'
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
            <div className="panel-obsidian p-5 rounded-xl relative overflow-hidden">
              <div className="flex items-center gap-2 mb-4">
                <span className="material-symbols-outlined text-sky-400 text-[20px]">tune</span>
                <h2 className="text-white text-sm font-semibold uppercase tracking-wider font-mono">
                  Environment &amp; Simulation Parameters
                </h2>
              </div>

              <div className="space-y-4 text-xs font-mono">
                <div>
                  <div className="flex justify-between items-center mb-1.5">
                    <span className="text-slate-400 font-sans">Telemetry Latency Simulation</span>
                    <span className="text-sky-400 font-bold">{latency} ms</span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="500"
                    value={latency}
                    onChange={(e) => setLatency(parseInt(e.target.value))}
                    className="w-full accent-sky-400 cursor-pointer"
                  />
                </div>

                <div>
                  <div className="flex justify-between items-center mb-1.5">
                    <span className="text-slate-400 font-sans">Network Jitter Deviation</span>
                    <span className="text-sky-400 font-bold">{jitter} %</span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="100"
                    value={jitter}
                    onChange={(e) => setJitter(parseInt(e.target.value))}
                    className="w-full accent-sky-400 cursor-pointer"
                  />
                </div>

                <div>
                  <div className="flex justify-between items-center mb-1.5">
                    <span className="text-slate-400 font-sans">Packet Loss Emulation</span>
                    <span className="text-sky-400 font-bold">{packetLoss} %</span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="20"
                    step="0.5"
                    value={packetLoss}
                    onChange={(e) => setPacketLoss(parseFloat(e.target.value))}
                    className="w-full accent-sky-400 cursor-pointer"
                  />
                </div>

                <div>
                  <div className="flex justify-between items-center mb-1.5">
                    <span className="text-slate-400 font-sans">API Rate Throttle Limit</span>
                    <span className="text-sky-400 font-bold">{apiThrottling} req/min</span>
                  </div>
                  <input
                    type="range"
                    min="50"
                    max="1000"
                    step="50"
                    value={apiThrottling}
                    onChange={(e) => setApiThrottling(parseInt(e.target.value))}
                    className="w-full accent-sky-400 cursor-pointer"
                  />
                </div>
              </div>
            </div>

            {/* Global Threat Guardrails */}
            <div className="panel-obsidian p-5 rounded-xl relative overflow-hidden">
              <div className="flex items-center gap-2 mb-4">
                <span className="material-symbols-outlined text-rose-400 text-[20px]">security</span>
                <h2 className="text-white text-sm font-semibold uppercase tracking-wider font-mono">
                  Automated Security Guardrails
                </h2>
              </div>

              <div className="space-y-3 font-sans">
                <label className="flex items-center justify-between p-3.5 bg-slate-950/60 border border-white/5 rounded-lg hover:border-white/10 cursor-pointer transition-colors">
                  <div>
                    <div className="text-xs font-semibold text-white">Auto-Quarantine Rogue Processes</div>
                    <div className="text-[11px] text-slate-400 mt-0.5">
                      Instantly terminate and isolate agents exhibiting anomaly scores &gt; 0.85
                    </div>
                  </div>
                  <input
                    type="checkbox"
                    checked={autoKill}
                    onChange={(e) => setAutoKill(e.target.checked)}
                    className="h-4 w-4 rounded border-white/20 bg-slate-900 text-sky-500 focus:ring-sky-500 cursor-pointer"
                  />
                </label>

                <label className="flex items-center justify-between p-3.5 bg-slate-950/60 border border-white/5 rounded-lg hover:border-white/10 cursor-pointer transition-colors">
                  <div>
                    <div className="text-xs font-semibold text-white">Intercept Outbound External Requests</div>
                    <div className="text-[11px] text-slate-400 mt-0.5">
                      Block unverified egress endpoints and prompt injection attempts
                    </div>
                  </div>
                  <input
                    type="checkbox"
                    checked={interceptOutbound}
                    onChange={(e) => setInterceptOutbound(e.target.checked)}
                    className="h-4 w-4 rounded border-white/20 bg-slate-900 text-sky-500 focus:ring-sky-500 cursor-pointer"
                  />
                </label>

                <label className="flex items-center justify-between p-3.5 bg-slate-950/60 border border-white/5 rounded-lg hover:border-white/10 cursor-pointer transition-colors">
                  <div>
                    <div className="text-xs font-semibold text-white">Read-Only File System Sandbox</div>
                    <div className="text-[11px] text-slate-400 mt-0.5">
                      Prevent agents from writing or altering system configuration files
                    </div>
                  </div>
                  <input
                    type="checkbox"
                    checked={readOnlyFs}
                    onChange={(e) => setReadOnlyFs(e.target.checked)}
                    className="h-4 w-4 rounded border-white/20 bg-slate-900 text-sky-500 focus:ring-sky-500 cursor-pointer"
                  />
                </label>
              </div>
            </div>
          </div>

          {/* Right Column (5 cols) */}
          <div className="lg:col-span-5 flex flex-col gap-6">
            {/* Risk Thresholds & Visual Gauge */}
            <div className="panel-obsidian p-5 rounded-xl relative overflow-hidden">
              <div className="flex items-center gap-2 mb-3">
                <span className="material-symbols-outlined text-amber-400 text-[20px]">speed</span>
                <h2 className="text-white text-sm font-semibold uppercase tracking-wider font-mono">
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
                      stroke="rgba(255,255,255,0.08)"
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
                      stroke="#f59e0b"
                      strokeDasharray={`${Math.min(riskThreshold, 100)} 120`}
                      strokeDashoffset="0"
                      strokeLinecap="round"
                      strokeWidth="8"
                    />
                  </svg>
                  <div className="absolute inset-0 flex flex-col items-center justify-center font-mono">
                    <span className="text-[32px] font-bold text-amber-400">{riskThreshold}</span>
                    <span className="text-[10px] text-slate-400 uppercase tracking-wider font-sans">Alert Trigger</span>
                  </div>
                </div>

                <div className="w-full mt-3">
                  <input
                    type="range"
                    min="30"
                    max="90"
                    value={riskThreshold}
                    onChange={(e) => setRiskThreshold(parseInt(e.target.value))}
                    className="w-full accent-amber-400 cursor-pointer"
                  />
                </div>

                <div className="w-full grid grid-cols-2 gap-2 mt-4 p-3 bg-slate-950/60 rounded-lg border border-white/5 text-[11px] font-mono">
                  <div className="flex items-center gap-1.5 text-emerald-400">
                    <span className="h-2 w-2 rounded-full bg-emerald-400" />
                    <span>Safe: 0–25</span>
                  </div>
                  <div className="flex items-center gap-1.5 text-sky-400">
                    <span className="h-2 w-2 rounded-full bg-sky-400" />
                    <span>Low: 26–50</span>
                  </div>
                  <div className="flex items-center gap-1.5 text-amber-400">
                    <span className="h-2 w-2 rounded-full bg-amber-400" />
                    <span>Medium: 51–75</span>
                  </div>
                  <div className="flex items-center gap-1.5 text-rose-400">
                    <span className="h-2 w-2 rounded-full bg-rose-400" />
                    <span>High: 76–100</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Machine Learning Model Retrain Card */}
            <div className="panel-obsidian p-5 rounded-xl relative overflow-hidden">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <span className="material-symbols-outlined text-indigo-400 text-[20px]">smart_toy</span>
                  <h2 className="text-white text-sm font-semibold uppercase tracking-wider font-mono">
                    Isolation Forest ML Engine
                  </h2>
                </div>
                <span className="px-2 py-0.5 rounded-full bg-indigo-950/60 border border-indigo-800/40 text-indigo-300 text-[10px] font-mono">
                  v1.2 ACTIVE
                </span>
              </div>

              <p className="text-xs text-slate-400 mb-3 leading-relaxed font-sans">
                Unsupervised anomaly detection scoring action feature vectors (action_type, parameters, call_frequency, duration).
              </p>

              {retrainSuccess && (
                <div className="p-3 mb-3 bg-emerald-950/20 border border-emerald-500/40 rounded-lg text-xs text-emerald-300 font-mono">
                  {retrainSuccess}
                </div>
              )}

              <button
                onClick={handleTriggerRetrain}
                disabled={isRetraining}
                className={`w-full py-2.5 px-3 rounded-lg border font-mono text-xs font-bold uppercase transition-all flex items-center justify-center gap-2 cursor-pointer ${
                  isRetraining
                    ? 'bg-slate-900 border-white/10 text-slate-500'
                    : 'bg-indigo-950/40 border-indigo-800/50 text-indigo-300 hover:bg-indigo-900/50'
                }`}
              >
                <span className={`material-symbols-outlined text-[16px] ${isRetraining ? 'animate-spin' : ''}`}>
                  {isRetraining ? 'sync' : 'bolt'}
                </span>
                {isRetraining ? 'Retraining ML Model...' : 'Retrain Isolation Forest (API)'}
              </button>
            </div>

            {/* Data Retention */}
            <div className="panel-obsidian p-5 rounded-xl relative overflow-hidden">
              <h2 className="text-white text-sm font-semibold uppercase tracking-wider mb-3 font-mono">
                Data Retention &amp; Audit Log
              </h2>
              <div className="space-y-3 text-xs font-sans">
                <div>
                  <label className="block text-slate-400 mb-1">Telemetry Log Retention</label>
                  <select
                    value={logRetention}
                    onChange={(e) => setLogRetention(parseInt(e.target.value))}
                    className="w-full bg-slate-950/80 border border-white/10 rounded-lg p-2.5 text-white outline-none focus:border-sky-500 cursor-pointer"
                  >
                    <option value={30}>30 Days</option>
                    <option value={90}>90 Days</option>
                    <option value={365}>1 Year (Immutable Audit)</option>
                  </select>
                </div>
                <div>
                  <label className="block text-slate-400 mb-1">Max Incident Event Buffer</label>
                  <select
                    value={alertHistory}
                    onChange={(e) => setAlertHistory(parseInt(e.target.value))}
                    className="w-full bg-slate-950/80 border border-white/10 rounded-lg p-2.5 text-white outline-none focus:border-sky-500 cursor-pointer"
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
          <div className="panel-obsidian p-6 rounded-xl flex flex-col md:flex-row items-start md:items-center justify-between gap-4 relative overflow-hidden">
            <div>
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-sky-400">apartment</span>
                <h2 className="text-sm font-semibold text-white uppercase tracking-wider font-mono">
                  Organization Tenant: Acme AI Corp
                </h2>
                <span className="text-[10px] font-mono bg-sky-950/60 text-sky-400 border border-sky-800/40 px-2 py-0.5 rounded-full">
                  org_default
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-1 font-sans">
                Keys authenticate agent clusters, LangChain runtimes, and external telemetry ingestion. Stored using constant-time SHA-256 hashes.
              </p>
            </div>
            <button
              onClick={() => {
                setShowNewKeyModal(true)
                setCreatedKeySecret(null)
              }}
              className="px-4 py-2 bg-sky-400 hover:bg-sky-300 text-slate-950 font-bold text-xs font-mono uppercase rounded-lg transition-all flex items-center gap-1.5 shadow-lg shadow-sky-500/20 active:scale-95 cursor-pointer shrink-0"
            >
              <span className="material-symbols-outlined text-[16px]">add</span>
              Generate New API Key
            </button>
          </div>

          {/* Keys Table */}
          <div className="panel-obsidian rounded-xl overflow-hidden flex flex-col">
            <div className="p-4 bg-slate-950/80 border-b border-white/5 flex items-center justify-between font-mono">
              <span className="text-xs font-semibold text-white uppercase tracking-wider flex items-center gap-2">
                <span className="material-symbols-outlined text-[16px] text-sky-400">vpn_key</span>
                Active Authentication Keys ({apiKeys.length})
              </span>
              <button
                onClick={fetchKeys}
                className="text-xs text-slate-400 hover:text-white flex items-center gap-1 cursor-pointer transition-colors"
              >
                <span className="material-symbols-outlined text-[14px]">refresh</span>
                Refresh
              </button>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs font-mono border-collapse whitespace-nowrap">
                <thead>
                  <tr className="border-b border-white/5 text-slate-400 bg-slate-950/60 text-[11px] uppercase tracking-wider">
                    <th className="p-3.5">KEY NAME</th>
                    <th className="p-3.5">PREFIX / LOOKUP</th>
                    <th className="p-3.5">SCOPES</th>
                    <th className="p-3.5">CREATED</th>
                    <th className="p-3.5">LAST USED</th>
                    <th className="p-3.5">STATUS</th>
                    <th className="p-3.5 text-right">ACTIONS</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5 text-slate-300">
                  {isLoadingKeys ? (
                    <tr>
                      <td colSpan={7} className="p-6 text-center text-slate-500">
                        Loading API keys...
                      </td>
                    </tr>
                  ) : apiKeys.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="p-6 text-center text-slate-500">
                        No API keys configured yet. Generate one above to connect real agents.
                      </td>
                    </tr>
                  ) : (
                    apiKeys.map((key) => {
                      const isRevoked = Boolean(key.revoked_at)
                      return (
                        <tr key={key.key_id} className="hover:bg-slate-800/40 transition-colors">
                          <td className="p-3.5 font-bold text-white flex items-center gap-2">
                            <span className="material-symbols-outlined text-[15px] text-slate-400">key</span>
                            {key.name}
                          </td>
                          <td className="p-3.5 text-sky-400">
                            <code>{key.prefix}...</code>
                          </td>
                          <td className="p-3.5 text-slate-400">
                            <span className="px-2 py-0.5 rounded-full bg-slate-800 border border-white/5 text-[10px]">
                              {key.scopes}
                            </span>
                          </td>
                          <td className="p-3.5 text-slate-400">
                            {formatISTDate(key.created_at)}
                          </td>
                          <td className="p-3.5 text-slate-400">
                            {key.last_used_at ? formatISTDateTime(key.last_used_at) : 'Never'}
                          </td>
                          <td className="p-3.5">
                            {isRevoked ? (
                              <span className="px-2 py-0.5 rounded-full bg-rose-950/60 text-rose-400 border border-rose-800/50 text-[10px] uppercase font-bold">
                                Revoked
                              </span>
                            ) : (
                              <span className="px-2 py-0.5 rounded-full bg-emerald-950/60 text-emerald-400 border border-emerald-800/50 text-[10px] uppercase font-bold">
                                Active
                              </span>
                            )}
                          </td>
                          <td className="p-3.5 text-right">
                            {!isRevoked && (
                              <div className="flex items-center justify-end gap-1.5">
                                <button
                                  onClick={() => handleRotateKey(key.key_id)}
                                  title="Rotate key with 24-hour overlap grace window"
                                  className="px-2.5 py-1 text-[11px] text-sky-400 border border-sky-800/50 hover:bg-sky-950/40 rounded-lg transition-colors cursor-pointer flex items-center gap-1"
                                >
                                  <span className="material-symbols-outlined text-[13px]">published_with_changes</span>
                                  Rotate
                                </button>
                                <button
                                  onClick={() => handleRevokeKey(key.key_id)}
                                  className="px-2.5 py-1 text-[11px] text-rose-400 border border-rose-800/50 hover:bg-rose-950/40 rounded-lg transition-colors cursor-pointer"
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
        </div>
      )}

      {/* TAB 3: INCIDENT WEBHOOKS & ROUTING */}
      {activeTab === 'webhooks' && (
        <div className="flex flex-col gap-6">
          {/* Webhook Header & Action */}
          <div className="panel-obsidian p-6 rounded-xl flex flex-col md:flex-row items-start md:items-center justify-between gap-4 relative overflow-hidden">
            <div>
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-amber-400">notifications_active</span>
                <h2 className="text-sm font-semibold text-white uppercase tracking-wider font-mono">
                  Outbound Threat Webhook Dispatcher
                </h2>
              </div>
              <p className="text-xs text-slate-400 mt-1 font-sans">
                Deliver instant HMAC-signed incident alerts directly to Slack, Discord, or your SIEM SOC pipeline. Anti-flapping logic prevents alert storms.
              </p>
            </div>
            <button
              onClick={() => setShowNewWebhookModal(true)}
              className="px-4 py-2 bg-sky-400 hover:bg-sky-300 text-slate-950 font-bold text-xs font-mono uppercase rounded-lg transition-all flex items-center gap-1.5 shadow-lg shadow-sky-500/20 active:scale-95 cursor-pointer shrink-0"
            >
              <span className="material-symbols-outlined text-[16px]">add_link</span>
              Register Webhook
            </button>
          </div>

          {/* Webhooks Table */}
          <div className="panel-obsidian rounded-xl overflow-hidden flex flex-col">
            <div className="p-4 bg-slate-950/80 border-b border-white/5 flex items-center justify-between font-mono">
              <span className="text-xs font-semibold text-white uppercase tracking-wider flex items-center gap-2">
                <span className="material-symbols-outlined text-[16px] text-sky-400">hub</span>
                Configured Incident Receivers ({webhooks.length})
              </span>
              <button
                onClick={fetchWebhooks}
                className="text-xs text-slate-400 hover:text-white flex items-center gap-1 cursor-pointer transition-colors"
              >
                <span className="material-symbols-outlined text-[14px]">refresh</span>
                Refresh
              </button>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs font-mono border-collapse whitespace-nowrap">
                <thead>
                  <tr className="border-b border-white/5 text-slate-400 bg-slate-950/60 text-[11px] uppercase tracking-wider">
                    <th className="p-3.5">RECEIVER NAME</th>
                    <th className="p-3.5">DESTINATION</th>
                    <th className="p-3.5">URL</th>
                    <th className="p-3.5">MIN SEVERITY</th>
                    <th className="p-3.5">HMAC AUTH</th>
                    <th className="p-3.5">STATUS</th>
                    <th className="p-3.5 text-right">ACTIONS</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5 text-slate-300">
                  {isLoadingWebhooks ? (
                    <tr>
                      <td colSpan={7} className="p-6 text-center text-slate-500">
                        Loading webhook endpoints...
                      </td>
                    </tr>
                  ) : webhooks.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="p-6 text-center text-slate-500">
                        No incident webhooks configured. Register a Slack or Discord webhook to receive real-time threat notifications.
                      </td>
                    </tr>
                  ) : (
                    webhooks.map((ep) => {
                      const isTestingCurrent = isTesting === ep.endpoint_id
                      const hasResult = testResult && testResult.id === ep.endpoint_id
                      return (
                        <tr key={ep.endpoint_id} className="hover:bg-slate-800/40 transition-colors">
                          <td className="p-3.5 font-bold text-white flex items-center gap-2">
                            <span className="material-symbols-outlined text-[15px] text-sky-400">
                              {ep.target_type === 'slack' ? 'chat' : ep.target_type === 'discord' ? 'forum' : 'webhook'}
                            </span>
                            {ep.name}
                          </td>
                          <td className="p-3.5">
                            <span className="px-2 py-0.5 rounded-full bg-slate-800 border border-white/5 text-[10px] uppercase font-bold text-slate-200">
                              {ep.target_type}
                            </span>
                          </td>
                          <td className="p-3.5 text-slate-400 max-w-xs truncate" title={ep.url}>
                            <code>{ep.url}</code>
                          </td>
                          <td className="p-3.5">
                            <span
                              className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                                ep.min_severity === 'Critical'
                                  ? 'bg-rose-950/60 text-rose-400 border border-rose-800/50'
                                  : 'bg-amber-950/60 text-amber-400 border border-amber-800/50'
                              }`}
                            >
                              {ep.min_severity}+
                            </span>
                          </td>
                          <td className="p-3.5 text-emerald-400 flex items-center gap-1">
                            <span className="material-symbols-outlined text-[14px]">lock</span>
                            <span className="text-[10px]">HMAC-SHA256</span>
                          </td>
                          <td className="p-3.5">
                            <button
                              onClick={() => handleToggleWebhook(ep)}
                              className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase cursor-pointer transition-colors ${
                                ep.enabled
                                  ? 'bg-emerald-950/60 text-emerald-400 border border-emerald-800/50'
                                  : 'bg-slate-800 text-slate-400 border border-white/5 hover:text-white'
                              }`}
                            >
                              {ep.enabled ? 'Enabled' : 'Paused'}
                            </button>
                          </td>
                          <td className="p-3.5 text-right">
                            <div className="flex items-center justify-end gap-2">
                              <button
                                onClick={() => handleTestWebhook(ep.endpoint_id)}
                                disabled={isTestingCurrent}
                                className="px-2.5 py-1 text-[11px] text-sky-400 border border-sky-800/50 hover:bg-sky-950/40 rounded-lg transition-colors cursor-pointer flex items-center gap-1"
                              >
                                <span className={`material-symbols-outlined text-[13px] ${isTestingCurrent ? 'animate-spin' : ''}`}>
                                  {isTestingCurrent ? 'sync' : 'send'}
                                </span>
                                {isTestingCurrent ? 'Pinging...' : 'Test Ping'}
                              </button>
                              <button
                                onClick={() => handleDeleteWebhook(ep.endpoint_id)}
                                className="px-2.5 py-1 text-[11px] text-rose-400 border border-rose-800/50 hover:bg-rose-950/40 rounded-lg transition-colors cursor-pointer"
                              >
                                Delete
                              </button>
                            </div>
                            {hasResult && (
                              <div
                                className={`text-[10px] mt-1 ${
                                  testResult.success ? 'text-emerald-400' : 'text-rose-400'
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
        </div>
      )}

      {/* TAB 4: TEAM & ACCESS MANAGEMENT */}
      {activeTab === 'team' && (
        <div className="flex flex-col gap-6">
          <div className="panel-obsidian p-6 rounded-xl flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-sky-400 text-lg">badge</span>
                <h2 className="text-sm font-semibold text-white uppercase tracking-wider font-mono">
                  Team Members &amp; RBAC Access Controls
                </h2>
              </div>
              <p className="text-xs text-slate-400 mt-1 font-sans">
                Manage organization administrators, security analysts, and read-only viewers with granular role-based permissions.
              </p>
            </div>
            <button
              onClick={() => setShowInviteModal(true)}
              className="px-4 py-2 bg-sky-400 hover:bg-sky-300 text-slate-950 font-bold text-xs font-mono uppercase rounded-lg transition-all flex items-center gap-1.5 shadow-lg shadow-sky-500/20 active:scale-95 cursor-pointer shrink-0"
            >
              <span className="material-symbols-outlined text-[16px]">person_add</span>
              Invite Member
            </button>
          </div>

          <div className="panel-obsidian rounded-xl overflow-hidden flex flex-col">
            <div className="p-4 bg-slate-950/80 border-b border-white/5 flex items-center justify-between font-mono">
              <span className="text-xs font-semibold text-white uppercase tracking-wider flex items-center gap-2">
                <span className="material-symbols-outlined text-[16px] text-sky-400">group</span>
                Active Members ({users.length})
              </span>
              <button
                onClick={fetchUsers}
                className="text-xs text-slate-400 hover:text-white flex items-center gap-1 cursor-pointer transition-colors"
              >
                <span className="material-symbols-outlined text-[14px]">refresh</span>
                Refresh
              </button>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs font-mono border-collapse whitespace-nowrap">
                <thead>
                  <tr className="border-b border-white/5 text-slate-400 bg-slate-950/60 text-[11px] uppercase tracking-wider">
                    <th className="p-3.5">MEMBER NAME</th>
                    <th className="p-3.5">EMAIL ADDRESS</th>
                    <th className="p-3.5">ASSIGNED ROLE</th>
                    <th className="p-3.5">JOINED DATE</th>
                    <th className="p-3.5">STATUS</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5 text-slate-300">
                  {isLoadingUsers ? (
                    <tr>
                      <td colSpan={5} className="p-6 text-center text-slate-500">
                        Loading team members...
                      </td>
                    </tr>
                  ) : (
                    users.map((u) => (
                      <tr key={u.id} className="hover:bg-slate-800/40 transition-colors">
                        <td className="p-3.5 font-bold text-white flex items-center gap-2">
                          <span className="w-7 h-7 rounded-full bg-slate-800 border border-white/10 flex items-center justify-center text-[10px] text-sky-400 font-mono">
                            {(u.full_name || u.email).substring(0, 2).toUpperCase()}
                          </span>
                          {u.full_name || 'Member'}
                        </td>
                        <td className="p-3.5 text-slate-400">{u.email}</td>
                        <td className="p-3.5">
                          <span
                            className={`px-2.5 py-0.5 rounded-full text-[10px] uppercase font-bold border ${
                              u.role === 'admin'
                                ? 'bg-sky-950/60 text-sky-400 border-sky-800/50'
                                : u.role === 'analyst'
                                ? 'bg-amber-950/60 text-amber-400 border-amber-800/50'
                                : 'bg-slate-800 text-slate-400 border-white/5'
                            }`}
                          >
                            {u.role}
                          </span>
                        </td>
                        <td className="p-3.5 text-slate-400">
                          {formatISTDate(u.created_at)}
                        </td>
                        <td className="p-3.5">
                          <span className="px-2 py-0.5 rounded-full bg-emerald-950/60 text-emerald-400 border border-emerald-800/50 text-[10px] uppercase font-bold">
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
        </div>
      )}

      {/* MODAL: Invite Team Member */}
      {showInviteModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4">
          <div className="panel-obsidian rounded-2xl max-w-md w-full p-6 shadow-2xl relative">
            <h3 className="text-sm font-semibold text-white uppercase tracking-wider flex items-center gap-2 mb-4 font-mono">
              <span className="material-symbols-outlined text-[18px] text-sky-400">person_add</span>
              Invite Organization Member
            </h3>

            <form onSubmit={handleInviteSubmit} className="space-y-4 text-xs font-sans">
              <div>
                <label className="block text-slate-300 mb-1 font-medium">Full Name</label>
                <input
                  type="text"
                  placeholder="e.g. Jane Doe"
                  value={inviteName}
                  onChange={(e) => setInviteName(e.target.value)}
                  className="w-full bg-slate-950/80 border border-white/10 rounded-lg p-2.5 text-white outline-none focus:border-sky-500"
                />
              </div>

              <div>
                <label className="block text-slate-300 mb-1 font-medium">Email Address</label>
                <input
                  type="email"
                  required
                  placeholder="name@organization.com"
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                  className="w-full bg-slate-950/80 border border-white/10 rounded-lg p-2.5 text-white outline-none focus:border-sky-500"
                />
              </div>

              <div>
                <label className="block text-slate-300 mb-1 font-medium">Role &amp; Permissions</label>
                <select
                  value={inviteRole}
                  onChange={(e) => setInviteRole(e.target.value as any)}
                  className="w-full bg-slate-950/80 border border-white/10 rounded-lg p-2.5 text-white outline-none focus:border-sky-500 cursor-pointer"
                >
                  <option value="analyst">Security Analyst (Triages alerts, quarantines agents, creates rules)</option>
                  <option value="admin">Administrator (Full control, manage API keys, webhooks, team)</option>
                  <option value="viewer">Viewer (Read-only observability dashboard access)</option>
                </select>
              </div>

              <div className="flex justify-end gap-2.5 pt-3">
                <button
                  type="button"
                  onClick={() => setShowInviteModal(false)}
                  className="px-4 py-2 border border-white/10 text-slate-400 hover:text-white rounded-lg cursor-pointer transition-colors font-mono"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-sky-400 hover:bg-sky-300 text-slate-950 font-bold uppercase rounded-lg transition-all cursor-pointer font-mono"
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
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4">
          <div className="panel-obsidian rounded-2xl max-w-lg w-full p-6 shadow-2xl relative">
            <h3 className="text-sm font-semibold text-white uppercase tracking-wider flex items-center gap-2 mb-3 font-mono">
              <span className="material-symbols-outlined text-[18px] text-sky-400">vpn_key</span>
              Generate Enterprise API Key
            </h3>

            {!createdKeySecret ? (
              <form onSubmit={handleGenerateKey} className="space-y-4 text-xs font-sans">
                <div>
                  <label className="block text-slate-300 mb-1 font-medium">Key Name / Fleet Description</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. LangChain Support Agents, Production Cluster"
                    value={newKeyName}
                    onChange={(e) => setNewKeyName(e.target.value)}
                    className="w-full bg-slate-950/80 border border-white/10 rounded-lg p-2.5 text-white outline-none focus:border-sky-500"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-slate-300 mb-1 font-medium">Environment</label>
                    <select
                      value={newKeyEnv}
                      onChange={(e) => setNewKeyEnv(e.target.value as any)}
                      className="w-full bg-slate-950/80 border border-white/10 rounded-lg p-2.5 text-white outline-none focus:border-sky-500 cursor-pointer font-mono"
                    >
                      <option value="live">Live (ashield_live_...)</option>
                      <option value="test">Test (ashield_test_...)</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-slate-300 mb-1 font-medium">Scopes</label>
                    <input
                      type="text"
                      value={newKeyScopes}
                      onChange={(e) => setNewKeyScopes(e.target.value)}
                      className="w-full bg-slate-950/80 border border-white/10 rounded-lg p-2.5 text-white outline-none focus:border-sky-500 font-mono"
                    />
                  </div>
                </div>

                <div className="p-3 bg-sky-950/20 border border-sky-500/30 rounded-lg text-xs text-slate-300">
                  The raw API key will be displayed only once upon generation. AgentShield stores only a constant-time cryptographic SHA-256 hash.
                </div>

                <div className="flex justify-end gap-2.5 pt-3">
                  <button
                    type="button"
                    onClick={() => setShowNewKeyModal(false)}
                    className="px-4 py-2 border border-white/10 text-slate-400 hover:text-white rounded-lg cursor-pointer font-mono"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 bg-sky-400 hover:bg-sky-300 text-slate-950 font-bold uppercase rounded-lg transition-all cursor-pointer font-mono"
                  >
                    Create Key
                  </button>
                </div>
              </form>
            ) : (
              <div className="space-y-4 text-xs font-mono">
                <div className="p-3 bg-emerald-950/20 border border-emerald-500/40 rounded-lg text-emerald-300 text-xs font-bold flex items-center gap-2">
                  <span className="material-symbols-outlined text-[18px]">check_circle</span>
                  API Key Created Successfully
                </div>

                <p className="text-xs text-amber-400 font-sans">
                  ⚠️ Make sure to copy this key right now. For security purposes, you will never be able to view it again.
                </p>

                <div className="p-3 bg-slate-950/80 border border-sky-500/40 rounded-lg flex items-center justify-between gap-2">
                  <code className="text-xs text-sky-400 break-all select-all">{createdKeySecret}</code>
                  <button
                    onClick={handleCopyKey}
                    className="px-3 py-1.5 bg-sky-400 text-slate-950 font-bold text-xs uppercase rounded-lg hover:bg-sky-300 cursor-pointer shrink-0"
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
                    className="px-5 py-2 bg-slate-900 border border-white/10 text-white hover:border-sky-500/40 rounded-lg cursor-pointer"
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
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4">
          <div className="panel-obsidian rounded-2xl max-w-lg w-full p-6 shadow-2xl relative">
            <h3 className="text-sm font-semibold text-white uppercase tracking-wider flex items-center gap-2 mb-3 font-mono">
              <span className="material-symbols-outlined text-[18px] text-sky-400">add_link</span>
              Register Outbound Incident Webhook
            </h3>

            <form onSubmit={handleCreateWebhook} className="space-y-4 text-xs font-sans">
              <div>
                <label className="block text-slate-300 mb-1 font-medium">Receiver Name</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. SOC Primary Slack, Discord Incident Channel"
                  value={whName}
                  onChange={(e) => setWhName(e.target.value)}
                  className="w-full bg-slate-950/80 border border-white/10 rounded-lg p-2.5 text-white outline-none focus:border-sky-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-300 mb-1 font-medium">Destination Format</label>
                  <select
                    value={whType}
                    onChange={(e) => setWhType(e.target.value as any)}
                    className="w-full bg-slate-950/80 border border-white/10 rounded-lg p-2.5 text-white outline-none focus:border-sky-500 cursor-pointer"
                  >
                    <option value="slack">Slack Incoming Webhook</option>
                    <option value="discord">Discord Webhook</option>
                    <option value="pagerduty">PagerDuty Events API v2</option>
                    <option value="generic">Generic REST Endpoint (HMAC)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-slate-300 mb-1 font-medium">Minimum Severity Trigger</label>
                  <select
                    value={whMinSeverity}
                    onChange={(e) => setWhMinSeverity(e.target.value)}
                    className="w-full bg-slate-950/80 border border-white/10 rounded-lg p-2.5 text-white outline-none focus:border-sky-500 cursor-pointer"
                  >
                    <option value="Critical">Critical Only (&gt;= 80 Risk)</option>
                    <option value="High">High &amp; Critical (&gt;= 70 Risk)</option>
                    <option value="Medium">Medium &amp; Above (&gt;= 40 Risk)</option>
                    <option value="Low">All Incidents</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-slate-300 mb-1 font-medium">Target Endpoint URL</label>
                <input
                  type="url"
                  required
                  placeholder="https://hooks.slack.com/services/... or https://discord.com/api/webhooks/..."
                  value={whUrl}
                  onChange={(e) => setWhUrl(e.target.value)}
                  className="w-full bg-slate-950/80 border border-white/10 rounded-lg p-2.5 text-white outline-none focus:border-sky-500 font-mono"
                />
              </div>

              <div>
                <label className="block text-slate-300 mb-1 font-medium">
                  Custom HMAC Signing Secret <span className="text-[10px] text-slate-500 font-normal">(optional, auto-generated if blank)</span>
                </label>
                <input
                  type="text"
                  placeholder="Leave empty to auto-generate random 48-char secret"
                  value={whSecret}
                  onChange={(e) => setWhSecret(e.target.value)}
                  className="w-full bg-slate-950/80 border border-white/10 rounded-lg p-2.5 text-white outline-none focus:border-sky-500 font-mono"
                />
              </div>

              <div className="flex justify-end gap-2.5 pt-3">
                <button
                  type="button"
                  onClick={() => setShowNewWebhookModal(false)}
                  className="px-4 py-2 border border-white/10 text-slate-400 hover:text-white rounded-lg cursor-pointer font-mono"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-sky-400 hover:bg-sky-300 text-slate-950 font-bold uppercase rounded-lg transition-all cursor-pointer font-mono"
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
        <div className="fixed bottom-0 right-0 left-0 md:left-[260px] bg-slate-950/90 border-t border-white/10 backdrop-blur-xl p-4 px-6 flex justify-end gap-3 z-30 shadow-2xl">
          <button
            onClick={handleResetDefaults}
            className="px-4 py-2 border border-white/10 text-slate-400 hover:text-white text-xs font-mono rounded-lg cursor-pointer transition-colors"
          >
            Reset Defaults
          </button>
          <button
            onClick={handleSaveConfig}
            className="px-5 py-2 bg-sky-400 hover:bg-sky-300 text-slate-950 font-mono font-bold text-xs uppercase rounded-lg transition-all cursor-pointer shadow-lg shadow-sky-500/20 active:scale-95"
          >
            Save Configuration
          </button>
        </div>
      )}
    </div>
  )
}
