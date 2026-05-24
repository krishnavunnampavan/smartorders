"""Add active_cart, cart_items, cart_activity_log for real-time persistent cart

Revision ID: 005
Revises: 004
Create Date: 2026-05-24
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = '005'
down_revision = '004'
branch_labels = None
depends_on = None


def upgrade():
    # ── active_cart ───────────────────────────────────────────────────────
    op.create_table(
        'active_cart',
        sa.Column('id',            postgresql.UUID(as_uuid=True), primary_key=True,
                  server_default=sa.text('gen_random_uuid()')),
        sa.Column('order_number',  sa.String(50), nullable=True),
        sa.Column('order_month',   sa.Date(), server_default=sa.text("DATE_TRUNC('month', NOW())")),
        sa.Column('status',        sa.String(30), server_default='active'),
        sa.Column('notes',         sa.Text(), nullable=True),
        sa.Column('created_at',    sa.DateTime(), server_default=sa.text('NOW()')),
        sa.Column('updated_at',    sa.DateTime(), server_default=sa.text('NOW()')),
        sa.Column('submitted_at',  sa.DateTime(), nullable=True),
        sa.Column('submitted_by',  sa.String(100), nullable=True),
    )
    # Only one active cart at a time
    op.create_index(
        'idx_active_cart_status_active',
        'active_cart', ['status'],
        unique=True,
        postgresql_where=sa.text("status = 'active'"),
    )

    # ── cart_items ────────────────────────────────────────────────────────
    op.create_table(
        'cart_items',
        sa.Column('id',               postgresql.UUID(as_uuid=True), primary_key=True,
                  server_default=sa.text('gen_random_uuid()')),
        sa.Column('cart_id',          postgresql.UUID(as_uuid=True),
                  sa.ForeignKey('active_cart.id', ondelete='CASCADE'), nullable=False),
        sa.Column('product_id',       postgresql.UUID(as_uuid=True),
                  sa.ForeignKey('products.id', ondelete='SET NULL'), nullable=True),
        sa.Column('product_name',     sa.String(255), nullable=False),
        sa.Column('category',         sa.String(100), nullable=True),
        sa.Column('company_id',       postgresql.UUID(as_uuid=True),
                  sa.ForeignKey('companies.id', ondelete='SET NULL'), nullable=True),
        sa.Column('company_name',     sa.String(255), nullable=True),
        sa.Column('selected_size',    sa.String(20), server_default='750ml'),
        sa.Column('selected_unit',    sa.String(30), server_default='Case'),
        sa.Column('bottles_per_unit', sa.Integer(), server_default='12'),
        sa.Column('quantity',         sa.Integer(), nullable=False, server_default='1'),
        sa.Column('total_bottles',    sa.Integer(), server_default='12'),
        sa.Column('unit_price',       sa.Numeric(10, 2), server_default='0'),
        sa.Column('case_price',       sa.Numeric(10, 2), server_default='0'),
        sa.Column('effective_price',  sa.Numeric(10, 2), server_default='0'),
        sa.Column('line_total',       sa.Numeric(10, 2), server_default='0'),
        sa.Column('price_status',     sa.String(30), server_default='STABLE'),
        sa.Column('price_change',     sa.Numeric(10, 2), server_default='0'),
        sa.Column('source',           sa.String(30), server_default='manual'),
        sa.Column('added_by',         sa.String(100), server_default='manager'),
        sa.Column('added_at',         sa.DateTime(), server_default=sa.text('NOW()')),
        sa.Column('updated_at',       sa.DateTime(), server_default=sa.text('NOW()')),
    )
    op.create_index('idx_cart_items_cart_id',  'cart_items', ['cart_id'])
    op.create_index('idx_cart_items_product',  'cart_items', ['product_id'])
    op.create_index('idx_cart_items_company',  'cart_items', ['company_id'])

    # ── cart_activity_log ─────────────────────────────────────────────────
    op.create_table(
        'cart_activity_log',
        sa.Column('id',           postgresql.UUID(as_uuid=True), primary_key=True,
                  server_default=sa.text('gen_random_uuid()')),
        sa.Column('cart_id',      postgresql.UUID(as_uuid=True),
                  sa.ForeignKey('active_cart.id', ondelete='CASCADE'), nullable=True),
        sa.Column('action',       sa.String(50)),
        sa.Column('product_id',   postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column('product_name', sa.String(255), nullable=True),
        sa.Column('old_qty',      sa.Integer(), nullable=True),
        sa.Column('new_qty',      sa.Integer(), nullable=True),
        sa.Column('old_size',     sa.String(20), nullable=True),
        sa.Column('new_size',     sa.String(20), nullable=True),
        sa.Column('done_by',      sa.String(100), server_default='manager'),
        sa.Column('done_at',      sa.DateTime(), server_default=sa.text('NOW()')),
    )
    op.create_index('idx_cart_log_cart_id', 'cart_activity_log', ['cart_id'])
    op.create_index('idx_cart_log_done_at', 'cart_activity_log', ['done_at'])

    # ── Seed one active cart ──────────────────────────────────────────────
    op.execute(sa.text("""
        INSERT INTO active_cart (order_number, order_month, status)
        VALUES (
            'ORD-' || TO_CHAR(NOW(), 'YYYY-MM') || '-001',
            DATE_TRUNC('month', NOW()),
            'active'
        )
        ON CONFLICT DO NOTHING
    """))


def downgrade():
    op.drop_table('cart_activity_log')
    op.drop_table('cart_items')
    op.drop_table('active_cart')
