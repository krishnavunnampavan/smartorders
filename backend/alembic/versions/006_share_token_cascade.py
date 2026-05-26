"""Add ON DELETE CASCADE to order_share_tokens.order_split_id FK

Revision ID: 006
Revises: 005
Create Date: 2026-05-25
"""
from alembic import op

revision = '006'
down_revision = '005'
branch_labels = None
depends_on = None


def upgrade():
    # Drop the old FK constraint and recreate with ON DELETE CASCADE
    op.drop_constraint(
        'order_share_tokens_order_split_id_fkey',
        'order_share_tokens',
        type_='foreignkey',
    )
    op.create_foreign_key(
        'order_share_tokens_order_split_id_fkey',
        'order_share_tokens',
        'order_splits',
        ['order_split_id'],
        ['id'],
        ondelete='CASCADE',
    )


def downgrade():
    op.drop_constraint(
        'order_share_tokens_order_split_id_fkey',
        'order_share_tokens',
        type_='foreignkey',
    )
    op.create_foreign_key(
        'order_share_tokens_order_split_id_fkey',
        'order_share_tokens',
        'order_splits',
        ['order_split_id'],
        ['id'],
    )
