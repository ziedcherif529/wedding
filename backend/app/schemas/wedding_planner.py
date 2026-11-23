from datetime import date
from decimal import Decimal
from typing import Literal

from pydantic import BaseModel, Field


Money = Decimal


class EventInput(BaseModel):
    name: str = Field(min_length=1, max_length=120)
    event_type: str = Field(default='custom', max_length=60)
    event_date: date | None = None
    location: str | None = Field(default=None, max_length=255)
    guest_count: int | None = Field(default=None, ge=0)
    estimated_budget: Money = Field(default=Decimal('0'), ge=0, max_digits=15, decimal_places=3)
    actual_budget: Money = Field(default=Decimal('0'), ge=0, max_digits=15, decimal_places=3)
    notes: str | None = None


class OnboardingRequest(BaseModel):
    project_name: str = Field(min_length=1, max_length=160)
    partner_one_name: str | None = Field(default=None, max_length=120)
    partner_two_name: str | None = Field(default=None, max_length=120)
    wedding_date: date | None = None
    engagement_date: date | None = None
    city: str | None = Field(default=None, max_length=120)
    governorate: str | None = Field(default=None, max_length=120)
    venue: str | None = Field(default=None, max_length=255)
    expected_guest_count: int | None = Field(default=None, ge=0)
    preferred_language: Literal['fr', 'ar', 'en'] = 'fr'
    wedding_styles: list[str] = Field(default_factory=list, max_length=8)
    custom_style: str | None = None
    region: str | None = Field(default=None, max_length=80)
    events: list[EventInput] = Field(default_factory=list, max_length=30)
    total_budget: Money = Field(default=Decimal('0'), ge=0, max_digits=15, decimal_places=3)
    current_savings: Money = Field(default=Decimal('0'), ge=0, max_digits=15, decimal_places=3)
    partner_one_monthly_savings: Money = Field(default=Decimal('0'), ge=0, max_digits=15, decimal_places=3)
    partner_two_monthly_savings: Money = Field(default=Decimal('0'), ge=0, max_digits=15, decimal_places=3)
    family_contributions: Money = Field(default=Decimal('0'), ge=0, max_digits=15, decimal_places=3)
    other_expected_income: Money = Field(default=Decimal('0'), ge=0, max_digits=15, decimal_places=3)
    gifts_mode: Literal['excluded', 'tracked', 'forecast'] = 'excluded'
    include_home_preparation: bool = False
    home_categories: list[str] = Field(default_factory=list, max_length=40)
    custom_categories: list[str] = Field(default_factory=list, max_length=100)


class EventUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=120)
    event_type: str | None = Field(default=None, max_length=60)
    event_date: date | None = None
    location: str | None = Field(default=None, max_length=255)
    guest_count: int | None = Field(default=None, ge=0)
    estimated_budget: Money | None = Field(default=None, ge=0, max_digits=15, decimal_places=3)
    actual_budget: Money | None = Field(default=None, ge=0, max_digits=15, decimal_places=3)
    notes: str | None = None
    position: int | None = Field(default=None, ge=0)


class BudgetCategoryCreate(BaseModel):
    name: str = Field(min_length=1, max_length=120)
    parent_category: str | None = Field(default=None, max_length=120)
    event_id: str | None = None
    enabled: bool = True
    planned_budget: Money = Field(default=Decimal('0'), ge=0, max_digits=15, decimal_places=3)
    estimated_cost: Money = Field(default=Decimal('0'), ge=0, max_digits=15, decimal_places=3)
    confirmed_price: Money = Field(default=Decimal('0'), ge=0, max_digits=15, decimal_places=3)
    actual_cost: Money = Field(default=Decimal('0'), ge=0, max_digits=15, decimal_places=3)
    reserved_amount: Money = Field(default=Decimal('0'), ge=0, max_digits=15, decimal_places=3)
    notes: str | None = None


class BudgetCategoryUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=120)
    parent_category: str | None = Field(default=None, max_length=120)
    event_id: str | None = None
    enabled: bool | None = None
    planned_budget: Money | None = Field(default=None, ge=0, max_digits=15, decimal_places=3)
    estimated_cost: Money | None = Field(default=None, ge=0, max_digits=15, decimal_places=3)
    confirmed_price: Money | None = Field(default=None, ge=0, max_digits=15, decimal_places=3)
    actual_cost: Money | None = Field(default=None, ge=0, max_digits=15, decimal_places=3)
    reserved_amount: Money | None = Field(default=None, ge=0, max_digits=15, decimal_places=3)
    notes: str | None = None


