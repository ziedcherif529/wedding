from sqlalchemy import Boolean, Column, Date, DateTime, ForeignKey, Integer, JSON, Numeric, String, Text, UniqueConstraint, func

from app.core.database import Base


MONEY = Numeric(15, 3)


class WeddingPreference(Base):
    __tablename__ = 'wedding_preferences'

    id = Column(String, primary_key=True, index=True)
    wedding_id = Column(String, ForeignKey('weddings.id', ondelete='CASCADE'), unique=True, nullable=False)
    partner_one_name = Column(String, nullable=True)
    partner_two_name = Column(String, nullable=True)
    engagement_date = Column(Date, nullable=True)
    city = Column(String, nullable=True)
    governorate = Column(String, nullable=True)
    venue = Column(String, nullable=True)
    expected_guest_count = Column(Integer, nullable=True)
    preferred_language = Column(String, default='fr', nullable=False)
    wedding_styles = Column(JSON, default=list, nullable=False)
    custom_style = Column(Text, nullable=True)
    region = Column(String, nullable=True)
    current_savings = Column(MONEY, default=0, nullable=False)
    partner_one_monthly_savings = Column(MONEY, default=0, nullable=False)
    partner_two_monthly_savings = Column(MONEY, default=0, nullable=False)
    family_contributions = Column(MONEY, default=0, nullable=False)
    other_expected_income = Column(MONEY, default=0, nullable=False)
    gifts_mode = Column(String, default='excluded', nullable=False)
    include_home_preparation = Column(Boolean, default=False, nullable=False)
    home_categories = Column(JSON, default=list, nullable=False)
    onboarding_completed = Column(Boolean, default=False, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)


class WeddingEvent(Base):
    __tablename__ = 'wedding_events'

    id = Column(String, primary_key=True, index=True)
    wedding_id = Column(String, ForeignKey('weddings.id', ondelete='CASCADE'), nullable=False, index=True)
    name = Column(String, nullable=False)
    event_type = Column(String, default='custom', nullable=False)
    event_date = Column(Date, nullable=True)
    location = Column(String, nullable=True)
    guest_count = Column(Integer, nullable=True)
    estimated_budget = Column(MONEY, default=0, nullable=False)
    actual_budget = Column(MONEY, default=0, nullable=False)
    notes = Column(Text, nullable=True)
    position = Column(Integer, default=0, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)


class WeddingBudgetCategory(Base):
    __tablename__ = 'wedding_budget_categories'

    id = Column(String, primary_key=True, index=True)
    wedding_id = Column(String, ForeignKey('weddings.id', ondelete='CASCADE'), nullable=False, index=True)
    event_id = Column(String, ForeignKey('wedding_events.id', ondelete='SET NULL'), nullable=True, index=True)
    name = Column(String, nullable=False)
    parent_category = Column(String, nullable=True)
    enabled = Column(Boolean, default=True, nullable=False)
    planned_budget = Column(MONEY, default=0, nullable=False)
    estimated_cost = Column(MONEY, default=0, nullable=False)
    confirmed_price = Column(MONEY, default=0, nullable=False)
    actual_cost = Column(MONEY, default=0, nullable=False)
    reserved_amount = Column(MONEY, default=0, nullable=False)
    notes = Column(Text, nullable=True)
    created_by = Column(String, ForeignKey('users.id', ondelete='SET NULL'), nullable=True)
    updated_by = Column(String, ForeignKey('users.id', ondelete='SET NULL'), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)


class Provider(Base):
    __tablename__ = 'providers'

    id = Column(String, primary_key=True, index=True)
    wedding_id = Column(String, ForeignKey('weddings.id', ondelete='CASCADE'), nullable=False, index=True)
    name = Column(String, nullable=False)
    service_category = Column(String, nullable=False)
    phone = Column(String, nullable=True)
    email = Column(String, nullable=True)
    address = Column(Text, nullable=True)
    governorate = Column(String, nullable=True)
    agreed_price = Column(MONEY, default=0, nullable=False)
    deposit = Column(MONEY, default=0, nullable=False)
    booking_date = Column(Date, nullable=True)
    service_date = Column(Date, nullable=True)
    contract_status = Column(String, default='considering', nullable=False)
    notes = Column(Text, nullable=True)
    created_by = Column(String, ForeignKey('users.id', ondelete='SET NULL'), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)


class ProviderQuote(Base):
    __tablename__ = 'provider_quotes'

    id = Column(String, primary_key=True, index=True)
    wedding_id = Column(String, ForeignKey('weddings.id', ondelete='CASCADE'), nullable=False, index=True)
    provider_id = Column(String, ForeignKey('providers.id', ondelete='CASCADE'), nullable=False, index=True)
    quoted_price = Column(MONEY, nullable=False)
    quote_date = Column(Date, nullable=True)
    notes = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)


class ProviderContract(Base):
    __tablename__ = 'provider_contracts'

    id = Column(String, primary_key=True, index=True)
    wedding_id = Column(String, ForeignKey('weddings.id', ondelete='CASCADE'), nullable=False, index=True)
    provider_id = Column(String, ForeignKey('providers.id', ondelete='CASCADE'), unique=True, nullable=False, index=True)
    agreed_price = Column(MONEY, nullable=False)
    deposit = Column(MONEY, default=0, nullable=False)
    signed_date = Column(Date, nullable=True)
    status = Column(String, default='draft', nullable=False)
    notes = Column(Text, nullable=True)


