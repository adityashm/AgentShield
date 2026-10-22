import React from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import StitchScreen from '../stitch/StitchScreen'

const STITCH_SCREENS = [
  { id: '003', label: '003 - Command Center Dashboard', file: '/stitch_downloads/003_Dashboard.html' },
  { id: '044', label: '044 - Alerts Triage', file: '/stitch_downloads/044_Alerts_Triage.html' },
  { id: '026', label: '026 - Alerts Management', file: '/stitch_downloads/026_Alerts_Management.html' },
  { id: '011', label: '011 - Alert Triage: Prompt Injection Detected', file: '/stitch_downloads/011_Alert_Triage__Prompt_Injection_Detected.html' },
  { id: '023', label: '023 - Agents Directory', file: '/stitch_downloads/023_Agents_Directory.html' },
  { id: '045', label: '045 - Agents Directory (Alt)', file: '/stitch_downloads/045_Agents_Directory.html' },
  { id: '017', label: '017 - Agent Detail: AGT-009', file: '/stitch_downloads/017_Agent_Detail__AGT-009.html' },
  { id: '041', label: '041 - Agent Configuration: AGT-009', file: '/stitch_downloads/041_Agent_Configuration__AGT-009.html' },
  { id: '008', label: '008 - Communication Log: AGT-009', file: '/stitch_downloads/008_Communication_Log__AGT-009.html' },
  { id: '027', label: '027 - Communication Log: AGT-009 (Alt)', file: '/stitch_downloads/027_Communication_Log__AGT-009.html' },
  { id: '013', label: '013 - Rule Manager', file: '/stitch_downloads/013_Rule_Manager.html' },
  { id: '033', label: '033 - Rule Manager: Guardrail Added', file: '/stitch_downloads/033_Rule_Manager__New_Guardrail_Added.html' },
  { id: '000', label: '000 - Agent Simulator Control', file: '/stitch_downloads/000_Agent_Simulator_Control.html' },
  { id: '002', label: '002 - Simulator Configuration', file: '/stitch_downloads/002_Simulator_Configuration.html' },
  { id: '032', label: '032 - System Logs', file: '/stitch_downloads/032_System_Logs.html' },
  { id: '039', label: '039 - System Logs (Alt)', file: '/stitch_downloads/039_System_Logs.html' },
  { id: '021', label: '021 - System Logs: SIEM Export Enabled', file: '/stitch_downloads/021_System_Logs__SIEM_Export_Enabled.html' },
  { id: '042', label: '042 - System Health Analytics', file: '/stitch_downloads/042_System_Health_Analytics.html' },
  { id: '019', label: '019 - Threat Intel Knowledge Base', file: '/stitch_downloads/019_Threat_Intel_Knowledge_Base.html' },
  { id: '047', label: '047 - Compliance & Audit Vault', file: '/stitch_downloads/047_Compliance___Audit_Vault.html' },
  { id: '029', label: '029 - SIEM Configuration', file: '/stitch_downloads/029_SIEM_Configuration.html' },
  { id: '030', label: '030 - System Settings', file: '/stitch_downloads/030_System_Settings.html' },
  { id: '014', label: '014 - Global System Settings: Refined', file: '/stitch_downloads/014_Global_System_Settings__Refined.html' },
  { id: '012', label: '012 - Security Status Report', file: '/stitch_downloads/012_Security_Status_Report.html' },
  { id: '037', label: '037 - Forensic Log: Prompt Injection', file: '/stitch_downloads/037_Forensic_Log__Prompt_Injection_Analysis.html' },
  { id: '020', label: '020 - Isolate Agent Confirmation', file: '/stitch_downloads/020_Isolate_Agent_Confirmation.html' },
  { id: '009', label: '009 - Login: AgentShield AI', file: '/stitch_downloads/009_Login__AgentShield_AI.html' },
  { id: '031', label: '031 - User Guide', file: '/stitch_downloads/031_User_Guide.html' },
  { id: '028', label: '028 - Support Center', file: '/stitch_downloads/028_Support_Center.html' },
]

export default function StitchView() {
  const { id } = useParams()
  const navigate = useNavigate()

  const currentScreen = STITCH_SCREENS.find((s) => s.id === id) || STITCH_SCREENS[0]
  const src = currentScreen.file

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-[var(--border-color)] pb-4">
        <div>
          <div className="text-xs uppercase tracking-[0.25em] text-[var(--primary)] font-mono">Stitch MCP Template Gallery</div>
          <h2 className="mt-1 text-2xl font-semibold text-[var(--text-main)]">{currentScreen.label}</h2>
          <p className="mt-1 text-xs text-[var(--text-muted)]">
            High-fidelity HTML asset imported directly from Stitch MCP server
          </p>
        </div>

        <div className="flex items-center gap-3">
          <label className="text-xs font-mono text-[var(--text-muted)] uppercase">Select Template:</label>
          <select
            value={currentScreen.id}
            onChange={(e) => navigate(`/stitch/${e.target.value}`)}
            className="rounded-sm border border-[var(--border-color)] bg-[var(--bg-raised)] px-3 py-1.5 font-mono text-xs text-[var(--text-main)] focus:border-[var(--primary)] focus:outline-none"
          >
            {STITCH_SCREENS.map((s) => (
              <option key={s.id} value={s.id}>
                {s.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="rounded-sm border border-[var(--border-color)] bg-[var(--bg-raised)] p-2 shadow-2xl overflow-hidden">
        <StitchScreen src={src} title={currentScreen.label} />
      </div>
    </div>
  )
}
