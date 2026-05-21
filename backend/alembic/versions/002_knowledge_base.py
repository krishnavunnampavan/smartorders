"""Add self-learning knowledge base tables

Revision ID: 002
Revises: 001
Create Date: 2025-01-02 00:00:00.000000
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = '002'
down_revision = '001'
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        'knowledge_base',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True,
                  server_default=sa.text('gen_random_uuid()')),
        sa.Column('category', sa.String(100), nullable=False),
        sa.Column('key', sa.String(255), nullable=False),
        sa.Column('value', sa.Text),
        sa.Column('meta', postgresql.JSONB),
        sa.Column('confidence', sa.Float, server_default='1.0'),
        sa.Column('source', sa.String(50)),
        sa.Column('use_count', sa.Integer, server_default='0'),
        sa.Column('last_used_at', sa.DateTime),
        sa.Column('is_active', sa.Boolean, server_default='true'),
        sa.Column('created_at', sa.DateTime, server_default=sa.text('NOW()')),
        sa.Column('updated_at', sa.DateTime, server_default=sa.text('NOW()')),
    )
    op.create_index('ix_kb_category_key', 'knowledge_base', ['category', 'key'])

    op.create_table(
        'ai_parse_log',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True,
                  server_default=sa.text('gen_random_uuid()')),
        sa.Column('input_type', sa.String(30)),
        sa.Column('raw_input', sa.Text),
        sa.Column('ai_provider', sa.String(20)),
        sa.Column('ai_model', sa.String(50)),
        sa.Column('parsed_output', postgresql.JSONB),
        sa.Column('resolved_items', postgresql.JSONB),
        sa.Column('unmatched_items', postgresql.JSONB),
        sa.Column('user_corrections', postgresql.JSONB),
        sa.Column('accepted_count', sa.Integer, server_default='0'),
        sa.Column('rejected_count', sa.Integer, server_default='0'),
        sa.Column('session_id', sa.String(64)),
        sa.Column('created_at', sa.DateTime, server_default=sa.text('NOW()')),
    )

    op.create_table(
        'user_feedback',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True,
                  server_default=sa.text('gen_random_uuid()')),
        sa.Column('parse_log_id', postgresql.UUID(as_uuid=True),
                  sa.ForeignKey('ai_parse_log.id'), nullable=True),
        sa.Column('original_text', sa.Text),
        sa.Column('ai_guess', sa.String(255)),
        sa.Column('correct_product_id', postgresql.UUID(as_uuid=True),
                  sa.ForeignKey('products.id'), nullable=True),
        sa.Column('correct_product_name', sa.String(255)),
        sa.Column('feedback_type', sa.String(30)),
        sa.Column('applied', sa.Boolean, server_default='false'),
        sa.Column('created_at', sa.DateTime, server_default=sa.text('NOW()')),
    )


def downgrade():
    op.drop_table('user_feedback')
    op.drop_table('ai_parse_log')
    op.drop_index('ix_kb_category_key', table_name='knowledge_base')
    op.drop_table('knowledge_base')
