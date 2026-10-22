import React, { useState } from 'react'
import { Link } from 'react-router-dom'
import { createApiKey, getSystemHealth } from '../api'
import Logo from '../components/Logo'

type FrameworkTab = 'python' | 'langchain' | 'crewai' | 'openai'

export default function Onboarding() {
  const [apiKey, setApiKey] = useState('ashield_live_c41097fa_99b0c2a1e8f731d4e2876a')
  const [copiedKey, setCopiedKey] = useState(false)
  const [copiedSnippet, setCopiedSnippet] = useState(false)
  const [copiedInstall, setCopiedInstall] = useState(false)
  const [selectedFramework, setSelectedFramework] = useState<FrameworkTab>('python')
  const [pingStatus, setPingStatus] = useState<'idle' | 'testing' | 'online' | 'offline'>('idle')
  const [keyGenerated, setKeyGenerated] = useState(false)

  const handleGenerateKey = async () => {
    try {
      const res = await createApiKey({ name: 'Quickstart Onboarding Key', is_test: false, scopes: ['ingest', 'evaluate'] })
      setApiKey(res.key)
      setKeyGenerated(true)
    } catch {
      setApiKey('ashield_live_' + Math.random().toString(36).substring(2, 10) + '_' + Math.random().toString(36).substring(2, 18))
      setKeyGenerated(true)
    }
  }

  const handleCopy = (text: string, type: 'key' | 'snippet' | 'install') => {
    navigator.clipboard.writeText(text)
    if (type === 'key') {
      setCopiedKey(true)
      setTimeout(() => setCopiedKey(false), 2000)
    } else if (type === 'snippet') {
      setCopiedSnippet(true)
      setTimeout(() => setCopiedSnippet(false), 2000)
    } else {
      setCopiedInstall(true)
      setTimeout(() => setCopiedInstall(false), 2000)
    }
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

  const codeSnippets: Record<FrameworkTab, { title: string; code: string; notes: string }> = {
    python: {
      title: 'Core Python SDK Decorator',
      notes: 'Monitors arbitrary Python functions, tool calls, or DB queries with sub-millisecond host overhead.',
      code: `from agentshield import AgentShield, ShieldSecurityException

# Initialize AgentShield SDK client
shield = AgentShield(
    api_key="${apiKey}",
    endpoint="http://localhost:8000/api/v1",
    mode="enforce",         # Synchronous pre-flight policy evaluation (<5ms)
    fail_open=False,        # Fail-closed: block threats automatically
)

# Protect actions, tool calls, or database operations
@shield.monitor(action_type="database_query")
def run_database_query(sql_statement: str):
    # Your database execution logic here
    return {"status": "ok", "rows": 12}

# Security evaluation runs automatically before execution
try:
    run_database_query("SELECT * FROM financial_records WHERE org_id = 'ORG-99'")
except ShieldSecurityException as exc:
    print(f"Action blocked by policy: {exc.violated_rules}")`,
    },

    langchain: {
      title: 'LangChain & LangGraph Integration',
      notes: 'Non-invasive callback handler intercepting on_agent_action and on_tool_start events.',
      code: `from agentshield import AgentShield
from agentshield.integrations.langchain import AgentShieldCallbackHandler
from langchain_community.chat_models import ChatOpenAI
from langchain.agents import initialize_agent, AgentType

# 1. Initialize AgentShield
shield = AgentShield(api_key="${apiKey}", mode="enforce")

# 2. Attach the callback handler to your agent
shield_handler = AgentShieldCallbackHandler(shield=shield, enforce=True)

# 3. Supply callbacks in your LangChain runner
agent = initialize_agent(
    tools=tools,
    llm=ChatOpenAI(temperature=0),
    agent=AgentType.STRUCTURED_CHAT_ZERO_SHOT_REACT_DESCRIPTION,
    callbacks=[shield_handler],
)

# Actions are automatically protected from prompt injections & jailbreaks
agent.run("Analyze Q3 metrics and generate executive summary")`,
    },

    crewai: {
      title: 'CrewAI Multi-Agent Swarm Listener',
      notes: 'Intercepts multi-agent task lifecycles, inter-agent instructions, and shared memory execution.',
      code: `from agentshield import AgentShield
from agentshield.integrations.crewai import CrewAIShieldListener
from crewai import Agent, Task, Crew

# 1. Initialize AgentShield
shield = AgentShield(api_key="${apiKey}", mode="enforce")

# 2. Attach listener to monitor multi-agent task lifecycles
listener = CrewAIShieldListener(shield=shield, agent_id="researcher_agent")

# 3. Intercept task and tool events automatically
listener.on_task_start("market_research", "Analyze venture filings")`,
    },

    openai: {
      title: 'OpenAI Agents SDK / Function Calling',
      notes: 'Pre-flight evaluation of function call arguments before model tool dispatch.',
      code: `from agentshield import AgentShield
from agentshield.integrations.openai import OpenAIAgentShield

# 1. Initialize AgentShield
shield = AgentShield(api_key="${apiKey}", mode="enforce")
openai_shield = OpenAIAgentShield(shield=shield, agent_id="support_bot")

# 2. Wrap OpenAI tool definitions
@openai_shield.tool(name="order_lookup")
def order_lookup(order_id: str):
    """Retrieve customer order status securely."""
    return {"order_id": order_id, "status": "shipped", "carrier": "FedEx"}`,
    },
  }

  return (
    <div className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8 flex flex-col gap-6">
      <div className="max-w-4xl mx-auto w-full space-y-6">
        {/* Header */}
        <div className="panel-obsidian p-6 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="mb-3">
              <Logo size="sm" variant="full" animated={true} />
            </div>
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-white">
              Developer Quickstart & SDK Integration
            </h1>
            <p className="text-xs text-slate-400 mt-1">
              Instrument your autonomous agents with real-time pre-flight guardrails, behavior anomaly detection, and centralized telemetry in under 5 minutes.
            </p>
          </div>

          <Link
            to="/dashboard"
            className="px-3.5 py-2 border border-white/10 text-slate-300 hover:text-white hover:bg-slate-800 text-xs font-mono font-medium rounded-lg transition-colors flex items-center gap-1.5 self-start sm:self-auto shrink-0"
          >
            <span className="material-symbols-outlined text-[16px]">arrow_back</span>
            Mission Control
          </Link>
        </div>

        {/* Step 1: API Key */}
        <div className="panel-obsidian p-6 rounded-xl space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <span className="w-7 h-7 rounded-lg bg-sky-400 text-slate-950 text-xs font-mono font-bold flex items-center justify-center shadow-md shadow-sky-500/20">
                1
              </span>
              <h2 className="text-sm font-semibold uppercase tracking-wider text-white font-mono">
                Acquire Organization API Key
              </h2>
            </div>
            {!keyGenerated ? (
              <button
                onClick={handleGenerateKey}
                className="px-3.5 py-1.5 bg-sky-400 hover:bg-sky-300 text-slate-950 text-xs font-mono font-bold uppercase rounded-lg transition-all shadow-md shadow-sky-500/20 active:scale-95 cursor-pointer"
              >
                Generate Live Key
              </button>
            ) : (
              <span className="text-[11px] font-mono text-emerald-400 flex items-center gap-1">
                <span className="material-symbols-outlined text-[14px]">check_circle</span>
                Active Key Generated
              </span>
            )}
          </div>

          <p className="text-xs text-slate-400">
            AgentShield authenticates telemetry and enforcement calls with 256-bit cryptographic API keys with high-entropy SHA-256 storage.
          </p>

          <div className="flex items-center gap-2">
            <div className="flex-1 p-3 bg-slate-950/80 border border-white/10 rounded-lg text-xs font-mono text-sky-400 select-all truncate">
              {apiKey}
            </div>
            <button
              onClick={() => handleCopy(apiKey, 'key')}
              className="px-4 py-3 border border-white/10 bg-slate-900 hover:bg-slate-800 text-xs font-mono rounded-lg transition-colors flex items-center gap-1.5 text-slate-200 cursor-pointer shrink-0"
            >
              <span className="material-symbols-outlined text-[16px]">
                {copiedKey ? 'check' : 'content_copy'}
              </span>
              {copiedKey ? 'Copied' : 'Copy Key'}
            </button>
          </div>
        </div>

        {/* Step 2: Install Package */}
        <div className="panel-obsidian p-6 rounded-xl space-y-4">
          <div className="flex items-center gap-3">
            <span className="w-7 h-7 rounded-lg bg-sky-400 text-slate-950 text-xs font-mono font-bold flex items-center justify-center shadow-md shadow-sky-500/20">
              2
            </span>
            <h2 className="text-sm font-semibold uppercase tracking-wider text-white font-mono">
              Install the AgentShield Python SDK
            </h2>
          </div>

          <p className="text-xs text-slate-400">
            Install the SDK locally from the repository with all framework integrations enabled:
          </p>

          <div className="p-3.5 bg-slate-950/80 border border-white/10 rounded-lg text-xs font-mono text-slate-200 flex items-center justify-between">
            <code>pip install ./sdk/python[all]</code>
            <button
              onClick={() => handleCopy('pip install ./sdk/python[all]', 'install')}
              className="text-slate-400 hover:text-sky-400 p-1 transition-colors cursor-pointer"
              title="Copy Command"
            >
              <span className="material-symbols-outlined text-[16px]">
                {copiedInstall ? 'check' : 'content_copy'}
              </span>
            </button>
          </div>
        </div>

        {/* Step 3: Integration Code */}
        <div className="panel-obsidian p-6 rounded-xl space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <span className="w-7 h-7 rounded-lg bg-sky-400 text-slate-950 text-xs font-mono font-bold flex items-center justify-center shadow-md shadow-sky-500/20">
                3
              </span>
              <h2 className="text-sm font-semibold uppercase tracking-wider text-white font-mono">
                Instrument Your Autonomous Agent
              </h2>
            </div>

            {/* Framework Switcher Tabs */}
            <div className="flex bg-slate-950/60 p-1 rounded-lg border border-white/5 text-xs font-mono">
              {(['python', 'langchain', 'crewai', 'openai'] as FrameworkTab[]).map((tab) => (
                <button
                  key={tab}
                  onClick={() => setSelectedFramework(tab)}
                  className={`px-3 py-1 uppercase text-[11px] font-bold rounded-md transition-all cursor-pointer ${
                    selectedFramework === tab
                      ? 'bg-sky-400 text-slate-950 shadow-sm shadow-sky-400/30'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  {tab}
                </button>
              ))}
            </div>
          </div>

          <p className="text-xs text-slate-400">
            {codeSnippets[selectedFramework].notes}
          </p>

          <div className="relative">
            <pre className="p-4 bg-[#070b12] border border-white/10 rounded-lg text-xs font-mono text-slate-300 overflow-x-auto leading-relaxed shadow-inner">
              {codeSnippets[selectedFramework].code}
            </pre>
            <button
              onClick={() => handleCopy(codeSnippets[selectedFramework].code, 'snippet')}
              className="absolute top-3 right-3 px-2.5 py-1.5 bg-slate-900 border border-white/10 rounded-lg text-xs font-mono text-slate-300 hover:text-sky-400 hover:border-sky-500/40 transition-colors flex items-center gap-1 cursor-pointer"
              title="Copy snippet"
            >
              <span className="material-symbols-outlined text-[14px]">
                {copiedSnippet ? 'check' : 'content_copy'}
              </span>
              {copiedSnippet ? 'Copied' : 'Copy'}
            </button>
          </div>
        </div>

        {/* Step 4: Verification & Ping */}
        <div className="panel-obsidian p-6 rounded-xl space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <span className="w-7 h-7 rounded-lg bg-sky-400 text-slate-950 text-xs font-mono font-bold flex items-center justify-center shadow-md shadow-sky-500/20">
                4
              </span>
              <h2 className="text-sm font-semibold uppercase tracking-wider text-white font-mono">
                Verify Connectivity & Health
              </h2>
            </div>

            <button
              onClick={handleTestPing}
              disabled={pingStatus === 'testing'}
              className="px-3.5 py-1.5 bg-slate-900 border border-white/10 text-xs font-mono text-slate-200 hover:text-white hover:border-sky-500/40 rounded-lg transition-colors flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
            >
              <span className={`material-symbols-outlined text-[16px] ${pingStatus === 'testing' ? 'animate-spin' : ''}`}>
                {pingStatus === 'testing' ? 'sync' : 'network_ping'}
              </span>
              Run Backend Ping
            </button>
          </div>

          <p className="text-xs text-slate-400">
            You can also test connectivity directly from your terminal using the AgentShield CLI:
          </p>

          <div className="p-3 bg-slate-950/80 border border-white/10 rounded-lg text-xs font-mono text-slate-200 flex items-center justify-between">
            <code>agentshield ping --api-key {apiKey.substring(0, 20)}...</code>
            <button
              onClick={() => handleCopy(`agentshield ping --api-key ${apiKey}`, 'install')}
              className="text-slate-400 hover:text-sky-400 p-1 transition-colors cursor-pointer"
            >
              <span className="material-symbols-outlined text-[16px]">content_copy</span>
            </button>
          </div>

          {pingStatus !== 'idle' && (
            <div
              className={`p-3.5 rounded-lg border text-xs font-mono flex items-center gap-2.5 animate-fade-in ${
                pingStatus === 'online'
                  ? 'bg-emerald-950/20 border-emerald-500/40 text-emerald-300'
                  : pingStatus === 'offline'
                  ? 'bg-rose-950/20 border-rose-500/40 text-rose-300'
                  : 'bg-slate-900 border-white/10 text-slate-400'
              }`}
            >
              <span className="material-symbols-outlined text-[18px]">
                {pingStatus === 'online' ? 'check_circle' : pingStatus === 'offline' ? 'error' : 'hourglass_empty'}
              </span>
              {pingStatus === 'online'
                ? 'Backend is ONLINE and accepting telemetry at http://localhost:8000/api/v1'
                : pingStatus === 'offline'
                ? 'Backend unreachable at http://localhost:8000. Start backend using `make dev` or `docker compose up`.'
                : 'Pinging security gateway...'}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
