"""add_coupon_and_redemption_tables

Revision ID: 72d286494845
Revises: e5d15e4e04e4
Create Date: 2026-07-31 11:50:57.684285

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


# revision identifiers, used by Alembic.
revision: str = '72d286494845'
down_revision: Union[str, Sequence[str], None] = 'e5d15e4e04e4'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.create_table(
        'coupons',
        sa.Column('id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('business_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('businesses.id'), nullable=False),
        sa.Column('code', sa.String(length=50), nullable=False),
        sa.Column('name', sa.String(length=100), nullable=False),
        sa.Column('description', sa.Text(), nullable=True),
        sa.Column('coupon_type', sa.Enum('PERCENTAGE', 'FLAT', 'FREE_ITEM', 'BOGO', name='coupontype', native_enum=False), server_default='PERCENTAGE', nullable=False),
        sa.Column('reward_value', sa.Float(), server_default='0.0', nullable=False),
        sa.Column('reward_description', sa.String(length=255), nullable=True),
        sa.Column('max_discount_amount', sa.Float(), nullable=True),
        sa.Column('min_order_amount', sa.Float(), server_default='0.0', nullable=False),
        sa.Column('max_usage', sa.Integer(), nullable=True),
        sa.Column('per_customer_limit', sa.Integer(), server_default='1', nullable=False),
        sa.Column('redeemed_count', sa.Integer(), server_default='0', nullable=False),
        sa.Column('valid_from', sa.DateTime(timezone=True), nullable=True),
        sa.Column('valid_until', sa.DateTime(timezone=True), nullable=True),
        sa.Column('applicable_segment', sa.String(length=50), server_default='ALL', nullable=False),
        sa.Column('status', sa.Enum('ACTIVE', 'INACTIVE', 'EXPIRED', 'UPCOMING', 'DELETED', name='couponstatus', native_enum=False), server_default='ACTIVE', nullable=False),
        sa.Column('is_deleted', sa.Boolean(), server_default=sa.false(), nullable=False),
        sa.Column('created_by', postgresql.UUID(as_uuid=True), sa.ForeignKey('users.id'), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.PrimaryKeyConstraint('id')
    )

    op.create_table(
        'coupon_redemptions',
        sa.Column('id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('business_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('businesses.id'), nullable=False),
        sa.Column('coupon_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('coupons.id'), nullable=False),
        sa.Column('customer_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('customers.id'), nullable=False),
        sa.Column('order_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('orders.id'), nullable=True),
        sa.Column('visit_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('visits.id'), nullable=True),
        sa.Column('discount_amount', sa.Float(), server_default='0.0', nullable=False),
        sa.Column('redeemed_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.PrimaryKeyConstraint('id')
    )


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_table('coupon_redemptions')
    op.drop_table('coupons')
