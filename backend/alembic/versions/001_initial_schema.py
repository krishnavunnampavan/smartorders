"""Initial schema

Revision ID: 001
Revises:
Create Date: 2025-01-01 00:00:00.000000
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = '001'
down_revision = None
branch_labels = None
depends_on = None


def upgrade():
    op.execute('CREATE EXTENSION IF NOT EXISTS "pgcrypto"')

    op.create_table(
        'companies',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text('gen_random_uuid()')),
        sa.Column('name', sa.String(255), nullable=False),
        sa.Column('contact_name', sa.String(255)),
        sa.Column('email', sa.String(255)),
        sa.Column('phone', sa.String(50)),
        sa.Column('delivery_days', sa.String(100)),
        sa.Column('min_order_value', sa.Numeric(10, 2)),
        sa.Column('notes', sa.Text),
        sa.Column('is_active', sa.Boolean, server_default='true'),
        sa.Column('created_at', sa.DateTime, server_default=sa.text('NOW()')),
    )

    op.create_table(
        'products',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text('gen_random_uuid()')),
        sa.Column('name', sa.String(255), nullable=False),
        sa.Column('sku', sa.String(100)),
        sa.Column('barcode', sa.String(100)),
        sa.Column('category', sa.String(100)),
        sa.Column('subcategory', sa.String(100)),
        sa.Column('brand', sa.String(255)),
        sa.Column('unit_size', sa.String(50)),
        sa.Column('case_pack', sa.Integer, server_default='12'),
        sa.Column('company_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('companies.id')),
        sa.Column('reorder_level', sa.Integer, server_default='2'),
        sa.Column('current_stock', sa.Integer, server_default='0'),
        sa.Column('is_active', sa.Boolean, server_default='true'),
        sa.Column('aliases', postgresql.ARRAY(sa.Text), server_default='{}'),
        sa.Column('created_at', sa.DateTime, server_default=sa.text('NOW()')),
    )

    op.create_table(
        'price_history',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text('gen_random_uuid()')),
        sa.Column('product_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('products.id')),
        sa.Column('company_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('companies.id')),
        sa.Column('effective_month', sa.Date, nullable=False),
        sa.Column('unit_price', sa.Numeric(10, 2), nullable=False),
        sa.Column('case_price', sa.Numeric(10, 2)),
        sa.Column('prev_unit_price', sa.Numeric(10, 2)),
        sa.Column('price_change', sa.Numeric(10, 2)),
        sa.Column('price_change_pct', sa.Numeric(5, 2)),
        sa.Column('status', sa.String(30)),
        sa.Column('months_on_hold', sa.Integer, server_default='0'),
        sa.Column('catalog_upload_id', postgresql.UUID(as_uuid=True)),
        sa.Column('created_at', sa.DateTime, server_default=sa.text('NOW()')),
        sa.UniqueConstraint('product_id', 'effective_month', name='uq_product_month'),
    )

    op.create_table(
        'catalog_uploads',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text('gen_random_uuid()')),
        sa.Column('company_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('companies.id')),
        sa.Column('upload_month', sa.Date, nullable=False),
        sa.Column('file_name', sa.String(255)),
        sa.Column('file_type', sa.String(50)),
        sa.Column('raw_text', sa.Text),
        sa.Column('parsed_items', postgresql.JSONB),
        sa.Column('status', sa.String(30)),
        sa.Column('ai_provider', sa.String(20)),
        sa.Column('items_parsed', sa.Integer, server_default='0'),
        sa.Column('items_matched', sa.Integer, server_default='0'),
        sa.Column('created_at', sa.DateTime, server_default=sa.text('NOW()')),
    )

    op.create_table(
        'orders',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text('gen_random_uuid()')),
        sa.Column('order_month', sa.Date, nullable=False),
        sa.Column('status', sa.String(30), server_default='draft'),
        sa.Column('total_items', sa.Integer),
        sa.Column('total_value', sa.Numeric(10, 2)),
        sa.Column('savings_vs_last_month', sa.Numeric(10, 2)),
        sa.Column('held_items_count', sa.Integer),
        sa.Column('deal_items_count', sa.Integer),
        sa.Column('notes', sa.Text),
        sa.Column('created_at', sa.DateTime, server_default=sa.text('NOW()')),
        sa.Column('sent_at', sa.DateTime),
    )

    op.create_table(
        'order_items',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text('gen_random_uuid()')),
        sa.Column('order_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('orders.id')),
        sa.Column('product_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('products.id')),
        sa.Column('company_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('companies.id')),
        sa.Column('quantity', sa.Integer, nullable=False),
        sa.Column('unit_price', sa.Numeric(10, 2)),
        sa.Column('line_total', sa.Numeric(10, 2)),
        sa.Column('price_status', sa.String(30)),
        sa.Column('price_change', sa.Numeric(10, 2)),
        sa.Column('source', sa.String(30)),
        sa.Column('was_held', sa.Boolean, server_default='false'),
        sa.Column('created_at', sa.DateTime, server_default=sa.text('NOW()')),
    )

    op.create_table(
        'order_splits',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text('gen_random_uuid()')),
        sa.Column('order_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('orders.id')),
        sa.Column('company_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('companies.id')),
        sa.Column('item_count', sa.Integer),
        sa.Column('subtotal', sa.Numeric(10, 2)),
        sa.Column('status', sa.String(30), server_default='pending'),
        sa.Column('sent_at', sa.DateTime),
        sa.Column('confirmed_at', sa.DateTime),
    )

    op.create_table(
        'order_share_tokens',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text('gen_random_uuid()')),
        sa.Column('order_split_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('order_splits.id')),
        sa.Column('token', sa.String(64), unique=True, nullable=False),
        sa.Column('expires_at', sa.DateTime),
        sa.Column('viewed_at', sa.DateTime),
        sa.Column('view_count', sa.Integer, server_default='0'),
        sa.Column('is_active', sa.Boolean, server_default='true'),
        sa.Column('created_at', sa.DateTime, server_default=sa.text('NOW()')),
    )

    op.create_table(
        'app_settings',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text('gen_random_uuid()')),
        sa.Column('key', sa.String(100), unique=True, nullable=False),
        sa.Column('value', sa.Text),
        sa.Column('is_encrypted', sa.Boolean, server_default='false'),
        sa.Column('updated_at', sa.DateTime, server_default=sa.text('NOW()')),
    )

    op.create_table(
        'order_rules',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text('gen_random_uuid()')),
        sa.Column('rule_name', sa.String(100)),
        sa.Column('rule_type', sa.String(50)),
        sa.Column('threshold_value', sa.Numeric(10, 2)),
        sa.Column('action', sa.String(100)),
        sa.Column('is_active', sa.Boolean, server_default='true'),
    )

    op.create_table(
        'inventory_log',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text('gen_random_uuid()')),
        sa.Column('product_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('products.id')),
        sa.Column('previous_stock', sa.Integer),
        sa.Column('new_stock', sa.Integer),
        sa.Column('change_reason', sa.String(100)),
        sa.Column('updated_by', sa.String(100)),
        sa.Column('created_at', sa.DateTime, server_default=sa.text('NOW()')),
    )

    # Seed default order rules
    op.execute("""
        INSERT INTO order_rules (rule_name, rule_type, threshold_value, action, is_active) VALUES
        ('Deal Threshold', 'deal_threshold', -0.50, 'mark_deal', true),
        ('Hold Threshold', 'hold_threshold', 0.25, 'mark_hold', true),
        ('Deal Boost Quantity', 'deal_boost', 0.20, 'boost_qty_20pct', true),
        ('Recovery Hold Months', 'recovery_trigger', 1, 'mark_recovery_deal', true)
    """)


def downgrade():
    for table in ['inventory_log', 'order_rules', 'app_settings', 'order_share_tokens',
                  'order_splits', 'order_items', 'orders', 'catalog_uploads',
                  'price_history', 'products', 'companies']:
        op.drop_table(table)
