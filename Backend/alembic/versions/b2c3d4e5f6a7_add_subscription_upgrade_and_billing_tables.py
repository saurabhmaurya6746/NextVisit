"""add_subscription_upgrade_and_billing_tables

Revision ID: b2c3d4e5f6a7
Revises: 98f12a3b4c5d
Create Date: 2026-07-31 14:30:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = 'b2c3d4e5f6a7'
down_revision: Union[str, Sequence[str], None] = '98f12a3b4c5d'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # 1. Create subscription_upgrade_requests table
    op.create_table(
        'subscription_upgrade_requests',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('business_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('businesses.id'), nullable=False),
        sa.Column('current_plan_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('subscription_plans.id'), nullable=True),
        sa.Column('requested_plan_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('subscription_plans.id'), nullable=False),
        sa.Column('status', sa.String(length=30), server_default='PENDING', nullable=False),
        sa.Column('reason', sa.String(length=500), nullable=True),
        sa.Column('requested_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('approved_by_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('admins.id'), nullable=True),
        sa.Column('approved_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('rejected_by_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('admins.id'), nullable=True),
        sa.Column('rejected_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )

    # 2. Create subscription_billing_history table
    op.create_table(
        'subscription_billing_history',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('business_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('businesses.id'), nullable=False),
        sa.Column('plan_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('subscription_plans.id'), nullable=False),
        sa.Column('invoice_number', sa.String(length=50), nullable=False),
        sa.Column('amount', sa.Float(), server_default='0.0', nullable=False),
        sa.Column('billing_date', sa.DateTime(timezone=True), nullable=False),
        sa.Column('renewal_date', sa.DateTime(timezone=True), nullable=True),
        sa.Column('status', sa.String(length=30), server_default='PAID', nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )


def downgrade() -> None:
    op.drop_table('subscription_billing_history')
    op.drop_table('subscription_upgrade_requests')
