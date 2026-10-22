from setuptools import setup, find_packages

setup(
    name="agentshield",
    version="1.0.0",
    description="AgentShield AI — Real-time Security Monitoring & Guardrail SDK for Autonomous AI Agents",
    author="AgentShield AI Team",
    packages=find_packages(),
    install_requires=[
        "requests>=2.28.0",
    ],
    extras_require={
        "langchain": ["langchain-core>=0.1.0"],
    },
    python_requires=">=3.8",
)
