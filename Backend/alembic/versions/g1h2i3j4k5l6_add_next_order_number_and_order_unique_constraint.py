"""add next_order_number and order unique constraint

Revision ID: g1h2i3j4k5l6
Revises: 98f12a3b4c5d
Create Date: 2026-08-11 11:00:00.000000

"""
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = 'g1h2i3j4k5l6'
down_revision = 'a1b2c3d4e5f6'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Add next_order_number column to business_settings
    op.add_column(
        'business_settings',
        sa.Column('next_order_number', sa.Integer(), nullable=False, server_default='1')
    )

    # Create unique constraint uq_business_order_number on orders table
    try:
        op.create_unique_constraint('uq_business_order_number', 'orders', ['business_id', 'order_number'])
    except Exception:
        pass


def downgrade() -> None:
    try:
        op.drop_constraint('uq_business_order_number', 'orders', type_='unique')
    except Exception:
        pass

    op.drop_column('business_settings', 'next_order_number')
