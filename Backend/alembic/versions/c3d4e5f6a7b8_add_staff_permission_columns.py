"""add_staff_permission_columns

Revision ID: c3d4e5f6a7b8
Revises: b2c3d4e5f6a7
Create Date: 2026-07-31 15:35:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = 'c3d4e5f6a7b8'
down_revision: Union[str, Sequence[str], None] = 'b2c3d4e5f6a7'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('users', sa.Column('phone', sa.String(length=50), nullable=True))
    op.add_column('users', sa.Column('designation', sa.String(length=100), nullable=True))
    op.add_column('users', sa.Column('login_id', sa.String(length=100), nullable=True))
    op.add_column('users', sa.Column('status', sa.String(length=20), server_default='ACTIVE', nullable=False))
    op.add_column('users', sa.Column('permissions', sa.JSON(), nullable=True))
    op.add_column('users', sa.Column('last_login', sa.DateTime(timezone=True), nullable=True))
    op.add_column('users', sa.Column('created_by_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('users.id'), nullable=True))


def downgrade() -> None:
    op.drop_column('users', 'created_by_id')
    op.drop_column('users', 'last_login')
    op.drop_column('users', 'permissions')
    op.drop_column('users', 'status')
    op.drop_column('users', 'login_id')
    op.drop_column('users', 'designation')
    op.drop_column('users', 'phone')
