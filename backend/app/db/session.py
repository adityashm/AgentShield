import os
from typing import AsyncGenerator, Generator
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, Session
from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker, AsyncSession

from ..core.config import settings

# Construct async and sync database URLs
raw_db_url = settings.DATABASE_URL

if raw_db_url.startswith("sqlite+aiosqlite:"):
    async_db_url = raw_db_url
    sync_db_url = raw_db_url.replace("sqlite+aiosqlite:", "sqlite:")
elif raw_db_url.startswith("postgresql+asyncpg:"):
    async_db_url = raw_db_url
    sync_db_url = raw_db_url.replace("postgresql+asyncpg:", "postgresql://")
elif raw_db_url.startswith("sqlite:"):
    sync_db_url = raw_db_url
    async_db_url = raw_db_url.replace("sqlite:", "sqlite+aiosqlite:")
elif raw_db_url.startswith("postgresql://"):
    sync_db_url = raw_db_url
    async_db_url = raw_db_url.replace("postgresql://", "postgresql+asyncpg://")
else:
    async_db_url = raw_db_url
    sync_db_url = raw_db_url

# Async Engine and Session
is_sqlite = "sqlite" in async_db_url
async_connect_args = {"check_same_thread": False} if is_sqlite else {}
sync_connect_args = {"check_same_thread": False} if is_sqlite else {}

async_engine = create_async_engine(
    async_db_url,
    connect_args=async_connect_args,
    pool_pre_ping=True,
    echo=False,
)

AsyncSessionLocal = async_sessionmaker(
    bind=async_engine,
    class_=AsyncSession,
    autocommit=False,
    autoflush=False,
    expire_on_commit=False,
)

# Synchronous Engine and Session for sync scripts, tests, and Alembic
engine = create_engine(
    sync_db_url,
    connect_args=sync_connect_args,
    pool_pre_ping=True,
    echo=False,
)

SessionLocal = sessionmaker(
    bind=engine,
    autocommit=False,
    autoflush=False,
    expire_on_commit=False,
)

async def get_async_db() -> AsyncGenerator[AsyncSession, None]:
    async with AsyncSessionLocal() as session:
        try:
            yield session
        finally:
            await session.close()

def get_db() -> Generator[Session, None, None]:
    """Synchronous session generator for backward compatibility."""
    session = SessionLocal()
    try:
        yield session
    finally:
        session.close()