class ProviderCreate(BaseModel):
    name: str = Field(min_length=1, max_length=160)
    service_category: str = Field(min_length=1, max_length=100)
    phone: str | None = Field(default=None, max_length=40)
    email: str | None = Field(default=None, max_length=255)
    address: str | None = None
    governorate: str | None = Field(default=None, max_length=120)
    agreed_price: Money = Field(default=Decimal('0'), ge=0, max_digits=15, decimal_places=3)
    deposit: Money = Field(default=Decimal('0'), ge=0, max_digits=15, decimal_places=3)
    booking_date: date | None = None
    service_date: date | None = None
    contract_status: Literal['considering', 'quoted', 'booked', 'confirmed', 'cancelled'] = 'considering'
    notes: str | None = None


class ProviderUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=160)
    service_category: str | None = Field(default=None, min_length=1, max_length=100)
    phone: str | None = Field(default=None, max_length=40)
    email: str | None = Field(default=None, max_length=255)
    address: str | None = None
    governorate: str | None = Field(default=None, max_length=120)
    agreed_price: Money | None = Field(default=None, ge=0, max_digits=15, decimal_places=3)
    deposit: Money | None = Field(default=None, ge=0, max_digits=15, decimal_places=3)
    booking_date: date | None = None
    service_date: date | None = None
    contract_status: Literal['considering', 'quoted', 'booked', 'confirmed', 'cancelled'] | None = None
    notes: str | None = None


class ProviderQuoteCreate(BaseModel):
    quoted_price: Money = Field(ge=0, max_digits=15, decimal_places=3)
    quote_date: date | None = None
    notes: str | None = None


class ProviderContractCreate(BaseModel):
    agreed_price: Money = Field(ge=0, max_digits=15, decimal_places=3)
    deposit: Money = Field(default=Decimal('0'), ge=0, max_digits=15, decimal_places=3)
    signed_date: date | None = None
    status: Literal['draft', 'sent', 'signed', 'cancelled'] = 'draft'
    notes: str | None = None


class PaymentCreate(BaseModel):
    event_id: str | None = None
    budget_category_id: str | None = None
    provider_id: str | None = None
    shopping_item_id: str | None = None
    description: str = Field(min_length=1, max_length=200)
    amount_due: Money = Field(ge=0, max_digits=15, decimal_places=3)
    amount_paid: Money = Field(default=Decimal('0'), ge=0, max_digits=15, decimal_places=3)
    transaction_type: Literal['payment', 'refund'] = 'payment'
    due_date: date | None = None
    payment_date: date | None = None
    payment_method: str | None = Field(default=None, max_length=80)
    status: Literal['upcoming', 'due_today', 'overdue', 'partially_paid', 'paid', 'cancelled'] = 'upcoming'
    notes: str | None = None


class PaymentUpdate(BaseModel):
    event_id: str | None = None
    budget_category_id: str | None = None
    provider_id: str | None = None
    shopping_item_id: str | None = None
    description: str | None = Field(default=None, min_length=1, max_length=200)
    amount_due: Money | None = Field(default=None, ge=0, max_digits=15, decimal_places=3)
    amount_paid: Money | None = Field(default=None, ge=0, max_digits=15, decimal_places=3)
    transaction_type: Literal['payment', 'refund'] | None = None
    due_date: date | None = None
    payment_date: date | None = None
    payment_method: str | None = Field(default=None, max_length=80)
    status: Literal['upcoming', 'due_today', 'overdue', 'partially_paid', 'paid', 'cancelled'] | None = None
    notes: str | None = None


class TaskCreate(BaseModel):
    event_id: str | None = None
    title: str = Field(min_length=1, max_length=180)
    description: str | None = None
    due_date: date | None = None
    priority: Literal['low', 'medium', 'high'] = 'medium'
    status: Literal['pending', 'in_progress', 'completed', 'cancelled'] = 'pending'
    suggested: bool = False


