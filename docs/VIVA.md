# AgentShield AI — Academic Defense & Viva Voce Guide

> **Project Title**: AgentShield AI — Behaviour-Based Runtime Security Monitoring & Guardrail Enforcement for Autonomous AI Agents  
> **Candidate**: Aditya (B.Tech Computer Science & Engineering, IMS Engineering College, AKTU, Class of 2027)  
> **Target Evaluation**: Final-Year Major Project Defense, Technical Review Committee & External Viva Examination  

---

## 1. Project Abstract & Motivation

### The Problem
Autonomous AI agents built on frameworks like LangChain, CrewAI, and the OpenAI Agents SDK are rapidly transitioning from conversational chat toys to operational execution engines. These agents possess autonomous agency: they make recursive tool calls, manipulate databases, execute shell commands, read and write files, and interface with external third-party APIs.

However, Large Language Models are inherently probabilistic and vulnerable to:
- **Prompt Injection & Goal Hijacking (OWASP ASI01 / MITRE AML.T0051)**: Malicious user inputs or retrieved documents that override the agent's core instructions.
- **Unauthorized Tool & Privilege Abuse (OWASP ASI03 / MITRE AML.T0098)**: Tricking agents into accessing private credentials (`/etc/shadow`, AWS IAM metadata).
- **Remote Code Execution (OWASP ASI05 / MITRE AML.T0053)**: Inducing agents to run arbitrary bash commands or reverse shells.
- **Data Exfiltration (OWASP ASI02 / MITRE AML.T0086)**: Egressing sensitive database rows via HTTP requests or unverified webhook endpoints.

### The Solution: AgentShield AI
AgentShield provides a **runtime security boundary and behavioural guardrail** positioned between the autonomous agent and the execution environment. It operates in two complementary modes:
1. **Observe Mode**: Non-blocking asynchronous telemetry ingest with client-side batching and sub-millisecond host overhead.
2. **Enforce Mode**: Synchronous pre-flight policy evaluation (`/evaluate`) that intercepts intended actions and blocks attacks before execution with a strict latency budget ($p95 < 50\text{ms}$).

---

## 2. Mathematical Formulations & Algorithms

### 2.1 Quantile-Calibrated Isolation Forest Anomaly Scoring
Standard scikit-learn `IsolationForest.score_samples(x)` outputs raw path length differences that typically range from $-0.8$ to $-0.2$. Raw scores cannot be directly combined with risk thresholds because they lack a fixed probabilistic scale.

AgentShield solves this through **empirical quantile calibration**. During baseline model training on normal traffic $X_{\text{normal}}$, the engine records the empirical median ($p_{50}$) and the 99th percentile ($p_{99}$) of the anomaly distribution:
$$s_{\text{raw}} = \text{score\_samples}(x)$$
$$\text{Anomaly Score} = \min\left(1.0, \max\left(0.0, \frac{p_{50} - s_{\text{raw}}}{2 \cdot |p_{99} - p_{50}| + 10^{-6}}\right)\right)$$

- Benign actions near the median receive an anomaly score $\approx 0.0\text{--}0.2$.
- Statistical outliers exceeding the 99th percentile scale smoothly toward $1.0$.

---

### 2.2 Explainable Composite Risk Scoring
The final action risk score $R \in [0, 100]$ fuses deterministic rule matching with probabilistic machine learning anomaly detection:
$$R = 0.4 \times S_{\text{rule}} + 0.6 \times (\text{AnomalyScore} \times 100)$$

- **Guardrail Floor Guarantee**: If any critical detection rule is violated (or pre-flight evaluation blocks an action), $R$ is floored at $90.0$:
  $$R_{\text{final}} = \begin{cases} \max(R, 90.0) & \text{if critical rule matched or decision is DENY} \\ R & \text{otherwise} \end{cases}$$

---

### 2.3 Rolling Recency-Weighted Agent Risk Window
An agent's current threat level is not based on a single action in isolation, but on a decaying recency-weighted window over its last $k=20$ actions:
$$\bar{R}_t = \frac{\sum_{i=0}^{k-1} w_i R_{t-i}}{\sum_{i=0}^{k-1} w_i}, \quad \text{where } w_i = e^{-0.1 \cdot i}$$
This exponential decay ensures recent anomalies exert greater influence while historical benign activity gradually discounts transient noise.

---

### 2.4 Tamper-Evident Cryptographic Hash Chaining
Audit log entries are cryptographically linked into an immutable hash chain:
$$h_0 = \text{"0"}^{64} \quad (\text{Genesis Hash})$$
$$h_n = \text{SHA256}\Big(h_{n-1} \parallel t_n \parallel \text{org\_id}_n \parallel \text{actor\_id}_n \parallel \text{action}_n \parallel \text{target\_id}_n \parallel \text{canonical\_json}(\text{details}_n)\Big)$$

If an attacker modifies a historic record in the database, the parent hash $h_{n-1}$ in subsequent records immediately fails verification during sequential chain traversal (`GET /api/v1/audit-log/verify`).

---

## 3. High-Yield Examiner Questions & Model Answers

