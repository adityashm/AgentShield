"""
backend/app/api/v1/memory.py — Agent Memory Shield & Context Poisoning Defense API.
Provides endpoints for pre-insertion / pre-retrieval RAG inspection, vector store health audits,
and tamper history logging.
"""

from typing import Dict, Any, List, Optional
from fastapi import APIRouter, Depends, Query, Request, status
from pydantic import BaseModel, Field

from ...detection.memory_shield import MemoryShield
from ...core.errors import ProblemException

router = APIRouter(prefix="/memory", tags=["Agent Memory Shield"])


class MemoryInspectRequest(BaseModel):
    content: str = Field(..., description="Raw text of the document, chunk, or scratchpad to inspect")
    memory_id: Optional[str] = Field(default=None, description="Optional document or memory item ID")
    agent_id: str = Field(default="AGT-001", description="Target agent associated with this memory")
    context_type: str = Field(default="rag_document", description="Type of context: rag_document, agent_scratchpad, conversation_history")
    metadata: Optional[Dict[str, Any]] = Field(default=None, description="Arbitrary metadata dictionary")


@router.post("/inspect")
async def inspect_memory(
    payload: MemoryInspectRequest,
    request: Request,
):
    """
    Scans a memory chunk or RAG document for indirect prompt injections, sleeper triggers,
    and credential exposure.
    """
    if not payload.content.strip():
        raise ProblemException(
            status_code=status.HTTP_400_BAD_REQUEST,
            title="Bad Request",
            detail="Content cannot be empty for memory inspection.",
        )

    org_id = getattr(request.state, "org_id", "org_default")
    result = await MemoryShield.inspect_and_broadcast(
        content=payload.content,
        memory_id=payload.memory_id,
        agent_id=payload.agent_id,
        context_type=payload.context_type,
        metadata=payload.metadata,
        org_id=org_id,
    )
    return result


@router.get("/health")
def get_memory_health(request: Request):
    """
    Returns aggregated health status, integrity scores, and poisoning attempt metrics
    for all connected vector stores and memory buffers.
    """
    org_id = getattr(request.state, "org_id", "org_default")
    return MemoryShield.get_memory_health(org_id=org_id)


@router.get("/history")
def get_inspection_history(
    request: Request,
    limit: int = Query(default=50, ge=1, le=200, description="Maximum number of historical inspection records to return"),
):
    """
    Retrieves the chronological log of recent memory and document inspections.
    """
    org_id = getattr(request.state, "org_id", "org_default")
    return MemoryShield.get_inspection_history(limit=limit, org_id=org_id)