class WeddingPayment(Base):
    __tablename__ = 'wedding_payments'

    id = Column(String, primary_key=True, index=True)
    wedding_id = Column(String, ForeignKey('weddings.id', ondelete='CASCADE'), nullable=False, index=True)
    event_id = Column(String, ForeignKey('wedding_events.id', ondelete='SET NULL'), nullable=True, index=True)
    budget_category_id = Column(String, ForeignKey('wedding_budget_categories.id', ondelete='SET NULL'), nullable=True, index=True)
    provider_id = Column(String, ForeignKey('providers.id', ondelete='SET NULL'), nullable=True, index=True)
    shopping_item_id = Column(String, ForeignKey('shopping_items.id', ondelete='SET NULL'), nullable=True, index=True)
    description = Column(String, nullable=False)
    amount_due = Column(MONEY, nullable=False)
    amount_paid = Column(MONEY, default=0, nullable=False)
    transaction_type = Column(String, default='payment', nullable=False)
    due_date = Column(Date, nullable=True, index=True)
    payment_date = Column(Date, nullable=True)
    payment_method = Column(String, nullable=True)
    status = Column(String, default='upcoming', nullable=False, index=True)
    notes = Column(Text, nullable=True)
    created_by = Column(String, ForeignKey('users.id', ondelete='SET NULL'), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)


class WeddingTask(Base):
    __tablename__ = 'wedding_tasks'

    id = Column(String, primary_key=True, index=True)
    wedding_id = Column(String, ForeignKey('weddings.id', ondelete='CASCADE'), nullable=False, index=True)
    event_id = Column(String, ForeignKey('wedding_events.id', ondelete='SET NULL'), nullable=True, index=True)
    title = Column(String, nullable=False)
    description = Column(Text, nullable=True)
    due_date = Column(Date, nullable=True, index=True)
    priority = Column(String, default='medium', nullable=False)
    status = Column(String, default='pending', nullable=False, index=True)
    suggested = Column(Boolean, default=False, nullable=False)
    created_by = Column(String, ForeignKey('users.id', ondelete='SET NULL'), nullable=True)
    updated_by = Column(String, ForeignKey('users.id', ondelete='SET NULL'), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)


class WeddingSavingsPlan(Base):
    __tablename__ = 'wedding_savings_plans'

    id = Column(String, primary_key=True, index=True)
    wedding_id = Column(String, ForeignKey('weddings.id', ondelete='CASCADE'), unique=True, nullable=False)
    current_savings = Column(MONEY, default=0, nullable=False)
    monthly_partner_one = Column(MONEY, default=0, nullable=False)
    monthly_partner_two = Column(MONEY, default=0, nullable=False)
    expected_family_contributions = Column(MONEY, default=0, nullable=False)
    expected_other_income = Column(MONEY, default=0, nullable=False)
    include_gifts = Column(Boolean, default=False, nullable=False)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)


class WeddingContribution(Base):
    __tablename__ = 'wedding_contributions'

    id = Column(String, primary_key=True, index=True)
    wedding_id = Column(String, ForeignKey('weddings.id', ondelete='CASCADE'), nullable=False, index=True)
    source = Column(String, nullable=False)
    amount = Column(MONEY, nullable=False)
    confirmed = Column(Boolean, default=False, nullable=False)
    expected_date = Column(Date, nullable=True)
    notes = Column(Text, nullable=True)
    created_by = Column(String, ForeignKey('users.id', ondelete='SET NULL'), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)


class GuestTable(Base):
    __tablename__ = 'guest_tables'

    id = Column(String, primary_key=True, index=True)
    wedding_id = Column(String, ForeignKey('weddings.id', ondelete='CASCADE'), nullable=False, index=True)
    name = Column(String, nullable=False)
    capacity = Column(Integer, nullable=True)
    notes = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)


class WeddingGuest(Base):
    __tablename__ = 'wedding_guests'

    id = Column(String, primary_key=True, index=True)
    wedding_id = Column(String, ForeignKey('weddings.id', ondelete='CASCADE'), nullable=False, index=True)
    table_id = Column(String, ForeignKey('guest_tables.id', ondelete='SET NULL'), nullable=True, index=True)
    name = Column(String, nullable=False)
    relationship = Column(String, default='friend', nullable=False)
    partner_association = Column(String, nullable=True)
    phone = Column(String, nullable=True)
    accompanying_guests = Column(Integer, default=0, nullable=False)
    invitation_status = Column(String, default='pending', nullable=False)
    attendance_status = Column(String, default='pending', nullable=False)
    notes = Column(Text, nullable=True)
    created_by = Column(String, ForeignKey('users.id', ondelete='SET NULL'), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)


class WorkspaceMember(Base):
    __tablename__ = 'workspace_members'
    __table_args__ = (UniqueConstraint('workspace_id', 'user_id', name='uq_workspace_member'),)

    id = Column(String, primary_key=True, index=True)
    workspace_id = Column(String, ForeignKey('workspaces.id', ondelete='CASCADE'), nullable=False, index=True)
    user_id = Column(String, ForeignKey('users.id', ondelete='CASCADE'), nullable=False, index=True)
    role = Column(String, default='EDITOR', nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)


class ActivityLog(Base):
    __tablename__ = 'activity_logs'

    id = Column(String, primary_key=True, index=True)
    wedding_id = Column(String, ForeignKey('weddings.id', ondelete='CASCADE'), nullable=False, index=True)
    actor_user_id = Column(String, ForeignKey('users.id', ondelete='SET NULL'), nullable=True)
    action = Column(String, nullable=False)
    entity_type = Column(String, nullable=False)
    entity_id = Column(String, nullable=True)
    summary = Column(Text, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False, index=True)
