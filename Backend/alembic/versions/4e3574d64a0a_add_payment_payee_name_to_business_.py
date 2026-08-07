"""add_payment_payee_name_to_business_settings

Revision ID: 4e3574d64a0a
Revises: f6a7b8c9d0e1
Create Date: 2026-08-07 12:42:15.730131

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '4e3574d64a0a'
down_revision: Union[str, Sequence[str], None] = 'f6a7b8c9d0e1'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('business_settings', sa.Column('payment_payee_name', sa.String(length=100), nullable=True))


def downgrade() -> None:
    op.drop_column('business_settings', 'payment_payee_name')
