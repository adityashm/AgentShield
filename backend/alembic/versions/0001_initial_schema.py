"""initial schema

Revision ID: 0001_initial
Revises: 
Create Date: 2026-10-22 10:00:00.000000

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

revision: str = '0001_initial'
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

def upgrade() -> None:
    # organizations
    op.create_table(
        'organizations',
        sa.Column('id', sa.String(length=64), primary_key=True),
        sa.Column('name', sa.String(length=128), nullable=False),
        sa.Column('slug', sa.String(length=64), nullable=False),
        sa.Column('is_synthetic', sa.Boolean(), nullable=False, server_default='0'),
        sa.Column('settings', sa.JSON(), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index('ix_organizations_id', 'organizations', ['id'])
    op.create_index('ix_organizations_slug', 'organizations', ['slug'], unique=True)

    # users
    op.create_table(
        'users',
        sa.Column('id', sa.String(length=64), primary_key=True),
        sa.Column('org_id', sa.String(length=64), sa.ForeignKey('organizations.id', ondelete='CASCADE'), nullable=False),
        sa.Column('email', sa.String(length=255), nullable=False),
        sa.Column('password_hash', sa.String(length=255), nullable=False),
        sa.Column('role', sa.String(length=32), nullable=False, server_default='viewer'),
        sa.Column('is_active', sa.Boolean(), nullable=False, server_default='1'),
        sa.Column('failed_logins', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('locked_until', sa.DateTime(timezone=True), nullable=True),
        sa.Column('last_login_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index('ix_users_id', 'users', ['id'])
    op.create_index('ix_users_org_id', 'users', ['org_id'])
    op.create_index('ix_users_email', 'users', ['email'], unique=True)

    # refresh_tokens
    op.create_table(
        'refresh_tokens',
        sa.Column('id', sa.String(length=64), primary_key=True),
        sa.Column('user_id', sa.String(length=64), sa.ForeignKey('users.id', ondelete='CASCADE'), nullable=False),
        sa.Column('token_hash', sa.String(length=64), nullable=False),
        sa.Column('expires_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('revoked_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('replaced_by', sa.String(length=64), nullable=True),
        sa.Column('user_agent', sa.String(length=255), nullable=True),
        sa.Column('ip', sa.String(length=64), nullable=True),
    )
    op.create_index('ix_refresh_tokens_id', 'refresh_tokens', ['id'])
    op.create_index('ix_refresh_tokens_user_id', 'refresh_tokens', ['user_id'])
    op.create_index('ix_refresh_tokens_token_hash', 'refresh_tokens', ['token_hash'], unique=True)

    # api_keys
    op.create_table(
        'api_keys',
        sa.Column('id', sa.String(length=64), primary_key=True),
        sa.Column('org_id', sa.String(length=64), sa.ForeignKey('organizations.id', ondelete='CASCADE'), nullable=False),
        sa.Column('name', sa.String(length=128), nullable=False),
        sa.Column('prefix', sa.String(length=32), nullable=False),
        sa.Column('key_hash', sa.String(length=64), nullable=False),
        sa.Column('scopes', sa.JSON(), nullable=False),
        sa.Column('created_by', sa.String(length=64), sa.ForeignKey('users.id', ondelete='SET NULL'), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('last_used_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('expires_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('revoked_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('replaced_by', sa.String(length=64), nullable=True),
    )
    op.create_index('ix_api_keys_id', 'api_keys', ['id'])
    op.create_index('ix_api_keys_org_id', 'api_keys', ['org_id'])
    op.create_index('ix_api_keys_prefix', 'api_keys', ['prefix'])
    op.create_index('ix_api_keys_key_hash', 'api_keys', ['key_hash'], unique=True)

    # agents
    op.create_table(
        'agents',
        sa.Column('id', sa.String(length=64), primary_key=True),
        sa.Column('org_id', sa.String(length=64), sa.ForeignKey('organizations.id', ondelete='CASCADE'), nullable=False),
        sa.Column('external_id', sa.String(length=128), nullable=False),
        sa.Column('name', sa.String(length=128), nullable=False),
        sa.Column('framework', sa.String(length=64), nullable=True),
        sa.Column('environment', sa.String(length=64), nullable=False, server_default='production'),
        sa.Column('status', sa.String(length=32), nullable=False, server_default='active'),
        sa.Column('risk_score', sa.Float(), nullable=False, server_default='0.0'),
        sa.Column('first_seen', sa.DateTime(timezone=True), nullable=False),
        sa.Column('last_seen', sa.DateTime(timezone=True), nullable=False),
        sa.Column('metadata_json', sa.JSON(), nullable=False),
        sa.Column('is_synthetic', sa.Boolean(), nullable=False, server_default='0'),
        sa.UniqueConstraint('org_id', 'external_id', name='uq_agent_org_ext_id'),
    )
    op.create_index('ix_agents_id', 'agents', ['id'])
    op.create_index('ix_agents_org_id', 'agents', ['org_id'])
    op.create_index('ix_agents_external_id', 'agents', ['external_id'])

    # sessions
    op.create_table(
        'sessions',
        sa.Column('id', sa.String(length=64), primary_key=True),
        sa.Column('org_id', sa.String(length=64), sa.ForeignKey('organizations.id', ondelete='CASCADE'), nullable=False),
        sa.Column('agent_id', sa.String(length=64), sa.ForeignKey('agents.id', ondelete='CASCADE'), nullable=False),
        sa.Column('external_session_id', sa.String(length=128), nullable=False),
        sa.Column('started_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('last_event_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('event_count', sa.Integer(), nullable=False, server_default='0'),
        sa.UniqueConstraint('org_id', 'agent_id', 'external_session_id', name='uq_session_org_agent_ext'),
    )
    op.create_index('ix_sessions_id', 'sessions', ['id'])
    op.create_index('ix_sessions_org_id', 'sessions', ['org_id'])
    op.create_index('ix_sessions_agent_id', 'sessions', ['agent_id'])

    # actions
    op.create_table(
        'actions',
        sa.Column('id', sa.String(length=64), primary_key=True),
        sa.Column('org_id', sa.String(length=64), sa.ForeignKey('organizations.id', ondelete='CASCADE'), nullable=False),
        sa.Column('agent_id', sa.String(length=64), sa.ForeignKey('agents.id', ondelete='CASCADE'), nullable=False),
        sa.Column('session_id', sa.String(length=64), sa.ForeignKey('sessions.id', ondelete='SET NULL'), nullable=True),
        sa.Column('event_id', sa.String(length=128), nullable=False),
        sa.Column('parent_event_id', sa.String(length=128), nullable=True),
        sa.Column('trace_id', sa.String(length=128), nullable=True),
        sa.Column('action_type', sa.String(length=64), nullable=False),
        sa.Column('tool_name', sa.String(length=128), nullable=True),
        sa.Column('status', sa.String(length=32), nullable=False, server_default='started'),
        sa.Column('parameters', sa.JSON(), nullable=False),
        sa.Column('output_excerpt', sa.Text(), nullable=True),
        sa.Column('latency_ms', sa.Float(), nullable=True),
        sa.Column('error', sa.Text(), nullable=True),
        sa.Column('timestamp', sa.DateTime(timezone=True), nullable=False),
        sa.Column('received_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('clock_skew', sa.Boolean(), nullable=False, server_default='0'),
        sa.Column('features', sa.JSON(), nullable=False),
        sa.Column('rule_score', sa.Float(), nullable=False, server_default='0.0'),
        sa.Column('anomaly_score', sa.Float(), nullable=False, server_default='0.0'),
        sa.Column('risk_score', sa.Float(), nullable=False, server_default='0.0'),
        sa.Column('severity', sa.String(length=32), nullable=False, server_default='low'),
        sa.Column('decision', sa.String(length=32), nullable=False, server_default='allow'),
        sa.Column('reason', sa.Text(), nullable=True),
        sa.Column('matched_rules', sa.JSON(), nullable=False),
        sa.Column('is_synthetic', sa.Boolean(), nullable=False, server_default='0'),
        sa.UniqueConstraint('org_id', 'event_id', name='uq_action_org_event_id'),
    )
    op.create_index('ix_actions_id', 'actions', ['id'])
    op.create_index('ix_actions_org_id', 'actions', ['org_id'])
    op.create_index('ix_actions_agent_id', 'actions', ['agent_id'])
    op.create_index('ix_actions_event_id', 'actions', ['event_id'])
    op.create_index('ix_actions_org_timestamp', 'actions', ['org_id', 'timestamp'])
    op.create_index('ix_actions_org_agent_timestamp', 'actions', ['org_id', 'agent_id', 'timestamp'])

    # rules
    op.create_table(
        'rules',
        sa.Column('id', sa.String(length=64), primary_key=True),
        sa.Column('org_id', sa.String(length=64), sa.ForeignKey('organizations.id', ondelete='CASCADE'), nullable=True),
        sa.Column('name', sa.String(length=128), nullable=False),
        sa.Column('description', sa.Text(), nullable=True),
        sa.Column('enabled', sa.Boolean(), nullable=False, server_default='1'),
        sa.Column('severity', sa.String(length=32), nullable=False, server_default='medium'),
        sa.Column('mode', sa.String(length=32), nullable=False, server_default='alert'),
        sa.Column('condition', sa.JSON(), nullable=False),
        sa.Column('owasp_ids', sa.JSON(), nullable=False),
        sa.Column('atlas_ids', sa.JSON(), nullable=False),
        sa.Column('version', sa.Integer(), nullable=False, server_default='1'),
        sa.Column('is_default', sa.Boolean(), nullable=False, server_default='0'),
        sa.Column('cloned_from', sa.String(length=64), nullable=True),
        sa.Column('created_by', sa.String(length=64), nullable=True),
        sa.Column('matches_count', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index('ix_rules_id', 'rules', ['id'])
    op.create_index('ix_rules_org_id', 'rules', ['org_id'])
    op.create_index('ix_rules_org_enabled', 'rules', ['org_id', 'enabled'])

    # alerts
    op.create_table(
        'alerts',
        sa.Column('id', sa.String(length=64), primary_key=True),
        sa.Column('org_id', sa.String(length=64), sa.ForeignKey('organizations.id', ondelete='CASCADE'), nullable=False),
        sa.Column('agent_id', sa.String(length=64), sa.ForeignKey('agents.id', ondelete='CASCADE'), nullable=False),
        sa.Column('first_action_id', sa.String(length=64), sa.ForeignKey('actions.id', ondelete='SET NULL'), nullable=True),
        sa.Column('rule_id', sa.String(length=64), sa.ForeignKey('rules.id', ondelete='SET NULL'), nullable=True),
        sa.Column('title', sa.String(length=255), nullable=False),
        sa.Column('severity', sa.String(length=32), nullable=False),
        sa.Column('status', sa.String(length=32), nullable=False, server_default='open'),
        sa.Column('risk_score', sa.Float(), nullable=False, server_default='0.0'),
        sa.Column('group_key', sa.String(length=255), nullable=False),
        sa.Column('count', sa.Integer(), nullable=False, server_default='1'),
        sa.Column('first_seen', sa.DateTime(timezone=True), nullable=False),
        sa.Column('last_seen', sa.DateTime(timezone=True), nullable=False),
        sa.Column('assignee_id', sa.String(length=64), sa.ForeignKey('users.id', ondelete='SET NULL'), nullable=True),
        sa.Column('resolved_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('resolution_note', sa.Text(), nullable=True),
    )
    op.create_index('ix_alerts_id', 'alerts', ['id'])
    op.create_index('ix_alerts_org_id', 'alerts', ['org_id'])
    op.create_index('ix_alerts_agent_id', 'alerts', ['agent_id'])
    op.create_index('ix_alerts_group_key', 'alerts', ['group_key'])
    op.create_index('ix_alerts_org_status_severity', 'alerts', ['org_id', 'status', 'severity'])

    # alert_comments
    op.create_table(
        'alert_comments',
        sa.Column('id', sa.String(length=64), primary_key=True),
        sa.Column('alert_id', sa.String(length=64), sa.ForeignKey('alerts.id', ondelete='CASCADE'), nullable=False),
        sa.Column('user_id', sa.String(length=64), sa.ForeignKey('users.id', ondelete='CASCADE'), nullable=False),
        sa.Column('body', sa.Text(), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index('ix_alert_comments_id', 'alert_comments', ['id'])
    op.create_index('ix_alert_comments_alert_id', 'alert_comments', ['alert_id'])

    # webhook_endpoints
    op.create_table(
        'webhook_endpoints',
        sa.Column('id', sa.String(length=64), primary_key=True),
        sa.Column('org_id', sa.String(length=64), sa.ForeignKey('organizations.id', ondelete='CASCADE'), nullable=False),
        sa.Column('name', sa.String(length=128), nullable=False),
        sa.Column('type', sa.String(length=32), nullable=False, server_default='generic'),
        sa.Column('url_enc', sa.Text(), nullable=False),
        sa.Column('secret_enc', sa.Text(), nullable=True),
        sa.Column('routing_key_enc', sa.Text(), nullable=True),
        sa.Column('min_severity', sa.String(length=32), nullable=False, server_default='high'),
        sa.Column('event_types', sa.JSON(), nullable=False),
        sa.Column('enabled', sa.Boolean(), nullable=False, server_default='1'),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index('ix_webhook_endpoints_id', 'webhook_endpoints', ['id'])
    op.create_index('ix_webhook_endpoints_org_id', 'webhook_endpoints', ['org_id'])

    # webhook_deliveries
    op.create_table(
        'webhook_deliveries',
        sa.Column('id', sa.String(length=64), primary_key=True),
        sa.Column('org_id', sa.String(length=64), sa.ForeignKey('organizations.id', ondelete='CASCADE'), nullable=False),
        sa.Column('endpoint_id', sa.String(length=64), sa.ForeignKey('webhook_endpoints.id', ondelete='CASCADE'), nullable=False),
        sa.Column('alert_id', sa.String(length=64), sa.ForeignKey('alerts.id', ondelete='SET NULL'), nullable=True),
        sa.Column('event_type', sa.String(length=64), nullable=False),
        sa.Column('payload', sa.JSON(), nullable=False),
        sa.Column('status', sa.String(length=32), nullable=False, server_default='pending'),
        sa.Column('attempts', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('next_attempt_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('last_error', sa.Text(), nullable=True),
        sa.Column('response_code', sa.Integer(), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('sent_at', sa.DateTime(timezone=True), nullable=True),
    )
    op.create_index('ix_webhook_deliveries_id', 'webhook_deliveries', ['id'])
    op.create_index('ix_webhook_deliveries_org_id', 'webhook_deliveries', ['org_id'])
    op.create_index('ix_webhook_deliveries_status_next', 'webhook_deliveries', ['status', 'next_attempt_at'])

    # audit_log
    op.create_table(
        'audit_log',
        sa.Column('id', sa.String(length=64), primary_key=True),
        sa.Column('org_id', sa.String(length=64), sa.ForeignKey('organizations.id', ondelete='CASCADE'), nullable=False),
        sa.Column('ts', sa.DateTime(timezone=True), nullable=False),
        sa.Column('actor_type', sa.String(length=32), nullable=False, server_default='system'),
        sa.Column('actor_id', sa.String(length=128), nullable=False, server_default='system'),
        sa.Column('action', sa.String(length=64), nullable=False),
        sa.Column('target_type', sa.String(length=64), nullable=False),
        sa.Column('target_id', sa.String(length=128), nullable=False),
        sa.Column('ip', sa.String(length=64), nullable=True),
        sa.Column('details', sa.JSON(), nullable=False),
        sa.Column('prev_hash', sa.String(length=64), nullable=False),
        sa.Column('hash', sa.String(length=64), nullable=False),
    )
    op.create_index('ix_audit_log_id', 'audit_log', ['id'])
    op.create_index('ix_audit_log_org_id', 'audit_log', ['org_id'])
    op.create_index('ix_audit_log_org_ts', 'audit_log', ['org_id', 'ts'])

    # ml_models
    op.create_table(
        'ml_models',
        sa.Column('id', sa.String(length=64), primary_key=True),
        sa.Column('org_id', sa.String(length=64), sa.ForeignKey('organizations.id', ondelete='CASCADE'), nullable=True),
        sa.Column('scope', sa.String(length=32), nullable=False, server_default='global'),
        sa.Column('agent_id', sa.String(length=64), nullable=True),
        sa.Column('version', sa.Integer(), nullable=False, server_default='1'),
        sa.Column('feature_set', sa.String(length=32), nullable=False, server_default='v1'),
        sa.Column('trained_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('n_samples', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('params', sa.JSON(), nullable=False),
        sa.Column('calibration', sa.JSON(), nullable=False),
        sa.Column('path', sa.String(length=255), nullable=False),
        sa.Column('is_active', sa.Boolean(), nullable=False, server_default='1'),
    )
    op.create_index('ix_ml_models_id', 'ml_models', ['id'])
    op.create_index('ix_ml_models_org_scope_active', 'ml_models', ['org_id', 'scope', 'is_active'])

def downgrade() -> None:
    op.drop_table('ml_models')
    op.drop_table('audit_log')
    op.drop_table('webhook_deliveries')
    op.drop_table('webhook_endpoints')
    op.drop_table('alert_comments')
    op.drop_table('alerts')
    op.drop_table('rules')
    op.drop_table('actions')
    op.drop_table('sessions')
    op.drop_table('agents')
    op.drop_table('api_keys')
    op.drop_table('refresh_tokens')
    op.drop_table('users')
    op.drop_table('organizations')
