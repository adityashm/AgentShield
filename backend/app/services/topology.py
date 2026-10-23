"""
backend/app/services/topology.py — Multi-Agent Communication Topology & Lateral Movement Defense.
Maintains directed multi-agent mesh graphs, calculates blast radius for compromised agents,
and enforces real-time network containment by severing inter-agent communication channels.
"""

import logging
import uuid
from collections import defaultdict
from typing import Dict, Any, List, Optional, Set
from datetime import datetime, timezone
from sqlalchemy.orm import Session

from ..db.models.agent import Agent
from ..services.audit import AuditService
from ..services.websocket_manager import ws_manager

logger = logging.getLogger("agentshield.services.topology")

# ---------------------------------------------------------------------------
# Default Multi-Agent Mesh Topology (Seed definitions)
# ---------------------------------------------------------------------------

DEFAULT_TOPOLOGY_NODES: List[Dict[str, Any]] = [
    {
        "id": "AGT-COORD-01",
        "name": "Supervisor Coordinator",
        "role": "Orchestrator",
        "framework": "LangGraph",
        "cluster": "orchestration",
        "status": "active",
        "risk_score": 14.5,
        "tools": ["task_planner", "agent_delegator", "response_aggregator"],
    },
    {
        "id": "AGT-RESEARCH-02",
        "name": "Context & Web Researcher",
        "role": "Worker",
        "framework": "CrewAI",
        "cluster": "data",
        "status": "active",
        "risk_score": 22.0,
        "tools": ["web_search", "document_scraper", "vector_query"],
    },
    {
        "id": "AGT-CODE-03",
        "name": "Code Generation & Interpreter",
        "role": "Worker",
        "framework": "OpenAI Agents SDK",
        "cluster": "execution",
        "status": "active",
        "risk_score": 38.0,
        "tools": ["python_interpreter", "ast_parser", "test_runner"],
    },
    {
        "id": "AGT-DB-04",
        "name": "Enterprise SQL Executor",
        "role": "Worker",
        "framework": "Custom ReAct",
        "cluster": "data",
        "status": "active",
        "risk_score": 65.0,
        "tools": ["postgres_readonly", "sql_query_builder"],
    },
    {
        "id": "AGT-DEPLOY-05",
        "name": "Cloud Deployment Tool",
        "role": "Tool Worker",
        "framework": "LangChain",
        "cluster": "execution",
        "status": "active",
        "risk_score": 28.0,
        "tools": ["kubectl_apply", "terraform_plan", "aws_secrets"],
    },
    {
        "id": "AGT-REVIEW-06",
        "name": "Safety & Compliance Reviewer",
        "role": "Critic",
        "framework": "LangGraph",
        "cluster": "governance",
        "status": "active",
        "risk_score": 5.0,
        "tools": ["policy_checker", "memory_shield_verifier"],
    },
]

DEFAULT_TOPOLOGY_EDGES: List[Dict[str, Any]] = [
    {
        "id": "edge_coord_research",
        "source": "AGT-COORD-01",
        "target": "AGT-RESEARCH-02",
        "protocol": "direct",
        "status": "active",
        "latency_ms": 14.2,
        "messages_routed": 1842,
        "threat_level": "nominal",
    },
    {
        "id": "edge_coord_code",
        "source": "AGT-COORD-01",
        "target": "AGT-CODE-03",
        "protocol": "rpc",
        "status": "active",
        "latency_ms": 18.6,
        "messages_routed": 2410,
        "threat_level": "nominal",
    },
    {
        "id": "edge_code_db",
        "source": "AGT-CODE-03",
        "target": "AGT-DB-04",
        "protocol": "queue",
        "status": "active",
        "latency_ms": 25.1,
        "messages_routed": 930,
        "threat_level": "elevated",
    },
    {
        "id": "edge_code_deploy",
        "source": "AGT-CODE-03",
        "target": "AGT-DEPLOY-05",
        "protocol": "rpc",
        "status": "active",
        "latency_ms": 32.4,
        "messages_routed": 412,
        "threat_level": "nominal",
    },
    {
        "id": "edge_research_coord",
        "source": "AGT-RESEARCH-02",
        "target": "AGT-COORD-01",
        "protocol": "direct",
        "status": "active",
        "latency_ms": 12.8,
        "messages_routed": 1820,
        "threat_level": "nominal",
    },
    {
        "id": "edge_deploy_review",
        "source": "AGT-DEPLOY-05",
        "target": "AGT-REVIEW-06",
        "protocol": "direct",
        "status": "active",
        "latency_ms": 9.4,
        "messages_routed": 412,
        "threat_level": "nominal",
    },
    {
        "id": "edge_review_coord",
        "source": "AGT-REVIEW-06",
        "target": "AGT-COORD-01",
        "protocol": "direct",
        "status": "active",
        "latency_ms": 8.1,
        "messages_routed": 410,
        "threat_level": "nominal",
    },
]

