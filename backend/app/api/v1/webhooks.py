from typing import List, Optional, Dict, Any
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy.orm import Session

from ...database import get_db
from ...db.models import WebhookEndpoint, WebhookDelivery
from ...services.webhook_dispatcher import webhook_dispatcher
from ...core.errors import NotFoundError, ProblemException

router = APIRouter(prefix="/webhooks", tags=["Webhooks"])

class WebhookCreate(BaseModel):
    name: str
    url: str
    target_type: Optional[str] = "generic"
    type: Optional[str] = None
    min_severity: Optional[str] = "High"
    secret: Optional[str] = None
    routing_key: Optional[str] = None
    enabled: Optional[bool] = True
    event_types: Optional[List[str]] = None

class WebhookUpdate(BaseModel):
    name: Optional[str] = None
    url: Optional[str] = None
    min_severity: Optional[str] = None
    secret: Optional[str] = None
    routing_key: Optional[str] = None
    enabled: Optional[bool] = None
    event_types: Optional[List[str]] = None

class WebhookOut(BaseModel):
    endpoint_id: str
    id: str
    name: str
    url: str
    target_type: str
    type: str
    min_severity: str
    has_secret: bool
    enabled: bool
    created_at: str

def to_webhook_out(ep: WebhookEndpoint) -> Dict[str, Any]:
    return {
        "endpoint_id": ep.id,
        "id": ep.id,
        "name": ep.name,
        "url": ep.url,
        "target_type": ep.type,
        "type": ep.type,
        "min_severity": ep.min_severity,
        "has_secret": ep.has_secret,
        "enabled": ep.enabled,
        "created_at": ep.created_at.isoformat() if ep.created_at else "",
    }

@router.get("")
def list_webhooks(db: Session = Depends(get_db)):
    endpoints = db.query(WebhookEndpoint).all()
    return [to_webhook_out(ep) for ep in endpoints]

@router.post("")
def create_webhook(req: WebhookCreate, db: Session = Depends(get_db)):
    resolved_type = (req.type or req.target_type or "generic").lower()
    endpoint = WebhookEndpoint(
        org_id="org_default",
        name=req.name,
        type=resolved_type,
        min_severity=req.min_severity or "High",
        enabled=req.enabled if req.enabled is not None else True,
        event_types=req.event_types or ["alert.created", "alert.escalated", "alert.resolved"],
    )
    endpoint.url = req.url
    if req.secret:
        endpoint.secret = req.secret

    db.add(endpoint)
    db.commit()
    db.refresh(endpoint)
    return to_webhook_out(endpoint)

@router.get("/{endpoint_id}")
def get_webhook(endpoint_id: str, db: Session = Depends(get_db)):
    ep = db.query(WebhookEndpoint).filter(WebhookEndpoint.id == endpoint_id).first()
    if not ep:
        raise NotFoundError("Webhook endpoint not found.")
    return to_webhook_out(ep)

@router.put("/{endpoint_id}")
def update_webhook(endpoint_id: str, req: WebhookUpdate, db: Session = Depends(get_db)):
    ep = db.query(WebhookEndpoint).filter(WebhookEndpoint.id == endpoint_id).first()
    if not ep:
        raise NotFoundError("Webhook endpoint not found.")

    if req.name is not None:
        ep.name = req.name
    if req.url is not None:
        ep.url = req.url
    if req.min_severity is not None:
        ep.min_severity = req.min_severity
    if req.secret is not None:
        ep.secret = req.secret
    if req.enabled is not None:
        ep.enabled = req.enabled
    if req.event_types is not None:
        ep.event_types = req.event_types

    db.commit()
    db.refresh(ep)
    return to_webhook_out(ep)

@router.delete("/{endpoint_id}")
def delete_webhook(endpoint_id: str, db: Session = Depends(get_db)):
    ep = db.query(WebhookEndpoint).filter(WebhookEndpoint.id == endpoint_id).first()
    if not ep:
        raise NotFoundError("Webhook endpoint not found.")

    db.delete(ep)
    db.commit()
    return {"status": "deleted", "endpoint_id": endpoint_id}

@router.post("/{endpoint_id}/test")
async def test_webhook(endpoint_id: str, db: Session = Depends(get_db)):
    ep = db.query(WebhookEndpoint).filter(WebhookEndpoint.id == endpoint_id).first()
    if not ep:
        raise NotFoundError("Webhook endpoint not found.")

    result = await webhook_dispatcher.test_endpoint(ep)
    return result
