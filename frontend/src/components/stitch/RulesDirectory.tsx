import React, { useState } from 'react'

export interface Rule {
  id: string
  name: string
  description?: string
  category: 'Access Control' | 'Network' | 'Input Validation' | 'File System' | 'Rate Limiting'
  severity: 'Critical' | 'High' | 'Medium' | 'Low'
  matches: number
  active: boolean
  jsonCondition: string
}

const initialRules: Rule[] = [
  {
    id: 'RUL-001',
    name: 'Unauthorized File Access',
    description: 'Detects agent attempts to read sensitive system configuration or credential files.',
    category: 'File System',
    severity: 'High',
    matches: 1204,
    active: true,
    jsonCondition: JSON.stringify(
      {
        field: 'action.parameters.path',
        operator: 'regex_match',
        pattern: '^(/etc/shadow|/etc/passwd|credentials\\.json|\\.env)',
      },
      null,
      2
    ),
  },
  {
    id: 'RUL-002',
    name: 'Excessive API Rate Limiter',
    description: 'Triggers when an agent issues calls beyond the allowed frequency threshold.',
    category: 'Rate Limiting',
    severity: 'Medium',
    matches: 342,
    active: true,
    jsonCondition: JSON.stringify(
      {
        rate_window: '60s',
        max_requests: 100,
        trigger_action: 'throttle_and_alert',
      },
      null,
      2
    ),
  },
  {
    id: 'RUL-003',
    name: 'Prompt Injection Pattern',
    description: 'Identifies known adversarial LLM jailbreak sequences and delimiter escapes.',
    category: 'Input Validation',
    severity: 'Critical',
    matches: 89,
    active: true,
    jsonCondition: JSON.stringify(
      {
        field: 'action.parameters.prompt',
        operator: 'contains_any',
        values: [
          'ignore previous instructions',
          'system override',
          'DAN mode',
          'you are no longer bound by rules',
        ],
      },
      null,
      2
    ),
  },
  {
    id: 'RUL-004',
    name: 'Privilege Escalation Attempt',
    description: 'Flags actions executing sudo or attempting role manipulation.',
    category: 'Access Control',
    severity: 'Critical',
    matches: 12,
    active: true,
    jsonCondition: JSON.stringify(
      {
        field: 'action.action_type',
        operator: 'in',
        values: ['grant_role', 'sudo_exec', 'elevate_permissions'],
      },
      null,
      2
    ),
  },
  {
    id: 'RUL-005',
    name: 'Outbound Data Exfiltration',
    description: 'Detects unexpected transmission of large payloads to non-whitelisted destinations.',
    category: 'Network',
    severity: 'High',
    matches: 0,
    active: false,
    jsonCondition: JSON.stringify(
      {
        field: 'action.parameters.bytes_out',
        operator: 'greater_than',
        threshold_mb: 50,
        target_whitelist: ['internal.corp', 'api.internal'],
      },
      null,
      2
    ),
  },
]

