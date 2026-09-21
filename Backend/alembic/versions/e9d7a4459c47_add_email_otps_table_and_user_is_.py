"""add_email_otps_table_and_user_is_verified

Revision ID: e9d7a4459c47
Revises: 0b1fe2e97458
Create Date: 2026-09-19 13:04:58.098706

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'e9d7a4459c47'
down_revision: Union[str, Sequence[str], None] = '0b1fe2e97458'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # 1. Create email_otps table
    op.create_table(
        'email_otps',
        sa.Column('id', sa.UUID(), nullable=False),
        sa.Column('email', sa.String(length=150), nullable=False),
        sa.Column('hashed_otp', sa.String(length=255), nullable=False),
        sa.Column('expires_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('attempts', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('is_used', sa.Boolean(), nullable=False, server_default='false'),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_email_otps_email'), 'email_otps', ['email'], unique=False)

    # 2. Add is_verified column to users table
    op.add_column(
        'users',
        sa.Column('is_verified', sa.Boolean(), nullable=False, server_default='false')
    )


def downgrade() -> None:
    op.drop_column('users', 'is_verified')
    op.drop_index(op.f('ix_email_otps_email'), table_name='email_otps')
    op.drop_table('email_otps')
