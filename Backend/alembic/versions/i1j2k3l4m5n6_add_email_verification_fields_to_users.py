"""add email verification fields to users

Revision ID: i1j2k3l4m5n6
Revises: h1i2j3k4l5m6
Create Date: 2026-08-20 10:40:00.000000

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = 'i1j2k3l4m5n6'
down_revision = 'h1i2j3k4l5m6'
branch_labels = None
depends_on = None


def upgrade() -> None:
    try:
        op.add_column(
            'users',
            sa.Column('email_verified', sa.Boolean(), nullable=False, server_default=sa.text('false'))
        )
    except Exception:
        pass

    try:
        op.add_column(
            'users',
            sa.Column('email_verified_at', sa.DateTime(timezone=True), nullable=True)
        )
    except Exception:
        pass

    try:
        op.add_column(
            'users',
            sa.Column('verification_code_hash', sa.String(length=255), nullable=True)
        )
    except Exception:
        pass

    try:
        op.add_column(
            'users',
            sa.Column('verification_code_expires_at', sa.DateTime(timezone=True), nullable=True)
        )
    except Exception:
        pass

    try:
        op.add_column(
            'users',
            sa.Column('verification_attempts', sa.Integer(), nullable=False, server_default=sa.text('0'))
        )
    except Exception:
        pass

    try:
        op.add_column(
            'users',
            sa.Column('verification_last_sent_at', sa.DateTime(timezone=True), nullable=True)
        )
    except Exception:
        pass

    # Data migration safety: Mark existing active users and existing approved businesses as email_verified
    try:
        op.execute("""
            UPDATE users
            SET email_verified = true, email_verified_at = now()
            WHERE is_active = true
               OR status = 'ACTIVE'
               OR business_id IN (SELECT id FROM businesses WHERE status = 'ACTIVE' OR approved_at IS NOT NULL);
        """)
    except Exception:
        pass


def downgrade() -> None:
    for col in [
        'verification_last_sent_at',
        'verification_attempts',
        'verification_code_expires_at',
        'verification_code_hash',
        'email_verified_at',
        'email_verified',
    ]:
        try:
            op.drop_column('users', col)
        except Exception:
            pass