# Per-organization edge state cache: org_id -> (edge_id -> edge_dict)
_EDGES_BY_ORG: Dict[str, Dict[str, Dict[str, Any]]] = defaultdict(dict)
# Per-organization set of manually contained agent IDs: org_id -> set of agent_ids
_CONTAINED_BY_ORG: Dict[str, Set[str]] = defaultdict(set)


class TopologyService:
    """Manages multi-agent topology graphs, lateral movement defense, and channel containment."""

    @classmethod
    def _get_org_edges(cls, org_id: str) -> Dict[str, Dict[str, Any]]:
        if org_id not in _EDGES_BY_ORG or not _EDGES_BY_ORG[org_id]:
            _EDGES_BY_ORG[org_id] = {e["id"]: dict(e) for e in DEFAULT_TOPOLOGY_EDGES}
        return _EDGES_BY_ORG[org_id]

    @classmethod
    def _get_org_contained(cls, org_id: str) -> Set[str]:
        return _CONTAINED_BY_ORG[org_id]

    @classmethod
    def is_agent_contained(cls, agent_id: str, org_id: str = "org_default") -> bool:
        return agent_id in _CONTAINED_BY_ORG[org_id]

    @classmethod
    def get_graph(cls, db: Session, org_id: str = "org_default") -> Dict[str, Any]:
        """
        Builds the live multi-agent communication graph, synchronizing with database agents.
        """
        # Query agents from DB
        db_agents = db.query(Agent).filter(Agent.org_id == org_id).all() if db else []
        db_map = {a.id: a for a in db_agents}
        # Also map by external_id
        for a in db_agents:
            if a.external_id:
                db_map[a.external_id] = a

        # Assemble nodes: default nodes merged with DB agents
        nodes: List[Dict[str, Any]] = []
        node_ids_seen = set()
        contained_set = cls._get_org_contained(org_id)

        for base_node in DEFAULT_TOPOLOGY_NODES:
            nid = base_node["id"]
            node_ids_seen.add(nid)
            node_copy = dict(base_node)
            
            # Check DB overrides
            if nid in db_map:
                agent = db_map[nid]
                node_copy["status"] = agent.status
                node_copy["risk_score"] = float(agent.risk_score)
                node_copy["name"] = agent.name or node_copy["name"]
                if agent.framework:
                    node_copy["framework"] = agent.framework

            # Check containment override
            if nid in contained_set:
                node_copy["status"] = "quarantined"

            nodes.append(node_copy)

        # Append any additional agents in the DB not in default seed
        for a in db_agents:
            if a.id not in node_ids_seen and a.external_id not in node_ids_seen:
                node_ids_seen.add(a.id)
                nodes.append({
                    "id": a.id,
                    "name": a.name or f"Agent {a.id[:8]}",
                    "role": "Specialized Worker",
                    "framework": a.framework or "Custom",
                    "cluster": "execution",
                    "status": "quarantined" if a.id in contained_set else a.status,
                    "risk_score": float(a.risk_score),
                    "tools": ["generic_tool"],
                })

        total_nodes = len(nodes)
        # Calculate blast radius score for each node
        for node in nodes:
            br = cls.calculate_blast_radius(node["id"], db=db, org_id=org_id, total_nodes=total_nodes)
            node["blast_radius_score"] = br["blast_radius_score"]
            node["downstream_count"] = br["reachable_agents_count"]

        # Assemble edges from per-org cache
        edge_dict = cls._get_org_edges(org_id)
        edges = list(edge_dict.values())
        
        # Ensure any edges connected to a quarantined/contained node are marked severed
        for edge in edges:
            src = edge["source"]
            tgt = edge["target"]
            src_node = next((n for n in nodes if n["id"] == src), None)
            tgt_node = next((n for n in nodes if n["id"] == tgt), None)
            if (src_node and src_node["status"] in ("quarantined", "halted")) or \
               (tgt_node and tgt_node["status"] in ("quarantined", "halted")):
                edge["status"] = "severed"

        total_nodes = len(nodes)
        active_nodes = sum(1 for n in nodes if n["status"] == "active")
        contained_nodes = total_nodes - active_nodes

        total_edges = len(edges)
        active_edges = sum(1 for e in edges if e["status"] == "active")
        severed_edges = total_edges - active_edges

        avg_risk = round(sum(n["risk_score"] for n in nodes) / total_nodes if total_nodes else 0.0, 1)

        if contained_nodes > 0:
            mesh_resilience = "CONTAINMENT_ACTIVE"
        elif avg_risk > 50.0:
            mesh_resilience = "ELEVATED_RISK"
        else:
            mesh_resilience = "OPTIMAL_RESILIENT"

        return {
            "nodes": nodes,
            "edges": edges,
            "stats": {
                "total_nodes": total_nodes,
                "active_nodes": active_nodes,
                "contained_nodes": contained_nodes,
                "total_edges": total_edges,
                "active_edges": active_edges,
                "severed_edges": severed_edges,
                "average_risk_score": avg_risk,
                "mesh_resilience_grade": mesh_resilience,
                "last_topology_sync": datetime.now(timezone.utc).isoformat(),
            },
        }

    @classmethod
    def calculate_blast_radius(
        cls,
        agent_id: str,
        db: Session,
        org_id: str = "org_default",
        total_nodes: Optional[int] = None,
    ) -> Dict[str, Any]:
        """
        Computes BFS reachability from the specified agent to determine blast radius exposure.
        """
        # Collect edges from per-org cache
        edge_dict = cls._get_org_edges(org_id)
        active_edges = [e for e in edge_dict.values() if e["status"] == "active"]
        
        visited: Set[str] = set()
        queue = [agent_id]
        visited.add(agent_id)

        while queue:
            curr = queue.pop(0)
            for edge in active_edges:
                if edge["source"] == curr and edge["target"] not in visited:
                    visited.add(edge["target"])
                    queue.append(edge["target"])

        reachable = visited - {agent_id}
        node_count = total_nodes if total_nodes is not None else len(DEFAULT_TOPOLOGY_NODES)
        exposure_pct = round((len(reachable) / max(1, node_count - 1)) * 100.0, 1)
        
        # Risk score calculation based on downstream agent count and criticality
        blast_radius_score = min(100.0, round(exposure_pct * 0.85 + (len(reachable) * 4.0), 1))

        return {
            "agent_id": agent_id,
            "blast_radius_score": blast_radius_score,
            "reachable_agents_count": len(reachable),
            "reachable_agents": list(reachable),
            "critical_channels_at_risk": len([e for e in active_edges if e["source"] == agent_id]),
            "containment_recommended": blast_radius_score > 40.0,
        }

    @classmethod
    async def contain_agent(
        cls,
        agent_id: str,
        reason: str,
        db: Session,
        org_id: str = "org_default",
        actor: str = "system",
    ) -> Dict[str, Any]:
        """
        Isolates an agent from the multi-agent mesh:
        1. Updates or creates agent database record with status 'quarantined', scoped to org_id.
        2. Severs all incoming and outgoing communication channels for that org.
        3. Records an immutable cryptographic audit log.
        4. Broadcasts real-time WebSocket alert.
        """
        cls._get_org_contained(org_id).add(agent_id)

        # Update or upsert DB agent scoped strictly by org_id
        if db:
            agent = db.query(Agent).filter(
                Agent.org_id == org_id,
                (Agent.id == agent_id) | (Agent.external_id == agent_id),
            ).first()
            if agent:
                agent.status = "quarantined"
                db.commit()
            else:
                agent = Agent(
                    id=agent_id,
                    external_id=agent_id,
                    name=agent_id,
                    org_id=org_id,
                    status="quarantined",
                )
                db.add(agent)
                db.commit()

        # Sever connected edges in per-org cache
        edge_dict = cls._get_org_edges(org_id)
        severed_count = 0
        for edge_id, edge in edge_dict.items():
            if edge["source"] == agent_id or edge["target"] == agent_id:
                edge["status"] = "severed"
                severed_count += 1

        # Audit log
        try:
            if db:
                AuditService.log_event(
                    db=db,
                    org_id=org_id,
                    action="agent.containment_enforced",
                    target_type="agent",
                    target_id=agent_id,
                    actor_type="user" if actor != "system" else "system",
                    actor_id=actor,
                    details={
                        "reason": reason,
                        "severed_channels": severed_count,
                        "containment_mode": "lateral_movement_block",
                    },
                )
        except Exception as e:
            logger.warning(f"Could not record audit log for containment: {e}")

        # WebSocket broadcast
        await ws_manager.broadcast({
            "type": "topology_agent_contained",
            "agent_id": agent_id,
            "reason": reason,
            "severed_channels": severed_count,
            "timestamp": datetime.now(timezone.utc).isoformat(),
        })

        return {
            "status": "contained",
            "agent_id": agent_id,
            "severed_channels": severed_count,
            "message": f"Agent {agent_id} quarantined and isolated from communication mesh.",
            "reason": reason,
        }

    @classmethod
    async def restore_agent(
        cls,
        agent_id: str,
        db: Session,
        org_id: str = "org_default",
        actor: str = "system",
    ) -> Dict[str, Any]:
        """
        Restores a contained agent back to active status in the multi-agent mesh.
        """
        contained_set = cls._get_org_contained(org_id)
        if agent_id in contained_set:
            contained_set.remove(agent_id)

        # Update DB if agent exists, scoped strictly by org_id
        if db:
            agent = db.query(Agent).filter(
                Agent.org_id == org_id,
                (Agent.id == agent_id) | (Agent.external_id == agent_id),
            ).first()
            if agent:
                agent.status = "active"
                db.commit()

        # Restore connected edges (unless the connected peer is also quarantined)
        edge_dict = cls._get_org_edges(org_id)
        restored_count = 0
        for edge_id, edge in edge_dict.items():
            if edge["source"] == agent_id or edge["target"] == agent_id:
                peer = edge["target"] if edge["source"] == agent_id else edge["source"]
                if peer not in contained_set:
                    edge["status"] = "active"
                    restored_count += 1

        # Audit log
        try:
            if db:
                AuditService.log_event(
                    db=db,
                    org_id=org_id,
                    action="agent.containment_released",
                    target_type="agent",
                    target_id=agent_id,
                    actor_type="user" if actor != "system" else "system",
                    actor_id=actor,
                    details={"restored_channels": restored_count},
                )
        except Exception as e:
            logger.warning(f"Could not record audit log for restoration: {e}")

        # WebSocket broadcast
        await ws_manager.broadcast({
            "type": "topology_agent_restored",
            "agent_id": agent_id,
            "restored_channels": restored_count,
            "timestamp": datetime.now(timezone.utc).isoformat(),
        })

        return {
            "status": "active",
            "agent_id": agent_id,
            "restored_channels": restored_count,
            "message": f"Agent {agent_id} communication channels restored.",
        }