class TaskUpdate(BaseModel):
    event_id: str | None = None
    title: str | None = Field(default=None, min_length=1, max_length=180)
    description: str | None = None
    due_date: date | None = None
    priority: Literal['low', 'medium', 'high'] | None = None
    status: Literal['pending', 'in_progress', 'completed', 'cancelled'] | None = None


class SavingsPlanUpdate(BaseModel):
    current_savings: Money = Field(default=Decimal('0'), ge=0, max_digits=15, decimal_places=3)
    monthly_partner_one: Money = Field(default=Decimal('0'), ge=0, max_digits=15, decimal_places=3)
    monthly_partner_two: Money = Field(default=Decimal('0'), ge=0, max_digits=15, decimal_places=3)
    expected_family_contributions: Money = Field(default=Decimal('0'), ge=0, max_digits=15, decimal_places=3)
    expected_other_income: Money = Field(default=Decimal('0'), ge=0, max_digits=15, decimal_places=3)
    include_gifts: bool = False


class ContributionCreate(BaseModel):
    source: str = Field(min_length=1, max_length=160)
    amount: Money = Field(ge=0, max_digits=15, decimal_places=3)
    confirmed: bool = False
    expected_date: date | None = None
    notes: str | None = None


class GuestTableCreate(BaseModel):
    name: str = Field(min_length=1, max_length=100)
    capacity: int | None = Field(default=None, ge=1)
    notes: str | None = None


class GuestCreate(BaseModel):
    table_id: str | None = None
    name: str = Field(min_length=1, max_length=160)
    relationship: Literal['family', 'friend', 'colleague', 'other'] = 'friend'
    partner_association: Literal['partner_one', 'partner_two', 'both', 'other'] | None = None
    phone: str | None = Field(default=None, max_length=40)
    accompanying_guests: int = Field(default=0, ge=0, le=20)
    invitation_status: Literal['pending', 'sent', 'declined'] = 'pending'
    attendance_status: Literal['pending', 'confirmed', 'declined'] = 'pending'
    notes: str | None = None


class GuestUpdate(BaseModel):
    table_id: str | None = None
    name: str | None = Field(default=None, min_length=1, max_length=160)
    relationship: Literal['family', 'friend', 'colleague', 'other'] | None = None
    partner_association: Literal['partner_one', 'partner_two', 'both', 'other'] | None = None
    phone: str | None = Field(default=None, max_length=40)
    accompanying_guests: int | None = Field(default=None, ge=0, le=20)
    invitation_status: Literal['pending', 'sent', 'declined'] | None = None
    attendance_status: Literal['pending', 'confirmed', 'declined'] | None = None
    notes: str | None = None


class ShoppingItemRequest(BaseModel):
    name: str = Field(min_length=1, max_length=180)
    category: str = Field(default='Autre', max_length=120)
    description: str | None = None
    room: str | None = Field(default=None, max_length=120)
    quantity: str = Field(default='1', max_length=40)
    estimated_unit_price: Money = Field(default=Decimal('0'), ge=0, max_digits=15, decimal_places=3)
    confirmed_unit_price: Money = Field(default=Decimal('0'), ge=0, max_digits=15, decimal_places=3)
    actual_unit_price: Money = Field(default=Decimal('0'), ge=0, max_digits=15, decimal_places=3)
    amount_paid: Money = Field(default=Decimal('0'), ge=0, max_digits=15, decimal_places=3)
    priority: Literal['low', 'medium', 'high'] = 'medium'
    status: Literal['not_started', 'to_purchase', 'comparing', 'reserved', 'partially_paid', 'purchased', 'delivered', 'cancelled'] = 'to_purchase'
    purchase_date: date | None = None
    supplier: str | None = Field(default=None, max_length=180)
    warranty_info: str | None = Field(default=None, max_length=255)
    notes: str | None = None


class BulkPurchaseStatusRequest(BaseModel):
    item_ids: list[str] = Field(min_length=1, max_length=100)
    status: Literal['not_started', 'to_purchase', 'comparing', 'reserved', 'partially_paid', 'purchased', 'delivered', 'cancelled']


class WorkspaceInviteRequest(BaseModel):
    email: str = Field(min_length=3, max_length=255)
    role: Literal['EDITOR', 'VIEWER'] = 'EDITOR'
