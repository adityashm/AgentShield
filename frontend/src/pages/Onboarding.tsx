import React, { useState } from 'react'
import { Link } from 'react-router-dom'
import { createApiKey, getSystemHealth } from '../api'

type FrameworkTab = 'python' | 'langchain' | 'crewai' | 'openai'

export default function Onboarding() {
  const [apiKey, setApiKey] = useState('ashield_live_your_api_key_here')
  const [copiedKey, setCopiedKey] = useState(false)
  const [selectedFramework, setSelectedFramework] = useState<FrameworkTab>('python')
  const [pingStatus, setPingStatus] = useState<'idle' | 'testing' | 'online' | 'offline'>('idle')
  const [keyGenerated, setKeyGenerated] = useState(false)

  const handleGenerateKey = async () => {
    try {
      const res = await createApiKey({ name: 'Quickstart Onboarding Key', is_test: false, scopes: ['ingest', 'evaluate'] })
      setApiKey(res.key)
      setKeyGenerated(true)
    } catch {
      setApiKey('ashield_live_sample_key_' + Math.random().toString(36).substring(2, 10))
      setKeyGenerated(true)
    }
  }

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text)
    setCopiedKey(true)
    setTimeout(() => setCopiedKey(false), 2000)
  }

  const handleTestPing = async () => {
    setPingStatus('testing')
    try {
      await getSystemHealth()
      setPingStatus('online')
    } catch {
      setPingStatus('offline')
    }
  }

  const codeSnippets: Record<FrameworkTab, string> = {
    python: `from agentshield import AgentShield, ShieldSecurityException

# Initialize AgentShield SDK
shield = AgentShield(
    api_key="${apiKey}",
    endpoint="http://localhost:8000/api/v1",
    mode="enforce",         # Synchronous pre-flight policy evaluation
    fail_open=False,        # Block attacks immediately
)

# Protect functions and tools with @shield.monitor
@shield.monitor(action_type="execute_sql")
def query_database(sql: str):
    # Your database logic here
    return {"status": "success"}

# Actions are automatically evaluated before execution
try:
    query_database("SELECT * FROM accounts WHERE id = 'ACC-01'")
except ShieldSecurityException as exc:
    print(f"Action blocked: {exc.violated_rules}")`,

    langchain: `from agentshield import AgentShield
from agentshield.integrations.langchain import AgentShieldCallbackHandler

shield = AgentShield(api_key="${apiKey}", mode="enforce")

# Attach handler to your LangChain agent or chain
handler = AgentShieldCallbackHandler(shield=shield, enforce=True)

# Run agent with callback handler
# agent_executor.run("Analyze Q3 report", callbacks=[handler])`,

    crewai: `from agentshield import AgentShield
from agentshield.integrations.crewai import CrewAIShieldListener

shield = AgentShield(api_key="${apiKey}", mode="enforce")

# Attach listener to monitor multi-agent task lifecycles
listener = CrewAIShieldListener(shield=shield, agent_id="researcher_agent")

# Hooks automatically intercept tool executions and task results
listener.on_task_start("market_research", "Analyze venture filings")`,

    openai: `from agentshield import AgentShield
from agentshield.integrations.openai import OpenAIAgentShield

shield = AgentShield(api_key="${apiKey}", mode="enforce")
openai_shield = OpenAIAgentShield(shield=shield, agent_id="support_bot")

# Wrap OpenAI tool definitions
@openai_shield.tool(name="order_lookup")
def order_lookup(order_id: str):
    return {"status": "shipped", "carrier": "FedEx"}`,
  }

  return (
    <div className="flex-1 flex flex-col h-full overflow-y-auto bg-[var(--bg-base)] p-8">
      <div className="max-w-4xl mx-auto w-full space-y-8 font-mono">
        {/* Header */}
        <div className="border-b border-[var(--border-color)] pb-6">
          <div className="flex items-center justify-between">
            <div>
              <span className="text-[10px] uppercase tracking-[0.25em] text-[var(--primary)] font-bold">
                Quickstart Guide
              </span>
              <h1 className="text-2xl font-bold tracking-wide text-[var(--text-main)] mt-1">
                Instrument Your AI Agent in 5 Minutes
              </h1>
              <p className="text-xs text-[var(--text-muted)] mt-1">
                Protect autonomous agents with real-time pre-flight guardrails, behavior anomaly detection, and unified observability.
              </p>
            </div>

            <Link
              to="/dashboard"
              className="px-3 py-1.5 border border-[var(--border-color)] text-[var(--text-muted)] hover:text-[var(--text-main)] text-xs rounded-sm transition-colors flex items-center gap-1.5"
            >
              <span className="material-symbols-outlined text-[16px]">arrow_back</span>
              Back to Dashboard
            </Link>
          </div>
        </div>

        {/* Step 1: API Key */}
        <div className="p-6 bg-[var(--bg-surface)] border border-[var(--border-color)] rounded-sm space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <span className="w-6 h-6 rounded-full bg-[var(--primary)] text-[#001f27] text-xs font-bold flex items-center justify-center">
                1
              </span>
              <h2 className="text-sm font-bold uppercase tracking-wider text-[var(--text-main)]">
                Acquire an Organization API Key
              </h2>
            </div>
            {!keyGenerated && (
              <button
                onClick={handleGenerateKey}
                className="px-3 py-1 bg-[var(--primary)] text-[#001f27] text-xs font-bold uppercase rounded-sm hover:bg-[#00b8e6] transition-colors"
              >
                Generate Live Key
              </button>
            )}
          </div>

          <p className="text-xs text-[var(--text-muted)]">
            AgentShield uses 256-bit cryptographic API keys with prefixed display tokens to authenticate SDK telemetry.
          </p>

          <div className="flex items-center gap-2">
            <div className="flex-1 p-2.5 bg-[var(--bg-base)] border border-[var(--border-color)] rounded-sm text-xs text-[var(--primary)] select-all truncate">
              {apiKey}
            </div>
            <button
              onClick={() => handleCopy(apiKey)}
              className="px-3 py-2 border border-[var(--border-color)] text-xs rounded-sm hover:border-[var(--primary)] transition-colors flex items-center gap-1"
            >
              <span className="material-symbols-outlined text-[16px]">
                {copiedKey ? 'check' : 'content_copy'}
              </span>
              {copiedKey ? 'Copied' : 'Copy'}
            </button>
          </div>
        </div>

        {/* Step 2: Install Package */}
        <div className="p-6 bg-[var(--bg-surface)] border border-[var(--border-color)] rounded-sm space-y-4">
          <div className="flex items-center gap-3">
            <span className="w-6 h-6 rounded-full bg-[var(--primary)] text-[#001f27] text-xs font-bold flex items-center justify-center">
              2
            </span>
            <h2 className="text-sm font-bold uppercase tracking-wider text-[var(--text-main)]">
              Install the AgentShield Python SDK
            </h2>
          </div>

          <p className="text-xs text-[var(--text-muted)]">
            Install the SDK locally from the repository with all framework integrations enabled:
          </p>

          <div className="p-3 bg-[var(--bg-base)] border border-[var(--border-color)] rounded-sm text-xs text-[var(--text-main)] flex items-center justify-between">
            <code>pip install ./sdk/python[all]</code>
            <button
              onClick={() => handleCopy('pip install ./sdk/python[all]')}
              className="text-[var(--text-muted)] hover:text-[var(--primary)]"
              title="Copy Command"
            >
              <span className="material-symbols-outlined text-[16px]">content_copy</span>
            </button>
          </div>
        </div>

        {/* Step 3: Integration Code */}
        <div className="p-6 bg-[var(--bg-surface)] border border-[var(--border-color)] rounded-sm space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <span className="w-6 h-6 rounded-full bg-[var(--primary)] text-[#001f27] text-xs font-bold flex items-center justify-center">
                3
              </span>
              <h2 className="text-sm font-bold uppercase tracking-wider text-[var(--text-main)]">
                Instrument Your Agent
              </h2>
            </div>

            {/* Framework Switcher Tabs */}
            <div className="flex border border-[var(--border-color)] rounded-sm overflow-hidden text-xs">
              {(['python', 'langchain', 'crewai', 'openai'] as FrameworkTab[]).map((tab) => (
                <button
                  key={tab}
                  onClick={() => setSelectedFramework(tab)}
                  className={`px-3 py-1 uppercase text-[11px] font-bold transition-colors ${
                    selectedFramework === tab
                      ? 'bg-[var(--primary)] text-[#001f27]'
                      : 'bg-[var(--bg-surface)] text-[var(--text-muted)] hover:text-[var(--text-main)]'
                  }`}
                >
                  {tab}
                </button>
              ))}
            </div>
          </div>

          <div className="relative">
            <pre className="p-4 bg-[var(--bg-base)] border border-[var(--border-color)] rounded-sm text-xs text-[var(--text-main)] overflow-x-auto leading-relaxed">
              {codeSnippets[selectedFramework]}
            </pre>
            <button
              onClick={() => handleCopy(codeSnippets[selectedFramework])}
              className="absolute top-3 right-3 p-1.5 bg-[var(--bg-surface)] border border-[var(--border-color)] rounded text-[var(--text-muted)] hover:text-[var(--primary)]"
              title="Copy snippet"
            >
              <span className="material-symbols-outlined text-[16px]">content_copy</span>
            </button>
          </div>
        </div>

        {/* Step 4: Verification & Ping */}
        <div className="p-6 bg-[var(--bg-surface)] border border-[var(--border-color)] rounded-sm space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <span className="w-6 h-6 rounded-full bg-[var(--primary)] text-[#001f27] text-xs font-bold flex items-center justify-center">
                4
              </span>
              <h2 className="text-sm font-bold uppercase tracking-wider text-[var(--text-main)]">
                Verify Connectivity
              </h2>
            </div>

            <button
              onClick={handleTestPing}
              disabled={pingStatus === 'testing'}
              className="px-3 py-1 bg-[var(--bg-raised)] border border-[var(--border-color)] text-xs text-[var(--text-main)] hover:border-[var(--primary)] rounded-sm transition-colors flex items-center gap-1.5"
            >
              <span className={`material-symbols-outlined text-[16px] ${pingStatus === 'testing' ? 'animate-spin' : ''}`}>
                {pingStatus === 'testing' ? 'sync' : 'network_ping'}
              </span>
              Run Backend Ping
            </button>
          </div>

          <p className="text-xs text-[var(--text-muted)]">
            Verify connectivity using the CLI tool in your terminal:
          </p>

          <div className="p-3 bg-[var(--bg-base)] border border-[var(--border-color)] rounded-sm text-xs text-[var(--text-main)] flex items-center justify-between">
            <code>agentshield ping --api-key {apiKey.substring(0, 20)}...</code>
            <button
              onClick={() => handleCopy(`agentshield ping --api-key ${apiKey}`)}
              className="text-[var(--text-muted)] hover:text-[var(--primary)]"
            >
              <span className="material-symbols-outlined text-[16px]">content_copy</span>
            </button>
          </div>

          {pingStatus !== 'idle' && (
            <div
              className={`p-3 rounded-sm border text-xs flex items-center gap-2 ${
                pingStatus === 'online'
                  ? 'bg-[rgba(0,255,157,0.05)] border-[var(--status-success)] text-[var(--status-success)]'
                  : pingStatus === 'offline'
                  ? 'bg-[rgba(255,51,102,0.05)] border-[var(--status-danger)] text-[var(--status-danger)]'
                  : 'bg-[var(--bg-base)] border-[var(--border-color)] text-[var(--text-muted)]'
              }`}
            >
              <span className="material-symbols-outlined text-[18px]">
                {pingStatus === 'online' ? 'check_circle' : pingStatus === 'offline' ? 'error' : 'hourglass_empty'}
              </span>
              {pingStatus === 'online'
                ? 'Backend is ONLINE and accepting telemetry on http://localhost:8000/api/v1'
                : pingStatus === 'offline'
                ? 'Backend unreachable on http://localhost:8000. Start backend using `make dev` or `docker compose up`.'
                : 'Pinging backend...'}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
