"""add support_phone to platform_settings

Revision ID: a1b2c3d4e5f6
Revises: 4e3574d64a0a
Create Date: 2026-08-07 14:10:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'a1b2c3d4e5f6'
down_revision: Union[str, None] = '4e3574d64a0a'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('platform_settings', sa.Column('support_phone', sa.String(length=50), nullable=True))


def downgrade() -> None:
    op.drop_column('platform_settings', 'support_phone')
