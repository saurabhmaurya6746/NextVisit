"""create_campaign_tables

Revision ID: cde64e621d13
Revises: fb3e04d0aee3
Create Date: 2026-07-23 13:24:46.341375

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


# revision identifiers, used by Alembic.
revision: str = 'cde64e621d13'
down_revision: Union[str, Sequence[str], None] = 'fb3e04d0aee3'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.create_table('campaigns',
        sa.Column('business_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('name', sa.String(length=150), nullable=False),
        sa.Column('campaign_type', sa.Enum('BIRTHDAY', 'ANNIVERSARY', 'WELCOME', 'RECOVERY', 'FESTIVAL', 'VIP', 'CUSTOM', name='campaigntype', native_enum=False), nullable=False),
        sa.Column('target_segment', sa.Enum('NEW_CUSTOMERS', 'INACTIVE_15', 'INACTIVE_30', 'INACTIVE_60', 'INACTIVE_90', 'BIRTHDAY_TODAY', 'ANNIVERSARY_TODAY', 'VIP_CUSTOMERS', 'ALL_CUSTOMERS', name='targetsegment', native_enum=False), nullable=False),
        sa.Column('title', sa.String(length=200), nullable=False),
        sa.Column('message', sa.String(length=2000), nullable=False),
        sa.Column('is_active', sa.Boolean(), nullable=False),
        sa.Column('id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.ForeignKeyConstraint(['business_id'], ['businesses.id'], ),
        sa.PrimaryKeyConstraint('id')
    )

    op.create_table('campaign_logs',
        sa.Column('campaign_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('customer_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('status', sa.Enum('PENDING', 'SENT', 'FAILED', name='campaignlogstatus', native_enum=False), nullable=False),
        sa.Column('scheduled_for', sa.DateTime(timezone=True), nullable=True),
        sa.Column('sent_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('failure_reason', sa.String(length=1000), nullable=True),
        sa.Column('id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.ForeignKeyConstraint(['campaign_id'], ['campaigns.id'], ),
        sa.ForeignKeyConstraint(['customer_id'], ['customers.id'], ),
        sa.PrimaryKeyConstraint('id')
    )

    op.create_table('festivals',
        sa.Column('id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('business_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('businesses.id'), nullable=True),
        sa.Column('festival_name', sa.String(length=150), nullable=False),
        sa.Column('festival_date', sa.Date(), nullable=False),
        sa.Column('festival_type', sa.String(length=50), server_default='cultural', nullable=False),
        sa.Column('country', sa.String(length=100), server_default='India', nullable=False),
        sa.Column('state', sa.String(length=100), nullable=True),
        sa.Column('is_active', sa.Boolean(), server_default=sa.true(), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.PrimaryKeyConstraint('id')
    )

    op.create_table('festival_campaigns',
        sa.Column('id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('business_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('businesses.id'), nullable=False),
        sa.Column('festival_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('festivals.id'), nullable=False),
        sa.Column('title', sa.String(length=200), nullable=True),
        sa.Column('description', sa.Text(), nullable=True),
        sa.Column('discount_percent', sa.String(length=50), nullable=True),
        sa.Column('image_url', sa.Text(), nullable=True),
        sa.Column('start_date', sa.Date(), nullable=True),
        sa.Column('end_date', sa.Date(), nullable=True),
        sa.Column('coupon_code', sa.String(length=50), nullable=True),
        sa.Column('coupon_id', postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column('language', sa.String(length=30), server_default='Hinglish', nullable=False),
        sa.Column('tone', sa.String(length=40), server_default='Festive', nullable=False),
        sa.Column('message', sa.Text(), nullable=True),
        sa.Column('ai_generated', sa.Boolean(), server_default=sa.false(), nullable=False),
        sa.Column('last_generated', sa.DateTime(timezone=True), nullable=True),
        sa.Column('last_sent', sa.DateTime(timezone=True), nullable=True),
        sa.Column('enabled', sa.Boolean(), server_default=sa.true(), nullable=False),
        sa.Column('is_deleted', sa.Boolean(), server_default=sa.false(), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.PrimaryKeyConstraint('id')
    )


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_table('festival_campaigns')
    op.drop_table('festivals')
    op.drop_table('campaign_logs')
    op.drop_table('campaigns')