export default function RulesDirectory() {
  const [rules, setRules] = useState<Rule[]>(() => {
    const saved = localStorage.getItem('agentshield_rules')
    if (saved) {
      try {
        return JSON.parse(saved)
      } catch {}
    }
    return initialRules
  })

  const [activeTab, setActiveTab] = useState<'all' | 'active' | 'disabled'>('all')
  const [categoryFilter, setCategoryFilter] = useState<string>('all')
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedRuleId, setSelectedRuleId] = useState<string | null>('RUL-001')
  const [toastMessage, setToastMessage] = useState<string | null>(null)

  // Form State
  const [formName, setFormName] = useState('')
  const [formDescription, setFormDescription] = useState('')
  const [formCategory, setFormCategory] = useState<Rule['category']>('Access Control')
  const [formSeverity, setFormSeverity] = useState<Rule['severity']>('High')
  const [formCondition, setFormCondition] = useState('')
  const [formActive, setFormActive] = useState(true)
  const [jsonError, setJsonError] = useState<string | null>(null)

  const showToast = (msg: string) => {
    setToastMessage(msg)
    setTimeout(() => setToastMessage(null), 3000)
  }

  const saveRulesToStorage = (updated: Rule[]) => {
    setRules(updated)
    localStorage.setItem('agentshield_rules', JSON.stringify(updated))
  }

  // When selectedRuleId changes, sync into form
  React.useEffect(() => {
    if (selectedRuleId === 'NEW') {
      setFormName('')
      setFormDescription('')
      setFormCategory('Access Control')
      setFormSeverity('High')
      setFormActive(true)
      setFormCondition(
        JSON.stringify(
          {
            field: 'action.parameters.target',
            operator: 'equals',
            value: 'restricted_asset',
          },
          null,
          2
        )
      )
      setJsonError(null)
    } else if (selectedRuleId) {
      const r = rules.find((item) => item.id === selectedRuleId)
      if (r) {
        setFormName(r.name)
        setFormDescription(r.description || '')
        setFormCategory(r.category)
        setFormSeverity(r.severity)
        setFormActive(r.active)
        setFormCondition(r.jsonCondition)
        setJsonError(null)
      }
    }
  }, [selectedRuleId, rules])

  const handleToggleRule = (id: string, e: React.MouseEvent) => {
    e.stopPropagation()
    const updated = rules.map((r) => (r.id === id ? { ...r, active: !r.active } : r))
    saveRulesToStorage(updated)
    showToast(`Rule ${id} toggled ${updated.find((r) => r.id === id)?.active ? 'ON' : 'OFF'}.`)
  }

  const handleDeleteRule = (id: string, e: React.MouseEvent) => {
    e.stopPropagation()
    const updated = rules.filter((r) => r.id !== id)
    saveRulesToStorage(updated)
    if (selectedRuleId === id) {
      setSelectedRuleId(updated[0]?.id || 'NEW')
    }
    showToast(`Rule ${id} deleted.`)
  }

  const handleFormatJson = () => {
    try {
      const parsed = JSON.parse(formCondition)
      setFormCondition(JSON.stringify(parsed, null, 2))
      setJsonError(null)
      showToast('JSON condition formatted successfully.')
    } catch (err: any) {
      setJsonError('Invalid JSON: ' + err.message)
    }
  }

  const handleSaveRule = () => {
    if (!formName.trim()) {
      showToast('Please enter a rule name.')
      return
    }

    try {
      JSON.parse(formCondition)
    } catch {
      setJsonError('Condition must be valid JSON.')
      return
    }

    if (selectedRuleId === 'NEW' || !selectedRuleId) {
      const nextNum = rules.length + 1
      const newId = `RUL-${nextNum.toString().padStart(3, '0')}`
      const newRule: Rule = {
        id: newId,
        name: formName.trim(),
        description: formDescription.trim(),
        category: formCategory,
        severity: formSeverity,
        matches: 0,
        active: formActive,
        jsonCondition: formCondition,
      }
      const updated = [...rules, newRule]
      saveRulesToStorage(updated)
      setSelectedRuleId(newId)
      showToast(`Rule ${newId} created successfully.`)
    } else {
      const updated = rules.map((r) =>
        r.id === selectedRuleId
          ? {
              ...r,
              name: formName.trim(),
              description: formDescription.trim(),
              category: formCategory,
              severity: formSeverity,
              active: formActive,
              jsonCondition: formCondition,
            }
          : r
      )
      saveRulesToStorage(updated)
      showToast(`Rule ${selectedRuleId} updated successfully.`)
    }
  }

  const filteredRules = rules
    .filter((r) => {
      if (activeTab === 'active') return r.active
      if (activeTab === 'disabled') return !r.active
      return true
    })
    .filter((r) => categoryFilter === 'all' || r.category === categoryFilter)
    .filter(
      (r) =>
        r.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        r.id.toLowerCase().includes(searchTerm.toLowerCase())
    )

  return (
    <div className="flex-1 overflow-y-auto p-6 flex flex-col gap-6">
      {toastMessage && (
        <div className="fixed top-20 right-8 z-50 rounded-sm bg-[var(--bg-raised)] border border-[var(--primary)] px-4 py-2 font-mono text-xs text-[var(--primary)] shadow-2xl flex items-center gap-2">
          <span className="material-symbols-outlined text-[16px]">check_circle</span>
          {toastMessage}
        </div>
      )}

      {/* Header and Controls */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-[var(--bg-surface)] p-4 border border-[var(--border-color)] rounded-sm">
        <div className="flex flex-wrap items-center gap-4">
          <h2 className="text-[var(--text-main)] text-[20px] font-semibold font-mono">Security Rule Engine</h2>

          <div className="flex items-center gap-1 bg-[var(--bg-base)] p-1 rounded-sm border border-[var(--border-color)]">
            {(['all', 'active', 'disabled'] as const).map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`px-3 py-1 font-mono text-xs uppercase rounded-sm transition-colors cursor-pointer ${
                  activeTab === tab
                    ? 'bg-[var(--primary)] text-[#001f27] font-bold'
                    : 'text-[var(--text-muted)] hover:text-[var(--text-main)]'
                }`}
              >
                {tab}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-2">
            <input
              className="bg-[var(--bg-base)] border border-[var(--border-color)] rounded-sm px-3 py-1 text-xs text-[var(--text-main)] placeholder-[var(--text-muted)] focus:outline-none focus:border-[var(--primary)] font-mono w-44"
              placeholder="Filter rules..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="bg-[var(--bg-base)] border border-[var(--border-color)] rounded-sm px-2 py-1 text-xs text-[var(--text-main)] focus:outline-none focus:border-[var(--primary)] font-mono cursor-pointer"
            >
              <option value="all">Category: All</option>
              <option value="Access Control">Access Control</option>
              <option value="Network">Network</option>
              <option value="Input Validation">Input Validation</option>
              <option value="File System">File System</option>
              <option value="Rate Limiting">Rate Limiting</option>
            </select>
          </div>
        </div>

        <button
          onClick={() => setSelectedRuleId('NEW')}
          className="px-3 py-1.5 text-[#001f27] font-mono text-xs font-bold uppercase bg-[var(--primary)] hover:bg-[#00b8e6] rounded-sm flex items-center gap-1.5 transition-colors cursor-pointer"
        >
          <span className="material-symbols-outlined text-[16px]">add</span>
          New Rule
        </button>
      </div>

      {/* Main Two-Column Layout */}
      <div className="flex flex-col lg:flex-row gap-6">
        {/* Left: Rules Table */}
        <div className="flex-1 bg-[var(--bg-surface)] border border-[var(--border-color)] rounded-sm overflow-hidden flex flex-col">
          <div className="overflow-x-auto flex-1">
            <table className="w-full text-left border-collapse whitespace-nowrap">
              <thead>
                <tr className="bg-[var(--bg-base)] border-b border-[var(--border-color)] text-[var(--text-muted)] font-mono text-xs uppercase tracking-wider">
                  <th className="p-3 w-16">ID</th>
                  <th className="p-3">Rule Name</th>
                  <th className="p-3">Category</th>
                  <th className="p-3">Severity</th>
                  <th className="p-3 text-right">Matches</th>
                  <th className="p-3 text-center w-16">Active</th>
                  <th className="p-3 text-right w-16">Action</th>
                </tr>
              </thead>
              <tbody className="font-mono text-xs text-[var(--text-main)] divide-y divide-[var(--border-color)]">
                {filteredRules.map((r) => {
                  const isSelected = selectedRuleId === r.id
                  return (
                    <tr
                      key={r.id}
                      onClick={() => setSelectedRuleId(r.id)}
                      className={`cursor-pointer transition-colors hover:bg-[var(--bg-hover)] border-l-4 ${
                        isSelected
                          ? 'border-l-[var(--primary)] bg-[rgba(0,212,255,0.05)]'
                          : r.active
                          ? 'border-l-[var(--status-success)]'
                          : 'border-l-[var(--border-color)] opacity-60'
                      }`}
                    >
                      <td className="p-3 text-[var(--primary)] font-bold">{r.id}</td>
                      <td className="p-3 font-semibold text-[var(--text-main)]">{r.name}</td>
                      <td className="p-3">
                        <span className="px-2 py-0.5 rounded-sm text-[10px] bg-[var(--bg-base)] text-[var(--text-muted)] border border-[var(--border-color)]">
                          {r.category}
                        </span>
                      </td>
                      <td className="p-3">
                        <span
                          className={`font-bold uppercase text-[11px] ${
                            r.severity === 'Critical'
                              ? 'text-[var(--status-danger)]'
                              : r.severity === 'High'
                              ? 'text-[var(--status-warning)]'
                              : r.severity === 'Medium'
                              ? 'text-[var(--status-info)]'
                              : 'text-[var(--text-muted)]'
                          }`}
                        >
                          {r.severity}
                        </span>
                      </td>
                      <td className="p-3 text-right font-bold">{r.matches.toLocaleString()}</td>
                      <td className="p-3 text-center" onClick={(e) => handleToggleRule(r.id, e)}>
                        <button
                          className={`w-9 h-5 rounded-full p-0.5 transition-colors cursor-pointer inline-flex items-center ${
                            r.active ? 'bg-[var(--primary)]' : 'bg-[var(--border-color)]'
                          }`}
                        >
                          <span
                            className={`w-4 h-4 rounded-full bg-white transition-transform ${
                              r.active ? 'translate-x-4' : 'translate-x-0'
                            }`}
                          />
                        </button>
                      </td>
                      <td className="p-3 text-right" onClick={(e) => handleDeleteRule(r.id, e)}>
                        <button
                          title="Delete Rule"
                          className="p-1 text-[var(--text-muted)] hover:text-[var(--status-danger)] transition-colors cursor-pointer"
                        >
                          <span className="material-symbols-outlined text-[16px]">delete</span>
                        </button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          {/* Quick Metrics Footer */}
          <div className="grid grid-cols-4 border-t border-[var(--border-color)] bg-[var(--bg-base)] p-3 text-center font-mono">
            <div>
              <div className="text-[10px] text-[var(--text-muted)] uppercase">Total Rules</div>
              <div className="text-sm font-bold text-[var(--text-main)]">{rules.length}</div>
            </div>
            <div>
              <div className="text-[10px] text-[var(--text-muted)] uppercase">Active</div>
              <div className="text-sm font-bold text-[var(--status-success)]">
                {rules.filter((r) => r.active).length}
              </div>
            </div>
            <div>
              <div className="text-[10px] text-[var(--text-muted)] uppercase">Disabled</div>
              <div className="text-sm font-bold text-[var(--text-muted)]">
                {rules.filter((r) => !r.active).length}
              </div>
            </div>
            <div>
              <div className="text-[10px] text-[var(--text-muted)] uppercase">Total Matches</div>
              <div className="text-sm font-bold text-[var(--primary)]">
                {rules.reduce((acc, r) => acc + r.matches, 0).toLocaleString()}
              </div>
            </div>
          </div>
        </div>

        {/* Right: Controlled Rule Editor */}
        <div className="w-full lg:w-[460px] bg-[var(--bg-surface)] border border-[var(--border-color)] rounded-sm flex flex-col shrink-0">
          <div className="p-4 border-b border-[var(--border-color)] flex items-center justify-between">
            <h3 className="text-sm font-semibold text-[var(--text-main)] font-mono uppercase tracking-wider">
              {selectedRuleId === 'NEW' ? 'Create New Security Rule' : `Rule Editor • ${selectedRuleId}`}
            </h3>
            <span className="text-[11px] font-mono text-[var(--text-muted)]">
              {selectedRuleId === 'NEW' ? 'DRAFT' : 'STORED'}
            </span>
          </div>

          <div className="p-4 flex-1 flex flex-col gap-4 overflow-y-auto">
            {/* Rule Name */}
            <div>
              <label className="block text-[11px] font-mono uppercase tracking-wider text-[var(--text-muted)] mb-1">
                Rule Name
              </label>
              <input
                value={formName}
                onChange={(e) => setFormName(e.target.value)}
                placeholder="e.g. Detect Unauthorized Executable"
                className="w-full bg-[var(--bg-base)] border border-[var(--border-color)] rounded-sm px-3 py-1.5 text-xs text-[var(--text-main)] focus:border-[var(--primary)] font-mono outline-none"
              />
            </div>

            {/* Description */}
            <div>
              <label className="block text-[11px] font-mono uppercase tracking-wider text-[var(--text-muted)] mb-1">
                Description
              </label>
              <textarea
                value={formDescription}
                onChange={(e) => setFormDescription(e.target.value)}
                placeholder="Details of what this rule detects..."
                rows={2}
                className="w-full bg-[var(--bg-base)] border border-[var(--border-color)] rounded-sm px-3 py-1.5 text-xs text-[var(--text-main)] focus:border-[var(--primary)] font-mono outline-none resize-none"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] font-mono uppercase tracking-wider text-[var(--text-muted)] mb-1">
                  Category
                </label>
                <select
                  value={formCategory}
                  onChange={(e) => setFormCategory(e.target.value as any)}
                  className="w-full bg-[var(--bg-base)] border border-[var(--border-color)] rounded-sm px-2.5 py-1.5 text-xs text-[var(--text-main)] focus:border-[var(--primary)] font-mono outline-none cursor-pointer"
                >
                  <option value="Access Control">Access Control</option>
                  <option value="Network">Network</option>
                  <option value="Input Validation">Input Validation</option>
                  <option value="File System">File System</option>
                  <option value="Rate Limiting">Rate Limiting</option>
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-mono uppercase tracking-wider text-[var(--text-muted)] mb-1">
                  Severity
                </label>
                <select
                  value={formSeverity}
                  onChange={(e) => setFormSeverity(e.target.value as any)}
                  className="w-full bg-[var(--bg-base)] border border-[var(--border-color)] rounded-sm px-2.5 py-1.5 text-xs text-[var(--text-main)] focus:border-[var(--primary)] font-mono outline-none cursor-pointer"
                >
                  <option value="Critical">Critical</option>
                  <option value="High">High</option>
                  <option value="Medium">Medium</option>
                  <option value="Low">Low</option>
                </select>
              </div>
            </div>

            {/* JSON Condition */}
            <div className="flex-1 flex flex-col">
              <div className="flex items-center justify-between mb-1">
                <label className="text-[11px] font-mono uppercase tracking-wider text-[var(--text-muted)]">
                  Condition Logic (JSON)
                </label>
                <button
                  type="button"
                  onClick={handleFormatJson}
                  className="text-[10px] font-mono text-[var(--primary)] hover:underline flex items-center gap-1 cursor-pointer"
                >
                  <span className="material-symbols-outlined text-[12px]">code</span>
                  FORMAT JSON
                </button>
              </div>
              <textarea
                value={formCondition}
                onChange={(e) => {
                  setFormCondition(e.target.value)
                  setJsonError(null)
                }}
                rows={7}
                spellCheck={false}
                className="w-full bg-[var(--bg-base)] border border-[var(--border-color)] rounded-sm p-2 text-xs font-mono text-[var(--text-main)] focus:border-[var(--primary)] outline-none resize-none leading-relaxed"
              />
              {jsonError && (
                <div className="mt-1 text-[11px] font-mono text-[var(--status-danger)]">
                  {jsonError}
                </div>
              )}
            </div>

            {/* Active Toggle */}
            <label className="flex items-center gap-2 cursor-pointer mt-1">
              <input
                type="checkbox"
                checked={formActive}
                onChange={(e) => setFormActive(e.target.checked)}
                className="rounded-sm border-[var(--border-color)] bg-[var(--bg-base)] text-[var(--primary)] focus:ring-[var(--primary)] cursor-pointer"
              />
              <span className="font-mono text-xs text-[var(--text-main)]">Enable Rule Immediately</span>
            </label>
          </div>

          {/* Action Footer */}
          <div className="p-3 border-t border-[var(--border-color)] bg-[var(--bg-surface)] flex justify-end gap-2">
            <button
              onClick={() => setSelectedRuleId('RUL-001')}
              className="px-3 py-1.5 border border-[var(--border-color)] text-[var(--text-muted)] hover:text-[var(--text-main)] font-mono text-xs rounded-sm cursor-pointer"
            >
              Cancel
            </button>
            <button
              onClick={handleSaveRule}
              className="px-4 py-1.5 bg-[var(--primary)] text-[#001f27] font-mono text-xs font-bold uppercase rounded-sm hover:bg-[#00b8e6] transition-colors cursor-pointer shadow-[0_0_8px_rgba(0,212,255,0.3)]"
            >
              Save Rule
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}