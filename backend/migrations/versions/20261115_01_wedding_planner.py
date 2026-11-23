"""Add wedding planning and TND precision support.

Revision ID: 20261115_01
Revises:
"""
from alembic import op
from sqlalchemy import Column, Date, Numeric, String, Text, inspect

from app.core.database import Base
import app.models  # noqa: F401

revision = '20261115_01'
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    bind = op.get_bind()
    inspector = inspect(bind)
    if 'shopping_items' in inspector.get_table_names():
        columns = {column['name'] for column in inspector.get_columns('shopping_items')}
        shopping_columns = {
            'description': Column('description', Text(), nullable=True),
            'room': Column('room', String(), nullable=True),
            'confirmed_unit_price': Column('confirmed_unit_price', Numeric(15, 3), nullable=False, server_default='0'),
            'purchase_date': Column('purchase_date', Date(), nullable=True),
            'supplier': Column('supplier', String(), nullable=True),
            'warranty_info': Column('warranty_info', String(), nullable=True),
        }
        for name, column in shopping_columns.items():
            if name not in columns:
                op.add_column('shopping_items', column)

    Base.metadata.create_all(bind=bind)

    if bind.dialect.name == 'postgresql':
        money_columns = {
            'weddings': ('budget_total', 'estimated_expenses', 'amount_paid'),
            'wedding_budgets': ('planned_amount', 'actual_amount'),
            'shopping_items': ('estimated_unit_price', 'confirmed_unit_price', 'actual_unit_price', 'amount_paid'),
        }
        tables = set(inspect(bind).get_table_names())
        for table_name, columns in money_columns.items():
            if table_name not in tables:
                continue
            actual_columns = {column['name'] for column in inspect(bind).get_columns(table_name)}
            for column_name in columns:
                if column_name in actual_columns:
                    op.alter_column(
                        table_name,
                        column_name,
                        type_=Numeric(15, 3),
                        existing_type=Numeric(10, 2),
                        existing_nullable=True,
                    )


def downgrade() -> None:
    raise RuntimeError('This migration is intentionally forward-only to protect wedding data.')
