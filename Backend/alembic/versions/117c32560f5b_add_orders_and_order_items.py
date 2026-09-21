"""add_orders_and_order_items

Revision ID: 117c32560f5b
Revises: 796cdfbbf93f
Create Date: 2026-07-27 16:15:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


# revision identifiers, used by Alembic.
revision: str = '117c32560f5b'
down_revision: Union[str, Sequence[str], None] = '796cdfbbf93f'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.create_table(
        'orders',
        sa.Column('id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('business_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('businesses.id', ondelete='CASCADE'), nullable=False),
        sa.Column('table_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('restaurant_tables.id', ondelete='CASCADE'), nullable=False),
        sa.Column('customer_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('customers.id', ondelete='SET NULL'), nullable=True),
        sa.Column('order_number', sa.String(length=50), nullable=False),
        sa.Column('order_source', sa.Enum('POS', 'QR', name='ordersource', native_enum=False), server_default='POS', nullable=False),
        sa.Column('status', sa.Enum('OPEN', 'PREPARING', 'READY', 'SERVED', 'CANCELLED', name='orderstatus', native_enum=False), server_default='OPEN', nullable=False),
        sa.Column('subtotal', sa.Float(), server_default='0.0', nullable=False),
        sa.Column('tax_amount', sa.Float(), server_default='0.0', nullable=False),
        sa.Column('discount_amount', sa.Float(), server_default='0.0', nullable=False),
        sa.Column('total_amount', sa.Float(), server_default='0.0', nullable=False),
        sa.Column('notes', sa.String(length=1000), nullable=True),
        sa.Column('created_by', postgresql.UUID(as_uuid=True), sa.ForeignKey('users.id', ondelete='SET NULL'), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('business_id', 'order_number', name='uq_business_order_number')
    )

    op.create_table(
        'order_items',
        sa.Column('id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('order_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('orders.id', ondelete='CASCADE'), nullable=False),
        sa.Column('item_name', sa.String(length=150), nullable=False),
        sa.Column('unit_price', sa.Float(), nullable=False),
        sa.Column('quantity', sa.Integer(), server_default='1', nullable=False),
        sa.Column('subtotal', sa.Float(), nullable=False),
        sa.Column('notes', sa.String(length=255), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.PrimaryKeyConstraint('id')
    )


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_table('order_items')
    op.drop_table('orders')
