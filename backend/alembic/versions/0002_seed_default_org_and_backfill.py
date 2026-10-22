"""seed default org and backfill

Revision ID: 0002_seed_org
Revises: 0001_initial
Create Date: 2026-10-22 10:05:00.000000

"""
from typing import Sequence, Union
from datetime import datetime, timezone
from alembic import op
import sqlalchemy as sa
from sqlalchemy.sql import table, column

revision: str = '0002_seed_org'
down_revision: Union[str, None] = '0001_initial'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

organizations_table = table(
    'organizations',
    column('id', sa.String),
    column('name', sa.String),
    column('slug', sa.String),
    column('is_synthetic', sa.Boolean),
    column('settings', sa.JSON),
    column('created_at', sa.DateTime),
)

agents_table = table(
    'agents',
    column('org_id', sa.String),
    column('is_synthetic', sa.Boolean),
    column('external_id', sa.String),
)

actions_table = table(
    'actions',
    column('org_id', sa.String),
    column('is_synthetic', sa.Boolean),
)

def upgrade() -> None:
    conn = op.get_bind()
    now = datetime.now(timezone.utc)

    # 1. Insert default org if not exists
    res = conn.execute(
        sa.text("SELECT count(*) FROM organizations WHERE id = 'org_default'")
    ).scalar()

    if res == 0:
        op.bulk_insert(
            organizations_table,
            [
                {
                    'id': 'org_default',
                    'name': 'Acme AI Corp (Default)',
                    'slug': 'acme-ai',
                    'is_synthetic': False,
                    'settings': {},
                    'created_at': now,
                },
                {
                    'id': 'org_synthetic',
                    'name': 'Synthetic Benchmark Sandbox',
                    'slug': 'synthetic-sandbox',
                    'is_synthetic': True,
                    'settings': {},
                    'created_at': now,
                },
            ],
        )

    # 2. Backfill org_id on existing rows if any are null/missing
    op.execute("UPDATE agents SET org_id = 'org_default' WHERE org_id IS NULL OR org_id = ''")
    op.execute("UPDATE actions SET org_id = 'org_default' WHERE org_id IS NULL OR org_id = ''")
    op.execute("UPDATE rules SET org_id = 'org_default' WHERE org_id IS NULL OR org_id = ''")
    op.execute("UPDATE alerts SET org_id = 'org_default' WHERE org_id IS NULL OR org_id = ''")

    # 3. Mark pre-existing simulator agents and rows as is_synthetic=true
    op.execute(
        "UPDATE agents SET is_synthetic = 1 WHERE external_id IN ('AGT-009', 'AGT-042', 'AGT-SIM') OR name LIKE '%Simulator%' OR name LIKE '%Synthetic%'"
    )
    op.execute(
        "UPDATE actions SET is_synthetic = 1 WHERE agent_id IN (SELECT id FROM agents WHERE is_synthetic = 1)"
    )

def downgrade() -> None:
    pass
