# AgentShield AI — Threat Model & Security Posture

> **Standard Alignment**: OWASP Top 10 for Agentic Applications 2026 (Published 9 Dec 2025)  
> **Taxonomy Reference**: MITRE Adversarial Threat Landscape for Artificial-Intelligence Systems (ATLAS)  
> **Configuration File**: `backend/app/detection/taxonomy.json`  

---

## 1. Threat Landscape Overview

Autonomous AI agents possess agency: the authority to interpret unbounded natural language inputs, formulate execution plans, select tools, generate code, invoke APIs, and persist changes to underlying infrastructure. This introduces attack vectors absent in traditional request-response web services.

Attacks against agentic systems fall into three primary surfaces:
1. **Input Manipulation**: Direct prompt injections, DAN jailbreaks, instruction overrides, and roleplay persuasion attacks.
2. **Indirect / Retrieval Poisoning**: Malicious payloads embedded in external web scrapes, PDF documents, database rows, or tool outputs consumed into the agent's context window.
3. **Tool Execution & Lateral Movement**: Abusing permitted agent tools (bash executors, SQL clients, email clients, file APIs) to harvest credentials, escalate privileges, exfiltrate confidential data, or spawn rogue child tasks.

---

## 2. OWASP Top 10 for Agentic Applications 2026 Mapping

AgentShield maps every detection rule and alert directly to the **OWASP Top 10 for Agentic Applications 2026**:

| Category ID | Vulnerability Name | AgentShield Threat Signature | Primary Mitigation Layer |
|---|---|---|---|
| **ASI01** | **Agent Goal Hijack** | Direct & indirect prompt injections overriding system instructions (`DAN_override`, instruction jailbreaks) | Input Normalization + AST DSL Rule + Isolation Forest |
| **ASI02** | **Tool Misuse & Exploitation** | Excessive parameters, unexpected high-volume outbound data exfiltration via HTTP tool | Bounded Parameter Sanitization + Outbound Egress Rule |
| **ASI03** | **Identity & Privilege Abuse** | Querying `/etc/shadow`, AWS metadata service (`169.254.169.254`), or database admin tables | System File Access Rule + SSRF Defense Filter |
| **ASI04** | **Agentic Supply Chain Vulnerabilities** | Dynamic installation of unverified runtime packages (`pip install`, `npm i`) during execution | Dangerous Shell Command Rule (`RULE-EXEC-002`) |
| **ASI05** | **Unexpected Code Execution (RCE)** | Execution of arbitrary bash commands, reverse shells (`/bin/sh -i >& /dev/tcp`), dynamic `eval()` | Pre-Flight Enforce Mode (`/evaluate`) + AST DSL Rule |
| **ASI06** | **Memory & Context Poisoning** | Malicious persistent memories instructed to disregard future authorization checks | Context Window Scanning + Context Injection Rule |
| **ASI07** | **Insecure Inter-Agent Communication** | Spoofed directives between multi-agent crew workers bypassing approval gates | Inter-Agent Directives Rule (`RULE-INTER-001`) |
| **ASI08** | **Cascading Failures** | Rapid burst loop flooding APIs, runaway recursion, or resource exhaustion | Sliding Window Frequency Aggregator + Rate Limit Rule |
| **ASI09** | **Human-Agent Trust Exploitation** | Generating unauthorized email approvals or invoice payment manipulations | Pre-Flight Enforce Review (`decision="REVIEW"`) |
| **ASI10** | **Rogue Agents** | Unregistered or compromised agents attempting unauthorized actions after containment | Agent Quarantine & Emergency Halt Enforcement |

---

## 3. MITRE ATLAS Matrix Integration

The MITRE ATLAS taxonomy provides standardized tactical categorizations. Technique definitions are decoupled in `backend/app/detection/taxonomy.json`:

```json
{
  "AML.T0051": {
    "name": "Prompt Injection",
    "subtypes": ["direct", "indirect"],
    "description": "Adversary alters model instructions via user prompt or retrieved tool context."
  },
  "AML.T0053": {
    "name": "AI Agent Tool Invocation",
    "description": "Adversary induces agent to invoke a legitimate tool for malicious objectives."
  },
  "AML.T0086": {
    "name": "Exfiltration via AI Agent Tool Invocation",
    "description": "Adversary abuses agent networking or messaging tools to egress sensitive data."
  },
  "AML.T0101": {
    "name": "Data Destruction via AI Agent Tool Invocation",
    "description": "Adversary invokes tools to delete, corrupt, or drop tables and file systems."
  },
  "AML.T0080": {
    "name": "AI Agent Context Poisoning",
    "description": "Adversary inserts malicious context into working memory or vector database."
  },
  "AML.T0098": {
    "name": "AI Agent Tool Credential Harvesting",
    "description": "Adversary abuses tools to extract passwords, API keys, or cloud metadata credentials."
  },
  "AML.T0010.005": {
    "name": "AI Supply Chain Compromise: AI Agent Tool",
    "description": "Compromise of third-party tools, plugins, or libraries integrated into the agent."
  },
  "AML.T0104": {
    "name": "Publish Poisoned AI Agent Tool",
    "description": "Adversary distributes malicious agent tools into public registries or repositories."
  },
  "AML.T0110": {
    "name": "AI Agent Tool Poisoning",
    "description": "Tampering with tool definitions, return schemas, or runtime behaviors."
  }
}
```

