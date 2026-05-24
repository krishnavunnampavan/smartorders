"""Add size/unit columns to order_items and create product_size_prices

Revision ID: 004
Revises: 003
Create Date: 2026-05-24
"""
from alembic import op
import sqlalchemy as sa

revision = '004'
down_revision = '003'
branch_labels = None
depends_on = None


def upgrade():
    op.add_column('order_items', sa.Column('selected_size', sa.String(20), nullable=True))
    op.add_column('order_items', sa.Column('selected_unit', sa.String(30), nullable=True))
    op.add_column('order_items', sa.Column('bottles_per_unit', sa.Integer(), server_default='1', nullable=True))
    op.add_column('order_items', sa.Column('total_bottles', sa.Integer(), nullable=True))

    op.create_table(
        'product_size_prices',
        sa.Column('id', sa.dialects.postgresql.UUID(as_uuid=True), primary_key=True,
                  server_default=sa.text('gen_random_uuid()')),
        sa.Column('product_id', sa.dialects.postgresql.UUID(as_uuid=True),
                  sa.ForeignKey('products.id', ondelete='CASCADE'), nullable=False),
        sa.Column('effective_month', sa.Date(), nullable=False),
        sa.Column('size_ml', sa.Integer(), nullable=False),
        sa.Column('size_label', sa.String(20), nullable=False),
        sa.Column('unit_price', sa.Numeric(10, 2), nullable=False),
        sa.Column('case_price', sa.Numeric(10, 2), nullable=True),
        sa.Column('case_pack', sa.Integer(), nullable=True),
        sa.Column('created_at', sa.DateTime(), server_default=sa.text('now()')),
    )
    op.create_index('ix_psp_product_month', 'product_size_prices', ['product_id', 'effective_month'])


def downgrade():
    op.drop_index('ix_psp_product_month', table_name='product_size_prices')
    op.drop_table('product_size_prices')
    op.drop_column('order_items', 'total_bottles')
    op.drop_column('order_items', 'bottles_per_unit')
    op.drop_column('order_items', 'selected_unit')
    op.drop_column('order_items', 'selected_size')
