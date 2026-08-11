"""add_payment_payee_name_to_business_settings

Revision ID: 4e3574d64a0a
Revises: f6a7b8c9d0e1
Create Date: 2026-08-07 12:42:15.730131

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


# revision identifiers, used by Alembic.
revision: str = '4e3574d64a0a'
down_revision: Union[str, Sequence[str], None] = 'f6a7b8c9d0e1'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('business_settings', sa.Column('payment_payee_name', sa.String(length=100), nullable=True))

    # Platform Settings
    op.create_table(
        'platform_settings',
        sa.Column('id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('platform_name', sa.String(length=150), server_default='NextVisit', nullable=False),
        sa.Column('logo_url', sa.String(length=500), nullable=True),
        sa.Column('support_email', sa.String(length=150), server_default='support@nextvisit.com', nullable=False),
        sa.Column('support_phone', sa.String(length=50), server_default='+91 98765 43210', nullable=True),
        sa.Column('default_plan', sa.String(length=50), server_default='STARTER', nullable=False),
        sa.Column('trial_days', sa.Integer(), server_default='14', nullable=False),
        sa.Column('default_currency', sa.String(length=20), server_default='INR', nullable=False),
        sa.Column('max_clients', sa.Integer(), server_default='1000', nullable=False),
        sa.Column('maintenance_mode', sa.Boolean(), server_default=sa.false(), nullable=False),
        sa.Column('allow_new_registrations', sa.Boolean(), server_default=sa.true(), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.PrimaryKeyConstraint('id')
    )

    # AI Credit Packs
    op.create_table(
        'ai_credit_packs',
        sa.Column('id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('name', sa.String(length=100), nullable=False),
        sa.Column('ai_credits', sa.Integer(), server_default='100', nullable=False),
        sa.Column('price', sa.Float(), server_default='49.0', nullable=False),
        sa.Column('is_active', sa.Boolean(), server_default=sa.true(), nullable=False),
        sa.Column('sort_order', sa.Integer(), server_default='0', nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.PrimaryKeyConstraint('id')
    )

    # AI Credit Purchase Requests
    op.create_table(
        'ai_credit_purchase_requests',
        sa.Column('id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('business_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('businesses.id'), nullable=False),
        sa.Column('pack_id', postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column('pack_name', sa.String(length=100), nullable=False),
        sa.Column('ai_credits', sa.Integer(), nullable=False),
        sa.Column('amount', sa.Float(), server_default='0.0', nullable=False),
        sa.Column('payment_status', sa.String(length=20), server_default='PENDING', nullable=False),
        sa.Column('approval_status', sa.String(length=20), server_default='PENDING', nullable=False),
        sa.Column('requested_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('approved_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('approved_by_admin_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('admins.id'), nullable=True),
        sa.Column('approved_by_admin_name', sa.String(length=100), nullable=True),
        sa.Column('rejection_reason', sa.Text(), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.PrimaryKeyConstraint('id')
    )

    # AI Credit Audit Logs
    op.create_table(
        'ai_credit_audit_logs',
        sa.Column('id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('business_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('businesses.id'), nullable=False),
        sa.Column('admin_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('admins.id'), nullable=True),
        sa.Column('action', sa.String(length=50), nullable=False),
        sa.Column('amount', sa.Integer(), server_default='0', nullable=False),
        sa.Column('reason', sa.String(length=100), nullable=False),
        sa.Column('notes', sa.Text(), nullable=True),
        sa.Column('previous_balance', sa.Integer(), server_default='0', nullable=False),
        sa.Column('new_balance', sa.Integer(), server_default='0', nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.PrimaryKeyConstraint('id')
    )


def downgrade() -> None:
    op.drop_table('ai_credit_audit_logs')
    op.drop_table('ai_credit_purchase_requests')
    op.drop_table('ai_credit_packs')
    op.drop_table('platform_settings')
    op.drop_column('business_settings', 'payment_payee_name')
