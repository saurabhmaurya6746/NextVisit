"""add allow_guest_checkout to business_settings

Revision ID: h1i2j3k4l5m6
Revises: g1h2i3j4k5l6
Create Date: 2026-08-14 15:55:00.000000

"""
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = 'h1i2j3k4l5m6'
down_revision = 'g1h2i3j4k5l6'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Add allow_guest_checkout column to business_settings
    try:
        op.add_column(
            'business_settings',
            sa.Column('allow_guest_checkout', sa.Boolean(), nullable=False, server_default=sa.text('true'))
        )
    except Exception:
        pass


def downgrade() -> None:
    try:
        op.drop_column('business_settings', 'allow_guest_checkout')
    except Exception:
        pass
