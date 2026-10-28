"""add_client_devices_and_sync_transactions

Revision ID: j1k2l3m4n5o6
Revises: e9d7a4459c47
Create Date: 2026-10-16 20:20:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


# revision identifiers, used by Alembic.
revision: str = 'j1k2l3m4n5o6'
down_revision: Union[str, Sequence[str], None] = 'e9d7a4459c47'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    conn = op.get_bind()
    insp = sa.inspect(conn)
    tables = insp.get_table_names()

    # 1. Create client_devices table
    if 'client_devices' not in tables:
        op.create_table(
            'client_devices',
            sa.Column('id', sa.UUID(), nullable=False),
            sa.Column('business_id', sa.UUID(), nullable=False),
            sa.Column('device_name', sa.String(length=100), nullable=False),
            sa.Column('device_type', sa.String(length=50), nullable=False, server_default='DESKTOP_WINDOWS'),
            sa.Column('device_prefix', sa.String(length=10), nullable=False),
            sa.Column('device_identifier', sa.String(length=100), nullable=True),
            sa.Column('is_active', sa.Boolean(), nullable=False, server_default='true'),
            sa.Column('last_sync_at', sa.DateTime(timezone=True), nullable=True),
            sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
            sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
            sa.ForeignKeyConstraint(['business_id'], ['businesses.id'], ondelete='CASCADE'),
            sa.PrimaryKeyConstraint('id'),
            sa.UniqueConstraint('business_id', 'device_prefix', name='uq_client_devices_biz_prefix')
        )
        op.create_index(op.f('ix_client_devices_business_id'), 'client_devices', ['business_id'], unique=False)

    # 2. Create sync_transactions table
    if 'sync_transactions' not in tables:
        op.create_table(
            'sync_transactions',
            sa.Column('id', sa.UUID(), nullable=False),
            sa.Column('business_id', sa.UUID(), nullable=False),
            sa.Column('device_id', sa.UUID(), nullable=True),
            sa.Column('client_tx_id', sa.UUID(), nullable=False),
            sa.Column('operation_type', sa.String(length=50), nullable=False),
            sa.Column('payload_hash', sa.String(length=64), nullable=False),
            sa.Column('status', sa.String(length=20), nullable=False, server_default='COMMITTED'),
            sa.Column('status_code', sa.Integer(), nullable=False, server_default='200'),
            sa.Column('response_payload', postgresql.JSONB(astext_type=sa.Text()), nullable=True),
            sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
            sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
            sa.ForeignKeyConstraint(['business_id'], ['businesses.id'], ondelete='CASCADE'),
            sa.ForeignKeyConstraint(['device_id'], ['client_devices.id'], ondelete='SET NULL'),
            sa.PrimaryKeyConstraint('id'),
            sa.UniqueConstraint('business_id', 'client_tx_id', name='uq_sync_tx_biz_client_tx')
        )
        op.create_index(op.f('ix_sync_transactions_business_id'), 'sync_transactions', ['business_id'], unique=False)
        op.create_index(op.f('ix_sync_transactions_device_id'), 'sync_transactions', ['device_id'], unique=False)
        op.create_index(op.f('ix_sync_transactions_client_tx_id'), 'sync_transactions', ['client_tx_id'], unique=False)

    # 3. Add device_id and client_order_id to orders table
    order_cols = [c['name'] for c in insp.get_columns('orders')]
    if 'device_id' not in order_cols:
        op.add_column(
            'orders',
            sa.Column('device_id', sa.UUID(), nullable=True)
        )
        op.create_foreign_key(
            'fk_orders_device_id',
            'orders',
            'client_devices',
            ['device_id'],
            ['id'],
            ondelete='SET NULL'
        )
        op.create_index(op.f('ix_orders_device_id'), 'orders', ['device_id'], unique=False)

    if 'client_order_id' not in order_cols:
        op.add_column(
            'orders',
            sa.Column('client_order_id', sa.UUID(), nullable=True)
        )
        op.create_index(op.f('ix_orders_client_order_id'), 'orders', ['client_order_id'], unique=False)


def downgrade() -> None:
    conn = op.get_bind()
    insp = sa.inspect(conn)
    tables = insp.get_table_names()

    # 1. Drop orders columns
    if 'orders' in tables:
        order_cols = [c['name'] for c in insp.get_columns('orders')]
        if 'client_order_id' in order_cols:
            op.drop_index(op.f('ix_orders_client_order_id'), table_name='orders')
            op.drop_column('orders', 'client_order_id')
        if 'device_id' in order_cols:
            op.drop_constraint('fk_orders_device_id', 'orders', type_='foreignkey')
            op.drop_index(op.f('ix_orders_device_id'), table_name='orders')
            op.drop_column('orders', 'device_id')

    # 2. Drop sync_transactions table
    if 'sync_transactions' in tables:
        op.drop_index(op.f('ix_sync_transactions_client_tx_id'), table_name='sync_transactions')
        op.drop_index(op.f('ix_sync_transactions_device_id'), table_name='sync_transactions')
        op.drop_index(op.f('ix_sync_transactions_business_id'), table_name='sync_transactions')
        op.drop_table('sync_transactions')

    # 3. Drop client_devices table
    if 'client_devices' in tables:
        op.drop_index(op.f('ix_client_devices_business_id'), table_name='client_devices')
        op.drop_table('client_devices')
