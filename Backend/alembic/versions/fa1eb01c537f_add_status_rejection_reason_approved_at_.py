"""add_status_rejection_reason_approved_at_to_businesses

Revision ID: fa1eb01c537f
Revises: 7cc6d4823ec2
Create Date: 2026-07-26 20:39:28.217905

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


# revision identifiers, used by Alembic.
revision: str = 'fa1eb01c537f'
down_revision: Union[str, Sequence[str], None] = '7cc6d4823ec2'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.create_table(
        'admins',
        sa.Column('id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('name', sa.String(length=150), nullable=False),
        sa.Column('email', sa.String(length=150), nullable=False),
        sa.Column('hashed_password', sa.String(length=255), nullable=False),
        sa.Column('role', sa.String(length=50), server_default='SUPER_ADMIN', nullable=False),
        sa.Column('is_active', sa.Boolean(), server_default=sa.true(), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('email')
    )
    op.add_column('businesses', sa.Column('status', sa.String(length=30), server_default='PENDING', nullable=False))
    op.add_column('businesses', sa.Column('rejection_reason', sa.String(length=500), nullable=True))
    op.add_column('businesses', sa.Column('approved_at', sa.DateTime(timezone=True), nullable=True))


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_column('businesses', 'approved_at')
    op.drop_column('businesses', 'rejection_reason')
    op.drop_column('businesses', 'status')
    op.drop_table('admins')