---

## 4. Multi-Layered Defense-in-Depth

Relying solely on keyword regex or pattern matching fails against evasive adversaries. AgentShield deploys a 4-tier layered pipeline:

```
[ Incoming Action Payload ]
             │
             ▼
┌──────────────────────────────────────────────┐
│ Layer 1: Normalization & Deobfuscation       │
│  - Unicode NFKC canonical normalization      │
│  - Strip zero-width & invisible characters   │
│  - Translate Cyrillic/Greek homoglyphs       │
│  - Recursive decoding (URL, Hex, Base64 <=3) │
│  - 64KB length bounding & whitespace collapse│
└──────────────────────────────────────────────┘
             │
             ▼
┌──────────────────────────────────────────────┐
│ Layer 2: Safe AST JSON-DSL Rules Engine      │
│  - Boolean expression trees (and, or, not)   │
│  - String containment, startswith, endswith  │
│  - Shannon entropy thresholding (secrets)    │
│  - ReDoS-safe pre-compiled regular expressions│
│  - Evaluates OWASP ASI01-ASI10 signatures    │
└──────────────────────────────────────────────┘
             │
             ▼
┌──────────────────────────────────────────────┐
│ Layer 3: Calibrated Isolation Forest (ML)    │
│  - 9-dimensional behavioral feature vector   │
│  - Hierarchical resolution (Agent->Org->Base)│
│  - Quantile-calibrated probability in [0, 1] │
│  - Flags out-of-distribution novel behaviors │
└──────────────────────────────────────────────┘
             │
             ▼
┌──────────────────────────────────────────────┐
│ Layer 4: Recency-Weighted Composite Scoring  │
│  - Risk = 0.4*Rule + 0.6*Anomaly*100         │
│  - Critical rule guardrail floor at 90.0     │
│  - Rolling decay over last 20 actions        │
│  - Enforce decision: ALLOW, REVIEW, or DENY  │
└──────────────────────────────────────────────┘
```

---

## 5. Adversarial Evasion Analysis & Countermeasures

| Evasion Technique | Attacker Strategy | AgentShield Countermeasure |
|---|---|---|
| **Zero-Width Character Insertion** | Inserting `\u200B` between keywords: `s\u200Bu\u200Bd\u200Bo` | Pre-flight zero-width character stripping collapses string to `sudo` before rule evaluation |
| **Homoglyph Substitution** | Replacing Latin letters with Cyrillic lookalikes: `аdmіn` (Cyrillic `а`, Ukrainian `і`) | Confusable homoglyph translation normalizes characters to ASCII Latin equivalents |
| **Recursive Encoding** | Double URL-encoding or Base64 encoding payloads: `JTI1MmY=` | Bounded recursive decoding (depth $\le 3$) unpacks nested encodings |
| **Token Splitting / Chunking** | Distributing malicious command across multiple prompt chunks | Session-scoped context tracking with rolling frequency and entropy monitoring |
| **High-Entropy Secret Exfiltration** | Exfiltrating base64-encoded encrypted database dumps | Shannon entropy operator (`has_entropy_above: 4.8`) flags encrypted/compressed payloads |
| **Server-Side Request Forgery (SSRF)** | Pointing webhook or HTTP tool to `http://169.254.169.254` | Outbox worker SSRF defense rejects loopback, RFC 1918, link-local, and cloud metadata addresses |

---

## 6. Incident Response & Containment SLA

When an attack is detected in production:
1. **Pre-Flight Evaluation (Enforce Mode)**: Blocks the dangerous action inline ($<50\text{ms}$ latency), returning `decision: "DENY"` with explicit violation reasons.
2. **Alert Triggering & Deduplication**: Increments sliding-window count and triggers external notification within $0\text{--}2$ seconds via the transactional outbox worker.
3. **Analyst One-Click Quarantine**: The Mission Control dashboard allows analysts to place the compromised agent into `quarantined` (read-only) or `halted` (all actions blocked) state.
4. **Cryptographic Tamper-Evident Audit Record**: The containment event is chained with SHA-256 into the immutable audit ledger.
