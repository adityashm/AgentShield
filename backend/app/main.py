from contextlib import asynccontextmanager
from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from fastapi.exceptions import RequestValidationError
from starlette.exceptions import HTTPException as StarletteHTTPException
import logging

from .core.config import settings
from .core.logging import RequestIdMiddleware, logger
from .core.errors import (
    ProblemException,
    problem_exception_handler,
    http_exception_handler,
    validation_exception_handler,
)
from .database import engine, Base, SessionLocal
from .services.rule_engine import RuleEngine
from .services.simulator import simulator
from .services.websocket_manager import ws_manager
from .services.auth import seed_default_org_and_key

from .api.v1.actions import router as actions_router
from .api.v1.agents import router as agents_router
from .api.v1.alerts import router as alerts_router
from .api.v1.rules import router as rules_router
from .api.v1.model import router as model_router
from .api.v1.system import router as system_router
from .api.v1.api_keys import router as api_keys_router
from .api.v1.auth import router as auth_router
from .api.v1.users import router as users_router
from .api.v1.webhooks import router as webhooks_router

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup validation and schema initialization
    logger.info("Initializing AgentShield database schema...")
    Base.metadata.create_all(bind=engine)
    
    db = SessionLocal()
    try:
        RuleEngine.seed_default_rules(db)
        seed_default_org_and_key(db)
    finally:
        db.close()

    if settings.AUTO_SIMULATE or settings.SIMULATOR_ENABLED:
        logger.info("Starting autonomous agent background simulation...")
        await simulator.start()

    yield

    # Shutdown
    logger.info("Shutting down simulator and background tasks...")
    await simulator.stop()

app = FastAPI(
    title=settings.PROJECT_NAME,
    version=settings.VERSION,
    description="Behaviour-Based Security Monitoring and Guardrail System for Autonomous AI Agents",
    lifespan=lifespan,
    docs_url="/docs" if settings.ENABLE_DOCS else None,
    redoc_url="/redoc" if settings.ENABLE_DOCS else None,
)

# Request ID and Structured Logging Middleware
app.add_middleware(RequestIdMiddleware)

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS if settings.CORS_ORIGINS else ["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["X-Request-ID", "X-Response-Time"],
)

# Exception handlers for RFC 7807 problem+json
app.add_exception_handler(ProblemException, problem_exception_handler)
app.add_exception_handler(StarletteHTTPException, http_exception_handler)
app.add_exception_handler(RequestValidationError, validation_exception_handler)

# Include v1 REST Routers
app.include_router(auth_router, prefix=settings.API_V1_STR)
app.include_router(users_router, prefix=settings.API_V1_STR)
app.include_router(actions_router, prefix=settings.API_V1_STR)
app.include_router(agents_router, prefix=settings.API_V1_STR)
app.include_router(alerts_router, prefix=settings.API_V1_STR)
app.include_router(rules_router, prefix=settings.API_V1_STR)
app.include_router(model_router, prefix=settings.API_V1_STR)
app.include_router(system_router, prefix=settings.API_V1_STR)
app.include_router(api_keys_router, prefix=settings.API_V1_STR)
app.include_router(webhooks_router, prefix=settings.API_V1_STR)

# Global Telemetry WebSocket Endpoint
@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    await ws_manager.connect(websocket)
    try:
        while True:
            data = await websocket.receive_text()
            if data == "ping":
                await websocket.send_text("pong")
    except WebSocketDisconnect:
        ws_manager.disconnect(websocket)
    except Exception:
        ws_manager.disconnect(websocket)

# Agent-Specific WebSocket Endpoint
@app.websocket("/ws/agent/{agent_id}")
async def agent_websocket_endpoint(websocket: WebSocket, agent_id: str):
    await ws_manager.connect(websocket, agent_id=agent_id)
    try:
        while True:
            data = await websocket.receive_text()
            if data == "ping":
                await websocket.send_text("pong")
    except WebSocketDisconnect:
        ws_manager.disconnect(websocket, agent_id=agent_id)
    except Exception:
        ws_manager.disconnect(websocket, agent_id=agent_id)

@app.get("/")
def root():
    return {
        "system": settings.PROJECT_NAME,
        "version": settings.VERSION,
        "status": "operational",
        "documentation": "/docs" if settings.ENABLE_DOCS else None,
        "endpoints": {
            "auth": f"{settings.API_V1_STR}/auth/login",
            "actions": f"{settings.API_V1_STR}/actions",
            "agents": f"{settings.API_V1_STR}/agents",
            "alerts": f"{settings.API_V1_STR}/alerts",
            "rules": f"{settings.API_V1_STR}/rules",
            "model_retrain": f"{settings.API_V1_STR}/model/retrain",
            "health": f"{settings.API_V1_STR}/system/health",
            "websocket": "/ws",
        },
    }
