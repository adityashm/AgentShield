# AgentShield AI — Python SDK

Runtime behaviour monitoring, pre-flight evaluation guardrails, and threat detection for autonomous AI agents (LangChain, CrewAI, OpenAI Agents SDK, and custom Python agents).

## Installation

```bash
pip install agentshield
# With LangChain support
pip install "agentshield[langchain]"
```

## Quickstart

### 1. Observe Mode (Non-blocking background telemetry)

```python
from agentshield import AgentShield

shield = AgentShield(
    api_key="ashield_live_...",
    endpoint="http://localhost:8000/api/v1",
    mode="observe",
)

# Decorate tool functions
@shield.monitor(action_type="calculate_metric")
def calculate(a: int, b: int):
    return a + b

# Or log actions directly
shield.log_action(
    agent_id="finance_agent",
    action_type="query_balance",
    parameters={"account_id": "ACC-998"},
)
```

### 2. Enforce Mode (Synchronous pre-flight policy evaluation)

```python
from agentshield import AgentShield, ShieldSecurityException

shield = AgentShield(
    api_key="ashield_live_...",
    endpoint="http://localhost:8000/api/v1",
    mode="enforce",
    fail_open=False, # Block on policy violations or evaluator failures
)

@shield.monitor(action_type="filesystem_read")
def read_file(path: str):
    with open(path, "r") as f:
        return f.read()

try:
    # If a malicious path like /etc/shadow or prompt injection is detected,
    # ShieldSecurityException is raised before the function executes!
    read_file("/etc/shadow")
except ShieldSecurityException as exc:
    print(f"Action blocked by policy: {exc.violated_rules}")
```

### 3. LangChain Integration

```python
from agentshield.integrations.langchain import AgentShieldCallbackHandler

handler = AgentShieldCallbackHandler(
    agent_id="support_bot",
    enforce=True, # Pre-execution guardrails on all tools
)

# Attach to LangChain agent or runnables
agent_executor.invoke({"input": user_prompt}, config={"callbacks": [handler]})
```