### Q1: Why not just use an LLM-based guardrail like Llama Guard or NeMo Guardrails?
**Model Answer:**
> "LLM-based guardrails suffer from three fatal limitations in production agent environments:
> 1. **Extreme Latency**: Running an LLM evaluation adds $300\text{ms}\text{--}1500\text{ms}$ of latency per tool call. In contrast, AgentShield's pre-flight evaluation runs in $<5\text{ms}$ locally ($p95 < 50\text{ms}$ over the network), allowing inline enforcement without slowing agent execution.
> 2. **Financial Cost**: Invoking guardrail LLMs for every agent tool call doubles token consumption and API costs.
> 3. **Vulnerability to Jailbreaks**: LLM guardrails are themselves LLMs susceptible to semantic confusion and adversarial prompt injection. AgentShield uses deterministic AST normalization, regex-safe JSON-DSL rules, and statistical Isolation Forests that cannot be jailbroken by linguistic persuasion."

---

### Q2: Why choose Isolation Forest over Deep Learning Autoencoders or One-Class SVM?
**Model Answer:**
> "Isolation Forest possesses specific algorithmic advantages for high-throughput security telemetry:
> 1. **Time Complexity**: Training complexity is $O(n \cdot t \cdot \psi)$ where $\psi=256$ is subsample size, and inference is $O(t \cdot \log \psi)$, requiring $<1\text{ms}$ CPU time per prediction without GPU acceleration.
> 2. **Resistance to Masking/Swamping**: By isolating anomalies near tree roots rather than calculating density distances, Isolation Forest is immune to high-dimensional distance concentration effects that degrade k-NN and One-Class SVMs.
> 3. **Footprint**: The model serializes to a few kilobytes, enabling hierarchical per-agent and per-organization models stored compactly in PostgreSQL."

---

### Q3: How do you achieve high throughput and reliability without Redis or Celery?
**Model Answer:**
> "AgentShield deliberately adheres to a lean, single-database architecture using PostgreSQL:
> 1. **Transactional Outbox Pattern**: Webhooks are staged in the database in the exact same transaction as the alert record (`webhook_deliveries`). This guarantees zero lost alerts even if the server crashes mid-flight.
> 2. **Async Background Worker**: FastAPI's native async lifespan drives an in-process outbox worker that polls pending deliveries and handles exponential retries without requiring external message brokers like Redis, Kafka, or RabbitMQ.
> 3. **Non-Blocking Ingest**: In Observe Mode, the client SDK buffers events in memory and flushes in batches, decoupling agent performance from server write throughput."

---

### Q4: How does AgentShield prevent Server-Side Request Forgery (SSRF) when firing webhooks?
**Model Answer:**
> "AgentShield implements defense-in-depth against SSRF at the outbox worker layer:
> 1. Destination URLs must strictly use `http` or `https` schemes.
> 2. Prior to dispatch, the worker resolves the destination hostname via DNS socket inspection (`socket.getaddrinfo`).
> 3. Any target resolving to loopback (`127.0.0.0/8`, `::1`), private RFC 1918 ranges (`10.0.0.0/8`, `172.16.0.0/12`, `192.168.0.0/16`), link-local (`169.254.0.0/16`), multicast, or cloud instance metadata services (`169.254.169.254`) is rejected immediately and aborted."

---

### Q5: What is the fail-safe behavior if AgentShield goes offline?
**Model Answer:**
> "The SDK provides explicit, configurable fail-safe semantics via the `fail_open` parameter:
> - **`fail_open=True` (Default / Resilient)**: If network connectivity to AgentShield times out or returns a 5xx error, the agent logs a warning and proceeds with execution. Recommended for non-critical developer environments.
> - **`fail_open=False` (High-Security / Zero-Trust)**: If AgentShield cannot be reached or rejects the action, a `ShieldSecurityViolationException` is raised immediately, halting execution. Recommended for autonomous financial transactions, production infrastructure provisioning, and healthcare systems."

---

## 4. Live Viva Demonstration Flow (Under 7 Minutes)

When presenting to examiners:
1. **Show Quickstart & Single Gateway** (1 min):
   - Open browser at `http://localhost:8080`, log in to Mission Control with `admin@agentshield.ai`.
   - Point out dark-mode UI, live WebSocket status indicator, active agents, and risk metrics.
2. **Execute Real Offline LangChain Agent** (2 mins):
   - In terminal, execute: `python examples/langchain_agent_demo.py`.
   - Show legitimate financial calculations passing through cleanly.
   - Show adversarial injection attempt being caught and blocked synchronously inline.
3. **Execute Attack Scenarios Suite** (2 mins):
   - In terminal, execute: `python examples/attack_scenarios.py`.
   - Show 5/5 targeted attacks blocked across OWASP ASI01 through ASI05.
   - Switch to browser: refresh `/alerts` to display real-time generated alerts with OWASP tags.
4. **Demonstrate Audit Hash Chain Integrity** (1 min):
   - Navigate to `/audit` on the dashboard.
   - Click "Verify Integrity" badge: show 100% verified status and unbroken Merkle-style hash chaining.
5. **Demonstrate Interactive Test Sandbox** (1 min):
   - Navigate to `/rules`, open "Test Simulator", input `/etc/shadow` query, click "Evaluate Action", and show instant $<1\text{ms}$ detection rule match.
