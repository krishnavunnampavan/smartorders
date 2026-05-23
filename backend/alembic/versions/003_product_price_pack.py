"""Add unit_price, case_price, pack to products

Revision ID: 003
Revises: 002
Create Date: 2026-05-23
"""
from alembic import op
import sqlalchemy as sa

revision = '003'
down_revision = '002'
branch_labels = None
depends_on = None


def upgrade():
    op.add_column('products', sa.Column('unit_price', sa.Numeric(10, 2), server_default='0'))
    op.add_column('products', sa.Column('case_price', sa.Numeric(10, 2)))
    op.add_column('products', sa.Column('pack', sa.String(50)))


def downgrade():
    op.drop_column('products', 'pack')
    op.drop_column('products', 'case_price')
    op.drop_column('products', 'unit_price')
