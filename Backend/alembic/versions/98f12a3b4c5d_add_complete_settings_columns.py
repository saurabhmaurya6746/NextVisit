"""add_complete_settings_columns

Revision ID: 98f12a3b4c5d
Revises: 72d286494845
Create Date: 2026-07-31 14:05:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '98f12a3b4c5d'
down_revision: Union[str, Sequence[str], None] = '72d286494845'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # 1. Add columns to business_settings table
    op.add_column('business_settings', sa.Column('website', sa.String(length=255), nullable=True))
    op.add_column('business_settings', sa.Column('whatsapp_number', sa.String(length=20), nullable=True))
    op.add_column('business_settings', sa.Column('default_country_code', sa.String(length=10), server_default='+91', nullable=False))
    op.add_column('business_settings', sa.Column('default_message_signature', sa.String(length=255), nullable=True))
    op.add_column('business_settings', sa.Column('enable_whatsapp_campaigns', sa.Boolean(), server_default='true', nullable=False))
    op.add_column('business_settings', sa.Column('enable_welcome_messages', sa.Boolean(), server_default='true', nullable=False))
    op.add_column('business_settings', sa.Column('maps_link', sa.String(length=500), nullable=True))
    op.add_column('business_settings', sa.Column('invoice_footer', sa.String(length=255), nullable=True))
    op.add_column('business_settings', sa.Column('show_gst_on_invoice', sa.Boolean(), server_default='true', nullable=False))
    op.add_column('business_settings', sa.Column('show_qr_on_invoice', sa.Boolean(), server_default='true', nullable=False))
    op.add_column('business_settings', sa.Column('auto_print_invoice', sa.Boolean(), server_default='false', nullable=False))
    op.add_column('business_settings', sa.Column('round_off_bill', sa.Boolean(), server_default='true', nullable=False))
    op.add_column('business_settings', sa.Column('notify_orders', sa.Boolean(), server_default='true', nullable=False))
    op.add_column('business_settings', sa.Column('notify_qr_orders', sa.Boolean(), server_default='true', nullable=False))
    op.add_column('business_settings', sa.Column('notify_campaigns', sa.Boolean(), server_default='true', nullable=False))
    op.add_column('business_settings', sa.Column('notify_reviews', sa.Boolean(), server_default='true', nullable=False))
    op.add_column('business_settings', sa.Column('notify_email', sa.Boolean(), server_default='true', nullable=False))
    op.add_column('business_settings', sa.Column('ai_default_tone', sa.String(length=50), server_default='Friendly', nullable=False))
    op.add_column('business_settings', sa.Column('ai_max_monthly_requests', sa.Integer(), server_default='500', nullable=False))
    op.add_column('business_settings', sa.Column('enable_dine_in', sa.Boolean(), server_default='true', nullable=False))
    op.add_column('business_settings', sa.Column('pos_auto_complete_order', sa.Boolean(), server_default='false', nullable=False))
    op.add_column('business_settings', sa.Column('pos_auto_free_table', sa.Boolean(), server_default='true', nullable=False))
    op.add_column('business_settings', sa.Column('pos_default_payment_method', sa.String(length=20), server_default='CASH', nullable=False))

    # 2. Add two_factor_enabled column to users table
    op.add_column('users', sa.Column('two_factor_enabled', sa.Boolean(), server_default='false', nullable=False))


def downgrade() -> None:
    op.drop_column('users', 'two_factor_enabled')
    op.drop_column('business_settings', 'pos_default_payment_method')
    op.drop_column('business_settings', 'pos_auto_free_table')
    op.drop_column('business_settings', 'pos_auto_complete_order')
    op.drop_column('business_settings', 'enable_dine_in')
    op.drop_column('business_settings', 'ai_max_monthly_requests')
    op.drop_column('business_settings', 'ai_default_tone')
    op.drop_column('business_settings', 'notify_email')
    op.drop_column('business_settings', 'notify_reviews')
    op.drop_column('business_settings', 'notify_campaigns')
    op.drop_column('business_settings', 'notify_qr_orders')
    op.drop_column('business_settings', 'notify_orders')
    op.drop_column('business_settings', 'round_off_bill')
    op.drop_column('business_settings', 'auto_print_invoice')
    op.drop_column('business_settings', 'show_qr_on_invoice')
    op.drop_column('business_settings', 'show_gst_on_invoice')
    op.drop_column('business_settings', 'invoice_footer')
    op.drop_column('business_settings', 'maps_link')
    op.drop_column('business_settings', 'enable_welcome_messages')
    op.drop_column('business_settings', 'enable_whatsapp_campaigns')
    op.drop_column('business_settings', 'default_message_signature')
    op.drop_column('business_settings', 'default_country_code')
    op.drop_column('business_settings', 'whatsapp_number')
    op.drop_column('business_settings', 'website')
