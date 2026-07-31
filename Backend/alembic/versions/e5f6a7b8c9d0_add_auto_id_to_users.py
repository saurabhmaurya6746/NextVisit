"""add_auto_id_to_users

Revision ID: e5f6a7b8c9d0
Revises: d4e5f6a7b8c9
Create Date: 2026-07-31 17:15:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'e5f6a7b8c9d0'
down_revision: Union[str, Sequence[str], None] = 'd4e5f6a7b8c9'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        'users',
        sa.Column(
            'auto_id',
            sa.Integer(),
            sa.Identity(start=1001, increment=1),
            nullable=False,
        )
    )
    op.create_unique_constraint('uq_users_auto_id', 'users', ['auto_id'])


def downgrade() -> None:
    op.drop_constraint('uq_users_auto_id', 'users', type_='unique')
    op.drop_column('users', 'auto_id')
