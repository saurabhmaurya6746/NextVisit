"""add_recovery_settings_to_business_settings

Revision ID: f383f7b9c37d
Revises: c98170d84ae7
Create Date: 2026-07-30 22:41:50.979351

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


# revision identifiers, used by Alembic.
revision: str = 'f383f7b9c37d'
down_revision: Union[str, Sequence[str], None] = 'c98170d84ae7'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.add_column('business_settings', sa.Column(
        'recovery_enabled', sa.Boolean(), nullable=False,
        server_default=sa.text('true')
    ))
    op.add_column('business_settings', sa.Column(
        'recovery_buckets', sa.String(length=50), nullable=False,
        server_default=sa.text("'15,30,45,60,90'")
    ))
    op.add_column('business_settings', sa.Column(
        'recovery_cooldown_days', sa.Integer(), nullable=False,
        server_default=sa.text('7')
    ))
    op.add_column('business_settings', sa.Column(
        'recovery_max_messages_per_day', sa.Integer(), nullable=False,
        server_default=sa.text('100')
    ))
    op.add_column('business_settings', sa.Column(
        'recovery_window_days', sa.Integer(), nullable=False,
        server_default=sa.text('30')
    ))

    # Create vip_settings table
    op.create_table(
        'vip_settings',
        sa.Column('id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('business_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('businesses.id', ondelete='CASCADE'), nullable=False),
        sa.Column('min_lifetime_spend', sa.Float(), server_default='10000.0', nullable=False),
        sa.Column('min_visits', sa.Integer(), server_default='15', nullable=False),
        sa.Column('min_avg_bill', sa.Float(), server_default='0.0', nullable=False),
        sa.Column('last_visit_within_days', sa.Integer(), nullable=True),
        sa.Column('rule_logic', sa.String(length=10), server_default='ANY', nullable=False),
        sa.Column('is_active', sa.Boolean(), server_default=sa.true(), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('business_id')
    )


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_table('vip_settings')
    op.drop_column('business_settings', 'recovery_window_days')
    op.drop_column('business_settings', 'recovery_max_messages_per_day')
    op.drop_column('business_settings', 'recovery_cooldown_days')
    op.drop_column('business_settings', 'recovery_buckets')
    op.drop_column('business_settings', 'recovery_enabled')
