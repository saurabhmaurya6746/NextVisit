"""add_visit_token_to_orders

Revision ID: ae8170d84ae6
Revises: 0b1fe2e97458
Create Date: 2026-07-29 10:41:23.299549

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'ae8170d84ae6'
down_revision: Union[str, Sequence[str], None] = '0b1fe2e97458'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    conn = op.get_bind()
    insp = sa.inspect(conn)
    cols = [c['name'] for c in insp.get_columns('orders')]
    if 'visit_token' not in cols:
        op.add_column('orders', sa.Column('visit_token', sa.String(length=100), nullable=True))
    indexes = [idx['name'] for idx in insp.get_indexes('orders')]
    if 'ix_orders_visit_token' not in indexes:
        op.create_index(op.f('ix_orders_visit_token'), 'orders', ['visit_token'], unique=False)


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_index(op.f('ix_orders_visit_token'), table_name='orders')
    op.drop_column('orders', 'visit_token')
