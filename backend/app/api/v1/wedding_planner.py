import csv
import io
import uuid
from datetime import date, datetime, timedelta, timezone
from decimal import Decimal
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, Query, status
from fastapi.responses import StreamingResponse
from sqlalchemy import func, or_
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.security import get_current_user
from app.models.user import User
from app.models.wedding import ShoppingItem, Wedding
from app.models.wedding_planner import (
    ActivityLog,
    GuestTable,
    Provider,
    ProviderContract,
    ProviderQuote,
    WeddingBudgetCategory,
    WeddingContribution,
    WeddingEvent,
    WeddingGuest,
    WeddingPayment,
    WeddingPreference,
    WeddingSavingsPlan,
    WeddingTask,
    WorkspaceMember,
)
from app.models.workspace import Workspace
from app.schemas.wedding_planner import (
    BudgetCategoryCreate,
    BudgetCategoryUpdate,
    BulkPurchaseStatusRequest,
    ContributionCreate,
    EventInput,
    EventUpdate,
    GuestCreate,
    GuestTableCreate,
    GuestUpdate,
    OnboardingRequest,
    PaymentCreate,
    PaymentUpdate,
    ProviderCreate,
    ProviderContractCreate,
    ProviderQuoteCreate,
    ProviderUpdate,
    SavingsPlanUpdate,
    ShoppingItemRequest,
    TaskCreate,
    TaskUpdate,
    WorkspaceInviteRequest,
)

router = APIRouter(prefix='/wedding', tags=['wedding-planner'])
ZERO = Decimal('0.000')


def _money(value: Decimal | None) -> str:
    return format(value or ZERO, '.3f')


def _date(value: date | None) -> str | None:
    return value.isoformat() if value else None


def _log(db: Session, wedding: Wedding, user: User, action: str, entity: str, entity_id: str | None, summary: str) -> None:
    db.add(ActivityLog(
        id=str(uuid.uuid4()),
        wedding_id=wedding.id,
        actor_user_id=user.id,
        action=action,
        entity_type=entity,
        entity_id=entity_id,
        summary=summary,
    ))


def _wedding_access(db: Session, user: User) -> tuple[Wedding, str]:
    wedding = db.query(Wedding).filter(Wedding.user_id == user.id).order_by(Wedding.created_at.desc()).first()
    if not wedding:
        owner_wedding_ids = (
            db.query(Wedding.id)
            .join(Workspace, Workspace.owner_id == Wedding.user_id)
            .join(WorkspaceMember, WorkspaceMember.workspace_id == Workspace.id)
            .filter(WorkspaceMember.user_id == user.id)
            .subquery()
        )
        wedding = db.query(Wedding).filter(Wedding.id.in_(owner_wedding_ids)).order_by(Wedding.created_at.desc()).first()
        if not wedding:
            raise HTTPException(status_code=404, detail='Wedding not found')
        workspace = db.query(Workspace).filter(Workspace.owner_id == wedding.user_id).first()
        member = db.query(WorkspaceMember).filter(
            WorkspaceMember.workspace_id == workspace.id,
            WorkspaceMember.user_id == user.id,
        ).first() if workspace else None
        if not member:
            raise HTTPException(status_code=404, detail='Wedding not found')
        return wedding, member.role
    return wedding, 'OWNER'


def _require_write(role: str) -> None:
    if role == 'VIEWER':
        raise HTTPException(status_code=403, detail='This workspace is read-only')


def _require_owner(role: str) -> None:
    if role != 'OWNER':
        raise HTTPException(status_code=403, detail='Only the workspace owner can manage members')


def _get_event(db: Session, wedding_id: str, event_id: str | None) -> WeddingEvent | None:
    if not event_id:
        return None
    event = db.query(WeddingEvent).filter(
        WeddingEvent.id == event_id,
        WeddingEvent.wedding_id == wedding_id,
    ).first()
    if not event:
        raise HTTPException(status_code=404, detail='Wedding event not found')
    return event


def _get_budget_item(db: Session, wedding_id: str, item_id: str) -> WeddingBudgetCategory:
    item = db.query(WeddingBudgetCategory).filter(
        WeddingBudgetCategory.id == item_id,
        WeddingBudgetCategory.wedding_id == wedding_id,
    ).first()
    if not item:
        raise HTTPException(status_code=404, detail='Budget item not found')
    return item


def _payment_status(amount_due: Decimal, amount_paid: Decimal, due_date: date | None, current: str) -> str:
    if current == 'cancelled':
        return 'cancelled'
    if amount_paid >= amount_due and amount_due > 0:
        return 'paid'
    if amount_paid > 0:
        return 'partially_paid'
    today = date.today()
    if due_date and due_date < today:
        return 'overdue'
    if due_date == today:
        return 'due_today'
    return 'upcoming'


def _payment_dict(payment: WeddingPayment) -> dict[str, Any]:
    status_value = _payment_status(
        payment.amount_due, payment.amount_paid, payment.due_date, payment.status
    )
    remaining = max(payment.amount_due - payment.amount_paid, ZERO) if payment.transaction_type == 'payment' else ZERO
    return {
        'id': payment.id,
        'event_id': payment.event_id,
        'budget_category_id': payment.budget_category_id,
        'provider_id': payment.provider_id,
        'shopping_item_id': payment.shopping_item_id,
        'description': payment.description,
        'amount_due': _money(payment.amount_due),
        'amount_paid': _money(payment.amount_paid),
        'remaining_amount': _money(remaining),
        'transaction_type': payment.transaction_type,
        'due_date': _date(payment.due_date),
        'payment_date': _date(payment.payment_date),
        'payment_method': payment.payment_method,
        'status': status_value,
        'notes': payment.notes,
    }


def _verify_payment_references(
    db: Session,
    wedding_id: str,
    event_id: str | None,
    budget_category_id: str | None,
    provider_id: str | None,
    shopping_item_id: str | None,
) -> None:
    _get_event(db, wedding_id, event_id)
    if budget_category_id:
        _get_budget_item(db, wedding_id, budget_category_id)
    if provider_id and not db.query(Provider.id).filter(
        Provider.id == provider_id, Provider.wedding_id == wedding_id
    ).first():
        raise HTTPException(status_code=404, detail='Provider not found')
    if shopping_item_id and not db.query(ShoppingItem.id).join(
        Wedding, Wedding.id == ShoppingItem.wedding_id
    ).filter(
        ShoppingItem.id == shopping_item_id, Wedding.id == wedding_id
    ).first():
        raise HTTPException(status_code=404, detail='Shopping item not found')


@router.post('/onboarding', status_code=status.HTTP_201_CREATED)
def create_wedding_workspace(
    payload: OnboardingRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    existing = db.query(Wedding).filter(Wedding.user_id == current_user.id).order_by(Wedding.created_at.desc()).first()
    if existing and db.query(WeddingPreference.id).filter(WeddingPreference.wedding_id == existing.id).first():
        raise HTTPException(status_code=409, detail='A wedding workspace is already configured')

    wedding = existing or Wedding(
        id=str(uuid.uuid4()),
        user_id=current_user.id,
        name=payload.project_name.strip(),
        budget_total=payload.total_budget,
        currency='TND',
    )
    if existing:
        wedding.name = payload.project_name.strip()
        wedding.budget_total = payload.total_budget
    if payload.wedding_date:
        wedding.wedding_date = datetime.combine(payload.wedding_date, datetime.min.time(), timezone.utc)
    db.add(wedding)
    db.flush()

    preference = WeddingPreference(
        id=str(uuid.uuid4()),
        wedding_id=wedding.id,
        partner_one_name=payload.partner_one_name,
        partner_two_name=payload.partner_two_name,
        engagement_date=payload.engagement_date,
        city=payload.city,
        governorate=payload.governorate,
        venue=payload.venue,
        expected_guest_count=payload.expected_guest_count,
        preferred_language=payload.preferred_language,
        wedding_styles=payload.wedding_styles,
        custom_style=payload.custom_style,
        region=payload.region,
        current_savings=payload.current_savings,
        partner_one_monthly_savings=payload.partner_one_monthly_savings,
        partner_two_monthly_savings=payload.partner_two_monthly_savings,
        family_contributions=payload.family_contributions,
        other_expected_income=payload.other_expected_income,
        gifts_mode=payload.gifts_mode,
        include_home_preparation=payload.include_home_preparation,
        home_categories=payload.home_categories,
        onboarding_completed=True,
    )
    db.add(preference)
    savings = WeddingSavingsPlan(
        id=str(uuid.uuid4()),
        wedding_id=wedding.id,
        current_savings=payload.current_savings,
        monthly_partner_one=payload.partner_one_monthly_savings,
        monthly_partner_two=payload.partner_two_monthly_savings,
        expected_family_contributions=payload.family_contributions,
        expected_other_income=payload.other_expected_income,
        include_gifts=payload.gifts_mode == 'forecast',
    )
    db.add(savings)

    event_records: dict[str, WeddingEvent] = {}
    for index, event_input in enumerate(payload.events):
        event = WeddingEvent(
            id=str(uuid.uuid4()),
            wedding_id=wedding.id,
            name=event_input.name.strip(),
            event_type=event_input.event_type,
            event_date=event_input.event_date,
            location=event_input.location,
            guest_count=event_input.guest_count,
            estimated_budget=event_input.estimated_budget,
            actual_budget=event_input.actual_budget,
            notes=event_input.notes,
            position=index,
        )
        db.add(event)
        event_records[event.name] = event
    db.flush()

    category_names = list(dict.fromkeys(name.strip() for name in payload.custom_categories if name.strip()))
    for name in category_names:
        db.add(WeddingBudgetCategory(
            id=str(uuid.uuid4()),
            wedding_id=wedding.id,
            name=name,
            created_by=current_user.id,
            updated_by=current_user.id,
        ))

    for offset, milestone_tasks in [
        (365, ['Définir le budget', 'Choisir la date', 'Discuter du style du mariage', 'Estimer le nombre d’invités']),
        (270, ['Réserver la salle', 'Comparer les photographes', 'Planifier les achats importants']),
        (180, ['Réserver les prestataires', 'Organiser les préparatifs', 'Acheter les meubles importants']),
        (90, ['Confirmer la liste des invités', 'Finaliser les tenues', 'Confirmer le traiteur']),
        (30, ['Confirmer les prestataires', 'Vérifier les paiements restants', 'Finaliser le programme']),
        (7, ['Vérifier les réservations', 'Confirmer le transport', 'Relire le programme du jour J']),
    ]:
        if not payload.wedding_date:
            continue
        due_date = payload.wedding_date - timedelta(days=offset)
        for title in milestone_tasks:
            db.add(WeddingTask(
                id=str(uuid.uuid4()),
                wedding_id=wedding.id,
                title=title,
                due_date=due_date,
                priority='medium',
                suggested=True,
                created_by=current_user.id,
            ))

    _log(db, wedding, current_user, 'created', 'wedding', wedding.id, 'Configuration du mariage terminée')
    db.commit()
    return {
        'id': wedding.id,
        'name': wedding.name,
        'wedding_date': _date(payload.wedding_date),
        'events_created': len(event_records),
        'categories_created': len(category_names),
    }


@router.get('/preferences')
def get_preferences(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    wedding, _ = _wedding_access(db, current_user)
    preference = db.query(WeddingPreference).filter(WeddingPreference.wedding_id == wedding.id).first()
    if not preference:
        raise HTTPException(status_code=404, detail='Wedding preferences not configured')
    return {
        'id': preference.id,
        'wedding_id': preference.wedding_id,
        'partner_one_name': preference.partner_one_name,
        'partner_two_name': preference.partner_two_name,
        'engagement_date': _date(preference.engagement_date),
        'city': preference.city,
        'governorate': preference.governorate,
        'venue': preference.venue,
        'expected_guest_count': preference.expected_guest_count,
        'preferred_language': preference.preferred_language,
        'wedding_styles': preference.wedding_styles or [],
        'custom_style': preference.custom_style,
        'region': preference.region,
        'current_savings': _money(preference.current_savings),
        'partner_one_monthly_savings': _money(preference.partner_one_monthly_savings),
        'partner_two_monthly_savings': _money(preference.partner_two_monthly_savings),
        'family_contributions': _money(preference.family_contributions),
        'other_expected_income': _money(preference.other_expected_income),
        'gifts_mode': preference.gifts_mode,
        'include_home_preparation': preference.include_home_preparation,
        'home_categories': preference.home_categories or [],
        'onboarding_completed': preference.onboarding_completed,
    }


@router.get('/events')
def list_events(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    wedding, _ = _wedding_access(db, current_user)
    events = db.query(WeddingEvent).filter(WeddingEvent.wedding_id == wedding.id).order_by(
        WeddingEvent.position, WeddingEvent.event_date
    ).all()
    return [{
        'id': event.id, 'name': event.name, 'event_type': event.event_type,
        'event_date': _date(event.event_date), 'location': event.location,
        'guest_count': event.guest_count, 'estimated_budget': _money(event.estimated_budget),
        'actual_budget': _money(event.actual_budget), 'notes': event.notes, 'position': event.position,
    } for event in events]


@router.post('/events', status_code=status.HTTP_201_CREATED)
def create_event(payload: EventInput, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    wedding, role = _wedding_access(db, current_user)
    _require_write(role)
    event = WeddingEvent(id=str(uuid.uuid4()), wedding_id=wedding.id, **payload.model_dump())
    db.add(event)
    db.flush()
    _log(db, wedding, current_user, 'created', 'event', event.id, f'Événement ajouté : {event.name}')
    db.commit()
    return {'id': event.id, 'name': event.name, 'event_date': _date(event.event_date)}


@router.put('/events/{event_id}')
def update_event(event_id: str, payload: EventUpdate, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    wedding, role = _wedding_access(db, current_user)
    _require_write(role)
    event = db.query(WeddingEvent).filter(WeddingEvent.id == event_id, WeddingEvent.wedding_id == wedding.id).first()
    if not event:
        raise HTTPException(status_code=404, detail='Wedding event not found')
    for key, value in payload.model_dump(exclude_unset=True).items():
        setattr(event, key, value)
    event.updated_at = datetime.now(timezone.utc)
    _log(db, wedding, current_user, 'updated', 'event', event.id, f'Événement modifié : {event.name}')
    db.commit()
    return {'id': event.id, 'name': event.name}


@router.delete('/events/{event_id}')
def delete_event(event_id: str, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    wedding, role = _wedding_access(db, current_user)
    _require_write(role)
    event = db.query(WeddingEvent).filter(WeddingEvent.id == event_id, WeddingEvent.wedding_id == wedding.id).first()
    if not event:
        raise HTTPException(status_code=404, detail='Wedding event not found')
    _log(db, wedding, current_user, 'deleted', 'event', event.id, f'Événement supprimé : {event.name}')
    db.delete(event)
    db.commit()
    return {'message': 'Wedding event deleted'}


@router.get('/budget-items')
def list_budget_items(
    event_id: str | None = None,
    category: str | None = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    wedding, _ = _wedding_access(db, current_user)
    query = db.query(WeddingBudgetCategory).filter(WeddingBudgetCategory.wedding_id == wedding.id)
    if event_id:
        query = query.filter(WeddingBudgetCategory.event_id == event_id)
    if category:
        query = query.filter(WeddingBudgetCategory.parent_category == category)
    rows = query.order_by(WeddingBudgetCategory.parent_category, WeddingBudgetCategory.name).all()
    return [{
        'id': item.id, 'event_id': item.event_id, 'name': item.name,
        'parent_category': item.parent_category, 'enabled': item.enabled,
        'planned_budget': _money(item.planned_budget), 'estimated_cost': _money(item.estimated_cost),
        'confirmed_price': _money(item.confirmed_price), 'actual_cost': _money(item.actual_cost),
        'reserved_amount': _money(item.reserved_amount),
        'budget_variance': _money(item.planned_budget - item.actual_cost),
        'budget_consumption': (
            format(item.actual_cost / item.planned_budget * 100, '.2f')
            if item.planned_budget else '0.00'
        ),
        'notes': item.notes,
    } for item in rows]


@router.post('/budget-items', status_code=status.HTTP_201_CREATED)
def create_budget_item(payload: BudgetCategoryCreate, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    wedding, role = _wedding_access(db, current_user)
    _require_write(role)
    _get_event(db, wedding.id, payload.event_id)
    item = WeddingBudgetCategory(
        id=str(uuid.uuid4()), wedding_id=wedding.id,
        created_by=current_user.id, updated_by=current_user.id,
        **payload.model_dump(),
    )
    db.add(item)
    db.flush()
    _log(db, wedding, current_user, 'created', 'budget_item', item.id, f'Catégorie ajoutée : {item.name}')
    db.commit()
    return {'id': item.id, 'name': item.name}


@router.put('/budget-items/{item_id}')
def update_budget_item(item_id: str, payload: BudgetCategoryUpdate, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    wedding, role = _wedding_access(db, current_user)
    _require_write(role)
    item = _get_budget_item(db, wedding.id, item_id)
    values = payload.model_dump(exclude_unset=True)
    if 'event_id' in values:
        _get_event(db, wedding.id, values['event_id'])
    item_payments = db.query(WeddingPayment).filter(
        WeddingPayment.budget_category_id == item.id,
        WeddingPayment.status != 'cancelled',
    ).all()
    if 'confirmed_price' in values and values['confirmed_price'] < sum((p.amount_paid for p in item_payments), ZERO):
        raise HTTPException(status_code=409, detail='Confirmed price cannot be lower than payments already recorded')
    for key, value in values.items():
        setattr(item, key, value)
    item.updated_by = current_user.id
    item.updated_at = datetime.now(timezone.utc)
    _log(db, wedding, current_user, 'updated', 'budget_item', item.id, f'Catégorie modifiée : {item.name}')
    db.commit()
    return {'id': item.id, 'name': item.name}


@router.delete('/budget-items/{item_id}')
def delete_budget_item(item_id: str, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    wedding, role = _wedding_access(db, current_user)
    _require_write(role)
    item = _get_budget_item(db, wedding.id, item_id)
    if db.query(WeddingPayment.id).filter(WeddingPayment.budget_category_id == item.id).first():
        raise HTTPException(status_code=409, detail='Disable this budget item instead; it has payment history')
    _log(db, wedding, current_user, 'deleted', 'budget_item', item.id, f'Catégorie supprimée : {item.name}')
    db.delete(item)
    db.commit()
    return {'message': 'Budget item deleted'}


@router.get('/providers')
def list_providers(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    wedding, _ = _wedding_access(db, current_user)
    providers = db.query(Provider).filter(Provider.wedding_id == wedding.id).order_by(Provider.name).all()
    results = []
    for provider in providers:
        payments = db.query(WeddingPayment).filter(
            WeddingPayment.provider_id == provider.id,
            WeddingPayment.status != 'cancelled',
        ).all()
        paid = sum((p.amount_paid if p.transaction_type == 'payment' else -p.amount_paid for p in payments), ZERO)
        quotes = db.query(ProviderQuote).filter(ProviderQuote.provider_id == provider.id).order_by(
            ProviderQuote.quoted_price
        ).all()
        results.append({
            'id': provider.id, 'name': provider.name, 'service_category': provider.service_category,
            'phone': provider.phone, 'email': provider.email, 'address': provider.address,
            'governorate': provider.governorate, 'agreed_price': _money(provider.agreed_price),
            'deposit': _money(provider.deposit), 'amount_paid': _money(paid),
            'remaining_balance': _money(max(provider.agreed_price - paid, ZERO)),
            'booking_date': _date(provider.booking_date), 'service_date': _date(provider.service_date),
            'contract_status': provider.contract_status, 'notes': provider.notes,
            'quotes': [{'id': q.id, 'quoted_price': _money(q.quoted_price), 'quote_date': _date(q.quote_date), 'notes': q.notes} for q in quotes],
        })
    return results


@router.post('/providers', status_code=status.HTTP_201_CREATED)
def create_provider(payload: ProviderCreate, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    wedding, role = _wedding_access(db, current_user)
    _require_write(role)
    provider = Provider(id=str(uuid.uuid4()), wedding_id=wedding.id, created_by=current_user.id, **payload.model_dump())
    db.add(provider)
    db.flush()
    _log(db, wedding, current_user, 'created', 'provider', provider.id, f'Prestataire ajouté : {provider.name}')
    db.commit()
    return {'id': provider.id, 'name': provider.name}


@router.put('/providers/{provider_id}')
def update_provider(provider_id: str, payload: ProviderUpdate, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    wedding, role = _wedding_access(db, current_user)
    _require_write(role)
    provider = db.query(Provider).filter(Provider.id == provider_id, Provider.wedding_id == wedding.id).first()
    if not provider:
        raise HTTPException(status_code=404, detail='Provider not found')
    values = payload.model_dump(exclude_unset=True)
    for key, value in values.items():
        setattr(provider, key, value)
    provider.updated_at = datetime.now(timezone.utc)
    _log(db, wedding, current_user, 'updated', 'provider', provider.id, f'Prestataire modifié : {provider.name}')
    db.commit()
    return {'id': provider.id, 'name': provider.name}


@router.delete('/providers/{provider_id}')
def delete_provider(provider_id: str, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    wedding, role = _wedding_access(db, current_user)
    _require_write(role)
    provider = db.query(Provider).filter(Provider.id == provider_id, Provider.wedding_id == wedding.id).first()
    if not provider:
        raise HTTPException(status_code=404, detail='Provider not found')
    if db.query(WeddingPayment.id).filter(WeddingPayment.provider_id == provider.id).first():
        raise HTTPException(status_code=409, detail='Provider has payment history and cannot be deleted')
    _log(db, wedding, current_user, 'deleted', 'provider', provider.id, f'Prestataire supprimé : {provider.name}')
    db.delete(provider)
    db.commit()
    return {'message': 'Provider deleted'}


@router.post('/providers/{provider_id}/quotes', status_code=status.HTTP_201_CREATED)
def add_provider_quote(provider_id: str, payload: ProviderQuoteCreate, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    wedding, role = _wedding_access(db, current_user)
    _require_write(role)
    provider = db.query(Provider).filter(Provider.id == provider_id, Provider.wedding_id == wedding.id).first()
    if not provider:
        raise HTTPException(status_code=404, detail='Provider not found')
    quote = ProviderQuote(
        id=str(uuid.uuid4()), wedding_id=wedding.id, provider_id=provider.id, **payload.model_dump()
    )
    db.add(quote)
    db.flush()
    _log(db, wedding, current_user, 'created', 'provider_quote', quote.id, f'Devis ajouté pour {provider.name}')
    db.commit()
    return {'id': quote.id}


@router.post('/providers/{provider_id}/contract', status_code=status.HTTP_201_CREATED)
def create_provider_contract(provider_id: str, payload: ProviderContractCreate, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    wedding, role = _wedding_access(db, current_user)
    _require_write(role)
    provider = db.query(Provider).filter(Provider.id == provider_id, Provider.wedding_id == wedding.id).first()
    if not provider:
        raise HTTPException(status_code=404, detail='Provider not found')
    contract = db.query(ProviderContract).filter(ProviderContract.provider_id == provider.id).first()
    if contract:
        raise HTTPException(status_code=409, detail='A contract already exists for this provider')
    contract = ProviderContract(
        id=str(uuid.uuid4()), wedding_id=wedding.id, provider_id=provider.id, **payload.model_dump()
    )
    provider.agreed_price = payload.agreed_price
    provider.deposit = payload.deposit
    provider.contract_status = 'confirmed' if payload.status == 'signed' else payload.status
    db.add(contract)
    db.flush()
    _log(db, wedding, current_user, 'created', 'provider_contract', contract.id, f'Contrat ajouté : {provider.name}')
    db.commit()
    return {'id': contract.id, 'provider_id': provider.id, 'status': contract.status}


@router.get('/payments')
def list_payments(
    month: str | None = Query(default=None, pattern=r'^\d{4}-\d{2}$'),
    event_id: str | None = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    wedding, _ = _wedding_access(db, current_user)
    query = db.query(WeddingPayment).filter(WeddingPayment.wedding_id == wedding.id)
    if event_id:
        query = query.filter(WeddingPayment.event_id == event_id)
    if month:
        year, month_number = (int(value) for value in month.split('-'))
        query = query.filter(
            func.extract('year', WeddingPayment.due_date) == year,
            func.extract('month', WeddingPayment.due_date) == month_number,
        )
    payments = query.order_by(WeddingPayment.due_date, WeddingPayment.created_at).all()
    return [_payment_dict(payment) for payment in payments]


@router.post('/payments', status_code=status.HTTP_201_CREATED)
def create_payment(payload: PaymentCreate, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    wedding, role = _wedding_access(db, current_user)
    _require_write(role)
    targets = [payload.budget_category_id, payload.provider_id, payload.shopping_item_id]
    if sum(value is not None for value in targets) != 1:
        raise HTTPException(status_code=422, detail='Choose exactly one budget item, provider, or purchase')
    _verify_payment_references(
        db, wedding.id, payload.event_id, payload.budget_category_id,
        payload.provider_id, payload.shopping_item_id,
    )
    if payload.transaction_type == 'payment' and payload.amount_paid > payload.amount_due:
        raise HTTPException(status_code=422, detail='Amount paid cannot exceed this installment amount')
    payment = WeddingPayment(
        id=str(uuid.uuid4()), wedding_id=wedding.id, created_by=current_user.id,
        **payload.model_dump(),
    )
    payment.status = _payment_status(
        payment.amount_due, payment.amount_paid, payment.due_date, payment.status
    )
    db.add(payment)
    db.flush()
    _log(db, wedding, current_user, 'created', 'payment', payment.id, f'Échéance ajoutée : {payment.description}')
    db.commit()
    return _payment_dict(payment)


@router.put('/payments/{payment_id}')
def update_payment(payment_id: str, payload: PaymentUpdate, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    wedding, role = _wedding_access(db, current_user)
    _require_write(role)
    payment = db.query(WeddingPayment).filter(
        WeddingPayment.id == payment_id, WeddingPayment.wedding_id == wedding.id
    ).first()
    if not payment:
        raise HTTPException(status_code=404, detail='Payment not found')
    values = payload.model_dump(exclude_unset=True)
    references = {
        key: values.get(key, getattr(payment, key))
        for key in ('event_id', 'budget_category_id', 'provider_id', 'shopping_item_id')
    }
    _verify_payment_references(db, wedding.id, **references)
    amount_due = values.get('amount_due', payment.amount_due)
    amount_paid = values.get('amount_paid', payment.amount_paid)
    transaction_type = values.get('transaction_type', payment.transaction_type)
    if transaction_type == 'payment' and amount_paid > amount_due:
        raise HTTPException(status_code=422, detail='Amount paid cannot exceed this installment amount')
    for key, value in values.items():
        setattr(payment, key, value)
    payment.status = _payment_status(amount_due, amount_paid, payment.due_date, payment.status)
    payment.updated_at = datetime.now(timezone.utc)
    _log(db, wedding, current_user, 'updated', 'payment', payment.id, f'Échéance modifiée : {payment.description}')
    db.commit()
    return _payment_dict(payment)


@router.delete('/payments/{payment_id}')
def cancel_payment(payment_id: str, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    wedding, role = _wedding_access(db, current_user)
    _require_write(role)
    payment = db.query(WeddingPayment).filter(
        WeddingPayment.id == payment_id, WeddingPayment.wedding_id == wedding.id
    ).first()
    if not payment:
        raise HTTPException(status_code=404, detail='Payment not found')
    payment.status = 'cancelled'
    payment.updated_at = datetime.now(timezone.utc)
    _log(db, wedding, current_user, 'cancelled', 'payment', payment.id, f'Échéance annulée : {payment.description}')
    db.commit()
    return {'message': 'Payment cancelled'}


@router.get('/tasks')
def list_tasks(
    event_id: str | None = None,
    status_filter: str | None = Query(default=None, alias='status'),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    wedding, _ = _wedding_access(db, current_user)
    query = db.query(WeddingTask).filter(WeddingTask.wedding_id == wedding.id)
    if event_id:
        query = query.filter(WeddingTask.event_id == event_id)
    if status_filter:
        query = query.filter(WeddingTask.status == status_filter)
    tasks = query.order_by(WeddingTask.due_date.is_(None), WeddingTask.due_date, WeddingTask.created_at).all()
    return [{
        'id': task.id, 'event_id': task.event_id, 'title': task.title,
        'description': task.description, 'due_date': _date(task.due_date),
        'priority': task.priority, 'status': task.status, 'suggested': task.suggested,
    } for task in tasks]


@router.post('/tasks', status_code=status.HTTP_201_CREATED)
def create_task(payload: TaskCreate, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    wedding, role = _wedding_access(db, current_user)
    _require_write(role)
    _get_event(db, wedding.id, payload.event_id)
    task = WeddingTask(
        id=str(uuid.uuid4()), wedding_id=wedding.id, created_by=current_user.id,
        **payload.model_dump(),
    )
    db.add(task)
    db.flush()
    _log(db, wedding, current_user, 'created', 'task', task.id, f'Tâche ajoutée : {task.title}')
    db.commit()
    return {'id': task.id, 'title': task.title}


@router.put('/tasks/{task_id}')
def update_task(task_id: str, payload: TaskUpdate, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    wedding, role = _wedding_access(db, current_user)
    _require_write(role)
    task = db.query(WeddingTask).filter(WeddingTask.id == task_id, WeddingTask.wedding_id == wedding.id).first()
    if not task:
        raise HTTPException(status_code=404, detail='Task not found')
    values = payload.model_dump(exclude_unset=True)
    if 'event_id' in values:
        _get_event(db, wedding.id, values['event_id'])
    for key, value in values.items():
        setattr(task, key, value)
    task.updated_by = current_user.id
    task.updated_at = datetime.now(timezone.utc)
    _log(db, wedding, current_user, 'updated', 'task', task.id, f'Tâche modifiée : {task.title}')
    db.commit()
    return {'id': task.id, 'title': task.title, 'status': task.status}


@router.delete('/tasks/{task_id}')
def delete_task(task_id: str, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    wedding, role = _wedding_access(db, current_user)
    _require_write(role)
    task = db.query(WeddingTask).filter(WeddingTask.id == task_id, WeddingTask.wedding_id == wedding.id).first()
    if not task:
        raise HTTPException(status_code=404, detail='Task not found')
    _log(db, wedding, current_user, 'deleted', 'task', task.id, f'Tâche supprimée : {task.title}')
    db.delete(task)
    db.commit()
    return {'message': 'Task deleted'}


@router.put('/savings-plan')
def update_savings_plan(payload: SavingsPlanUpdate, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    wedding, role = _wedding_access(db, current_user)
    _require_write(role)
    plan = db.query(WeddingSavingsPlan).filter(WeddingSavingsPlan.wedding_id == wedding.id).first()
    if not plan:
        plan = WeddingSavingsPlan(id=str(uuid.uuid4()), wedding_id=wedding.id)
        db.add(plan)
    for key, value in payload.model_dump().items():
        setattr(plan, key, value)
    plan.updated_at = datetime.now(timezone.utc)
    _log(db, wedding, current_user, 'updated', 'savings_plan', plan.id, 'Plan d’épargne mis à jour')
    db.commit()
    return {'id': plan.id}


@router.get('/savings-plan')
def get_savings_plan(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    wedding, _ = _wedding_access(db, current_user)
    plan = db.query(WeddingSavingsPlan).filter(WeddingSavingsPlan.wedding_id == wedding.id).first()
    if not plan:
        return {
            'current_savings': _money(ZERO), 'monthly_partner_one': _money(ZERO),
            'monthly_partner_two': _money(ZERO), 'expected_family_contributions': _money(ZERO),
            'expected_other_income': _money(ZERO), 'include_gifts': False,
        }
    return {
        'current_savings': _money(plan.current_savings),
        'monthly_partner_one': _money(plan.monthly_partner_one),
        'monthly_partner_two': _money(plan.monthly_partner_two),
        'expected_family_contributions': _money(plan.expected_family_contributions),
        'expected_other_income': _money(plan.expected_other_income),
        'include_gifts': plan.include_gifts,
    }


@router.get('/contributions')
def list_contributions(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    wedding, _ = _wedding_access(db, current_user)
    rows = db.query(WeddingContribution).filter(WeddingContribution.wedding_id == wedding.id).order_by(
        WeddingContribution.expected_date, WeddingContribution.created_at
    ).all()
    return [{
        'id': row.id, 'source': row.source, 'amount': _money(row.amount),
        'confirmed': row.confirmed, 'expected_date': _date(row.expected_date), 'notes': row.notes,
    } for row in rows]


@router.post('/contributions', status_code=status.HTTP_201_CREATED)
def create_contribution(payload: ContributionCreate, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    wedding, role = _wedding_access(db, current_user)
    _require_write(role)
    row = WeddingContribution(
        id=str(uuid.uuid4()), wedding_id=wedding.id, created_by=current_user.id, **payload.model_dump()
    )
    db.add(row)
    db.flush()
    _log(db, wedding, current_user, 'created', 'contribution', row.id, f'Contribution ajoutée : {row.source}')
    db.commit()
    return {'id': row.id}


@router.get('/guests')
def list_guests(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    wedding, _ = _wedding_access(db, current_user)
    guests = db.query(WeddingGuest).filter(WeddingGuest.wedding_id == wedding.id).order_by(WeddingGuest.name).all()
    count = len(guests)
    confirmed = sum(1 + guest.accompanying_guests for guest in guests if guest.attendance_status == 'confirmed')
    declined = sum(1 + guest.accompanying_guests for guest in guests if guest.attendance_status == 'declined')
    tables = {table.id: table.name for table in db.query(GuestTable).filter(GuestTable.wedding_id == wedding.id).all()}
    return {
        'summary': {
            'guest_records': count,
            'total_people': sum(1 + guest.accompanying_guests for guest in guests),
            'confirmed_people': confirmed,
            'pending_records': sum(guest.attendance_status == 'pending' for guest in guests),
            'declined_people': declined,
        },
        'guests': [{
            'id': guest.id, 'table_id': guest.table_id, 'table_name': tables.get(guest.table_id),
            'name': guest.name, 'relationship': guest.relationship,
            'partner_association': guest.partner_association, 'phone': guest.phone,
            'accompanying_guests': guest.accompanying_guests,
            'invitation_status': guest.invitation_status,
            'attendance_status': guest.attendance_status, 'notes': guest.notes,
        } for guest in guests],
        'tables': [{
            'id': table.id, 'name': table.name, 'capacity': table.capacity, 'notes': table.notes,
            'assigned_people': sum(
                1 + guest.accompanying_guests for guest in guests if guest.table_id == table.id
            ),
        } for table in db.query(GuestTable).filter(GuestTable.wedding_id == wedding.id).order_by(GuestTable.name).all()],
    }


@router.post('/guest-tables', status_code=status.HTTP_201_CREATED)
def create_guest_table(payload: GuestTableCreate, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    wedding, role = _wedding_access(db, current_user)
    _require_write(role)
    table = GuestTable(id=str(uuid.uuid4()), wedding_id=wedding.id, **payload.model_dump())
    db.add(table)
    db.flush()
    _log(db, wedding, current_user, 'created', 'guest_table', table.id, f'Table ajoutée : {table.name}')
    db.commit()
    return {'id': table.id, 'name': table.name}


@router.post('/guests', status_code=status.HTTP_201_CREATED)
def create_guest(payload: GuestCreate, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    wedding, role = _wedding_access(db, current_user)
    _require_write(role)
    table = None
    if payload.table_id:
        table = db.query(GuestTable).filter(
            GuestTable.id == payload.table_id, GuestTable.wedding_id == wedding.id
        ).first()
        if not table:
            raise HTTPException(status_code=404, detail='Guest table not found')
        assigned = db.query(func.coalesce(func.sum(WeddingGuest.accompanying_guests + 1), 0)).filter(
            WeddingGuest.table_id == table.id
        ).scalar()
        if table.capacity and assigned + payload.accompanying_guests + 1 > table.capacity:
            raise HTTPException(status_code=409, detail='This table does not have enough seats')
    guest = WeddingGuest(
        id=str(uuid.uuid4()), wedding_id=wedding.id, created_by=current_user.id, **payload.model_dump()
    )
    db.add(guest)
    db.flush()
    _log(db, wedding, current_user, 'created', 'guest', guest.id, f'Invité ajouté : {guest.name}')
    db.commit()
    return {'id': guest.id}


@router.put('/guests/{guest_id}')
def update_guest(guest_id: str, payload: GuestUpdate, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    wedding, role = _wedding_access(db, current_user)
    _require_write(role)
    guest = db.query(WeddingGuest).filter(WeddingGuest.id == guest_id, WeddingGuest.wedding_id == wedding.id).first()
    if not guest:
        raise HTTPException(status_code=404, detail='Guest not found')
    values = payload.model_dump(exclude_unset=True)
    table_id = values.get('table_id', guest.table_id)
    if table_id:
        table = db.query(GuestTable).filter(
            GuestTable.id == table_id, GuestTable.wedding_id == wedding.id
        ).first()
        if not table:
            raise HTTPException(status_code=404, detail='Guest table not found')
        if table.capacity:
            assigned = db.query(func.coalesce(func.sum(WeddingGuest.accompanying_guests + 1), 0)).filter(
                WeddingGuest.table_id == table.id, WeddingGuest.id != guest.id
            ).scalar()
            guest_count = values.get('accompanying_guests', guest.accompanying_guests) + 1
            if assigned + guest_count > table.capacity:
                raise HTTPException(status_code=409, detail='This table does not have enough seats')
    for key, value in values.items():
        setattr(guest, key, value)
    guest.updated_at = datetime.now(timezone.utc)
    _log(db, wedding, current_user, 'updated', 'guest', guest.id, f'Invité modifié : {guest.name}')
    db.commit()
    return {'id': guest.id}


@router.delete('/guests/{guest_id}')
def delete_guest(guest_id: str, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    wedding, role = _wedding_access(db, current_user)
    _require_write(role)
    guest = db.query(WeddingGuest).filter(WeddingGuest.id == guest_id, WeddingGuest.wedding_id == wedding.id).first()
    if not guest:
        raise HTTPException(status_code=404, detail='Guest not found')
    _log(db, wedding, current_user, 'deleted', 'guest', guest.id, f'Invité supprimé : {guest.name}')
    db.delete(guest)
    db.commit()
    return {'message': 'Guest deleted'}


@router.get('/shopping')
def list_purchases(
    search: str | None = None,
    category: str | None = None,
    room: str | None = None,
    status_filter: str | None = Query(default=None, alias='status'),
    sort_by: str = Query(default='name', pattern='^(name|purchase_date|estimated_unit_price|status)$'),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    wedding, _ = _wedding_access(db, current_user)
    query = db.query(ShoppingItem).filter(ShoppingItem.wedding_id == wedding.id)
    if search:
        query = query.filter(ShoppingItem.name.ilike(f'%{search.strip()}%'))
    if category:
        query = query.filter(ShoppingItem.category == category)
    if room:
        query = query.filter(ShoppingItem.room == room)
    if status_filter:
        query = query.filter(ShoppingItem.status == status_filter)
    sort_column = {
        'name': ShoppingItem.name,
        'purchase_date': ShoppingItem.purchase_date,
        'estimated_unit_price': ShoppingItem.estimated_unit_price,
        'status': ShoppingItem.status,
    }[sort_by]
    rows = query.order_by(sort_column).all()
    return [{
        'id': item.id, 'name': item.name, 'category': item.category,
        'description': item.description, 'room': item.room, 'quantity': item.quantity,
        'estimated_unit_price': _money(item.estimated_unit_price),
        'confirmed_unit_price': _money(item.confirmed_unit_price),
        'actual_unit_price': _money(item.actual_unit_price),
        'amount_paid': _money(item.amount_paid), 'priority': item.priority,
        'status': item.status, 'purchase_date': _date(item.purchase_date),
        'supplier': item.supplier, 'warranty_info': item.warranty_info, 'notes': item.notes,
    } for item in rows]


@router.post('/shopping', status_code=status.HTTP_201_CREATED)
def create_purchase(payload: ShoppingItemRequest, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    wedding, role = _wedding_access(db, current_user)
    _require_write(role)
    item = ShoppingItem(
        id=str(uuid.uuid4()),
        wedding_id=wedding.id,
        **payload.model_dump(),
    )
    db.add(item)
    db.flush()
    _log(db, wedding, current_user, 'created', 'purchase', item.id, f'Achat ajouté : {item.name}')
    db.commit()
    return {'id': item.id, 'name': item.name}


@router.put('/shopping/{item_id}')
def update_purchase(item_id: str, payload: ShoppingItemRequest, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    wedding, role = _wedding_access(db, current_user)
    _require_write(role)
    item = db.query(ShoppingItem).filter(ShoppingItem.id == item_id, ShoppingItem.wedding_id == wedding.id).first()
    if not item:
        raise HTTPException(status_code=404, detail='Purchase not found')
    for key, value in payload.model_dump().items():
        setattr(item, key, value)
    item.updated_at = datetime.now(timezone.utc)
    _log(db, wedding, current_user, 'updated', 'purchase', item.id, f'Achat modifié : {item.name}')
    db.commit()
    return {'id': item.id, 'name': item.name}


@router.delete('/shopping/{item_id}')
def delete_purchase(item_id: str, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    wedding, role = _wedding_access(db, current_user)
    _require_write(role)
    item = db.query(ShoppingItem).filter(ShoppingItem.id == item_id, ShoppingItem.wedding_id == wedding.id).first()
    if not item:
        raise HTTPException(status_code=404, detail='Purchase not found')
    if db.query(WeddingPayment.id).filter(WeddingPayment.shopping_item_id == item.id).first():
        raise HTTPException(status_code=409, detail='Purchase has payment history and cannot be deleted')
    _log(db, wedding, current_user, 'deleted', 'purchase', item.id, f'Achat supprimé : {item.name}')
    db.delete(item)
    db.commit()
    return {'message': 'Purchase deleted'}


@router.post('/shopping/bulk-status')
def bulk_update_purchase_status(
    payload: BulkPurchaseStatusRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    wedding, role = _wedding_access(db, current_user)
    _require_write(role)
    rows = db.query(ShoppingItem).filter(
        ShoppingItem.wedding_id == wedding.id,
        ShoppingItem.id.in_(payload.item_ids),
    ).all()
    if len(rows) != len(set(payload.item_ids)):
        raise HTTPException(status_code=404, detail='One or more purchases were not found')
    for row in rows:
        row.status = payload.status
        row.updated_at = datetime.now(timezone.utc)
    _log(db, wedding, current_user, 'bulk_updated', 'purchase', None, f'{len(rows)} achats mis à jour')
    db.commit()
    return {'updated': len(rows)}


@router.get('/shopping/export.csv')
def export_purchases_csv(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    wedding, _ = _wedding_access(db, current_user)
    rows = db.query(ShoppingItem).filter(ShoppingItem.wedding_id == wedding.id).order_by(
        ShoppingItem.room, ShoppingItem.category, ShoppingItem.name
    ).all()
    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow([
        'Name', 'Room', 'Category', 'Quantity', 'Estimated unit price (TND)',
        'Confirmed unit price (TND)', 'Actual unit price (TND)', 'Paid (TND)',
        'Status', 'Supplier', 'Purchase date', 'Notes',
    ])
    for item in rows:
        writer.writerow([
            item.name, item.room or '', item.category, item.quantity,
            _money(item.estimated_unit_price), _money(item.confirmed_unit_price),
            _money(item.actual_unit_price), _money(item.amount_paid), item.status,
            item.supplier or '', _date(item.purchase_date) or '', item.notes or '',
        ])
    output.seek(0)
    headers = {'Content-Disposition': 'attachment; filename="wedding-shopping.csv"'}
    return StreamingResponse(iter([output.getvalue()]), media_type='text/csv; charset=utf-8', headers=headers)


@router.get('/calendar')
def wedding_calendar(
    start_date: date,
    end_date: date,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if end_date < start_date:
        raise HTTPException(status_code=422, detail='End date must be on or after start date')
    if (end_date - start_date).days > 400:
        raise HTTPException(status_code=422, detail='Calendar range cannot exceed 400 days')
    wedding, _ = _wedding_access(db, current_user)
    entries: list[dict[str, Any]] = []
    events = db.query(WeddingEvent).filter(
        WeddingEvent.wedding_id == wedding.id,
        WeddingEvent.event_date >= start_date,
        WeddingEvent.event_date <= end_date,
    ).all()
    entries.extend({
        'id': event.id, 'type': 'event', 'title': event.name,
        'date': _date(event.event_date), 'event_id': event.id, 'status': 'scheduled',
    } for event in events)
    payments = db.query(WeddingPayment).filter(
        WeddingPayment.wedding_id == wedding.id,
        WeddingPayment.due_date >= start_date,
        WeddingPayment.due_date <= end_date,
        WeddingPayment.status != 'cancelled',
    ).all()
    entries.extend({
        'id': payment.id, 'type': 'payment', 'title': payment.description,
        'date': _date(payment.due_date), 'event_id': payment.event_id,
        'status': _payment_status(payment.amount_due, payment.amount_paid, payment.due_date, payment.status),
        'amount_due': _money(payment.amount_due),
    } for payment in payments)
    tasks = db.query(WeddingTask).filter(
        WeddingTask.wedding_id == wedding.id,
        WeddingTask.due_date >= start_date,
        WeddingTask.due_date <= end_date,
        WeddingTask.status.notin_(['completed', 'cancelled']),
    ).all()
    entries.extend({
        'id': task.id, 'type': 'task', 'title': task.title,
        'date': _date(task.due_date), 'event_id': task.event_id, 'status': task.status,
    } for task in tasks)
    purchases = db.query(ShoppingItem).filter(
        ShoppingItem.wedding_id == wedding.id,
        ShoppingItem.purchase_date >= start_date,
        ShoppingItem.purchase_date <= end_date,
    ).all()
    entries.extend({
        'id': item.id, 'type': 'purchase', 'title': item.name,
        'date': _date(item.purchase_date), 'event_id': None, 'status': item.status,
    } for item in purchases)
    providers = db.query(Provider).filter(
        Provider.wedding_id == wedding.id,
        Provider.service_date >= start_date,
        Provider.service_date <= end_date,
    ).all()
    entries.extend({
        'id': provider.id, 'type': 'provider', 'title': provider.name,
        'date': _date(provider.service_date), 'event_id': None, 'status': provider.contract_status,
    } for provider in providers)
    entries.sort(key=lambda item: item['date'] or '')
    return entries


@router.get('/dashboard/summary')
def wedding_dashboard(
    event_id: str | None = None,
    month: str | None = Query(default=None, pattern=r'^\d{4}-\d{2}$'),
    category_id: str | None = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    wedding, _ = _wedding_access(db, current_user)
    preferences = db.query(WeddingPreference).filter(WeddingPreference.wedding_id == wedding.id).first()
    category_query = db.query(WeddingBudgetCategory).filter(
        WeddingBudgetCategory.wedding_id == wedding.id, WeddingBudgetCategory.enabled.is_(True)
    )
    if event_id:
        category_query = category_query.filter(WeddingBudgetCategory.event_id == event_id)
    if category_id:
        category_query = category_query.filter(WeddingBudgetCategory.id == category_id)
    if month:
        year, month_number = (int(value) for value in month.split('-'))
        category_query = category_query.filter(
            func.extract('year', WeddingBudgetCategory.created_at) == year,
            func.extract('month', WeddingBudgetCategory.created_at) == month_number,
        )
    categories = category_query.all()
    total_planned = sum((category.planned_budget for category in categories), ZERO)
    if not categories and not event_id and not month and not category_id:
        total_planned = wedding.budget_total or ZERO
    total_estimated = sum((category.estimated_cost for category in categories), ZERO)
    total_actual = sum((category.actual_cost for category in categories), ZERO)

    payment_query = db.query(WeddingPayment).filter(
        WeddingPayment.wedding_id == wedding.id, WeddingPayment.status != 'cancelled'
    )
    if event_id:
        payment_query = payment_query.filter(WeddingPayment.event_id == event_id)
    if category_id:
        payment_query = payment_query.filter(WeddingPayment.budget_category_id == category_id)
    if month:
        year, month_number = (int(value) for value in month.split('-'))
        payment_query = payment_query.filter(
            func.extract('year', WeddingPayment.due_date) == year,
            func.extract('month', WeddingPayment.due_date) == month_number,
        )
    payments = payment_query.all()
    net_paid = sum((
        payment.amount_paid if payment.transaction_type == 'payment' else -payment.amount_paid
        for payment in payments
    ), ZERO)
    net_paid = max(net_paid, ZERO)
    payment_unpaid = sum((
        max(payment.amount_due - payment.amount_paid, ZERO)
        for payment in payments if payment.transaction_type == 'payment'
    ), ZERO)
    planned_unpaid_by_category = ZERO
    for category in categories:
        paid_for_category = sum((
            payment.amount_paid if payment.transaction_type == 'payment' else -payment.amount_paid
            for payment in payments
            if payment.budget_category_id == category.id
        ), ZERO)
        planned_unpaid_by_category += max(category.confirmed_price - paid_for_category, ZERO)
    total_unpaid = max(payment_unpaid, planned_unpaid_by_category)

    tasks_query = db.query(WeddingTask).filter(WeddingTask.wedding_id == wedding.id)
    if event_id:
        tasks_query = tasks_query.filter(WeddingTask.event_id == event_id)
    tasks = tasks_query.all()
    purchase_query = db.query(ShoppingItem).filter(ShoppingItem.wedding_id == wedding.id)
    if category_id:
        category = _get_budget_item(db, wedding.id, category_id)
        purchase_query = purchase_query.filter(ShoppingItem.category == category.name)
    if month:
        year, month_number = (int(value) for value in month.split('-'))
        purchase_query = purchase_query.filter(
            func.extract('year', ShoppingItem.created_at) == year,
            func.extract('month', ShoppingItem.created_at) == month_number,
        )
    purchases = purchase_query.all()
    providers_query = db.query(Provider).filter(Provider.wedding_id == wedding.id)
    if month:
        year, month_number = (int(value) for value in month.split('-'))
        providers_query = providers_query.filter(
            func.extract('year', Provider.created_at) == year,
            func.extract('month', Provider.created_at) == month_number,
        )
    providers = providers_query.all()
    today = date.today()
    relevant_payments = payments
    upcoming = [
        payment for payment in relevant_payments
        if payment.transaction_type == 'payment'
        and payment.status != 'cancelled'
        and payment.due_date and payment.due_date >= today
        and payment.amount_paid < payment.amount_due
    ]
    overdue = [
        payment for payment in relevant_payments
        if payment.transaction_type == 'payment'
        and payment.status != 'cancelled'
        and payment.due_date and payment.due_date < today
        and payment.amount_paid < payment.amount_due
    ]
    open_tasks = [task for task in tasks if task.status not in ('completed', 'cancelled')]
    next_event = db.query(WeddingEvent).filter(
        WeddingEvent.wedding_id == wedding.id, WeddingEvent.event_date >= today
    ).order_by(WeddingEvent.event_date).first()
    next_payment = min((p for p in upcoming), key=lambda payment: payment.due_date) if upcoming else None
    next_task = min(
        (task for task in open_tasks if task.due_date and task.due_date >= today),
        key=lambda task: task.due_date,
        default=None,
    )
    plan = db.query(WeddingSavingsPlan).filter(WeddingSavingsPlan.wedding_id == wedding.id).first()
    available_savings = plan.current_savings if plan else (
        preferences.current_savings if preferences else ZERO
    )
    confirmed_contributions = db.query(WeddingContribution).filter(
        WeddingContribution.wedding_id == wedding.id,
        WeddingContribution.confirmed.is_(True),
        or_(WeddingContribution.expected_date.is_(None), WeddingContribution.expected_date >= today),
    ).all()
    expected_contributions = sum((item.amount for item in confirmed_contributions), ZERO)
    return {
        'wedding': {'id': wedding.id, 'name': wedding.name, 'wedding_date': _date(wedding.wedding_date.date() if wedding.wedding_date else None)},
        'financial': {
            'total_planned_budget': _money(total_planned),
            'total_estimated_expenses': _money(total_estimated),
            'total_actual_expenses': _money(total_actual),
            'total_amount_paid': _money(net_paid),
            'total_remaining_payments': _money(total_unpaid),
            'available_savings': _money(available_savings),
            'confirmed_future_contributions': _money(expected_contributions),
            'remaining_budget': _money(total_planned - total_actual),
            'budget_utilization_percent': format(total_actual / total_planned * 100, '.2f') if total_planned else '0.00',
        },
        'progress': {
            'completed_tasks': sum(task.status == 'completed' for task in tasks),
            'remaining_tasks': len(open_tasks),
            'completed_purchases': sum(item.status in ('purchased', 'delivered', 'completed') for item in purchases),
            'pending_purchases': sum(item.status not in ('purchased', 'delivered', 'completed', 'cancelled') for item in purchases),
            'confirmed_providers': sum(provider.contract_status == 'confirmed' for provider in providers),
            'upcoming_payments': len(upcoming),
            'overdue_payments': len(overdue),
        },
        'important_dates': {
            'countdown_days': max((wedding.wedding_date.date() - today).days, 0) if wedding.wedding_date else None,
            'next_event': {'name': next_event.name, 'date': _date(next_event.event_date)} if next_event else None,
            'next_payment': {'description': next_payment.description, 'date': _date(next_payment.due_date)} if next_payment else None,
            'next_task': {'title': next_task.title, 'date': _date(next_task.due_date)} if next_task else None,
        },
        'budget_distribution': [{
            'id': item.id, 'name': item.name,
            'planned': _money(item.planned_budget), 'estimated': _money(item.estimated_cost),
            'actual': _money(item.actual_cost),
        } for item in categories],
        'payment_progress': {'paid': _money(net_paid), 'remaining': _money(total_unpaid)},
        'purchase_progress': {'completed': sum(item.status in ('purchased', 'delivered', 'completed') for item in purchases), 'total': len(purchases)},
    }


@router.get('/savings-plan/forecast')
def savings_forecast(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    wedding, _ = _wedding_access(db, current_user)
    plan = db.query(WeddingSavingsPlan).filter(WeddingSavingsPlan.wedding_id == wedding.id).first()
    preferences = db.query(WeddingPreference).filter(WeddingPreference.wedding_id == wedding.id).first()
    plan = plan or WeddingSavingsPlan(
        wedding_id=wedding.id,
        current_savings=preferences.current_savings if preferences else ZERO,
        monthly_partner_one=preferences.partner_one_monthly_savings if preferences else ZERO,
        monthly_partner_two=preferences.partner_two_monthly_savings if preferences else ZERO,
        expected_family_contributions=preferences.family_contributions if preferences else ZERO,
        expected_other_income=preferences.other_expected_income if preferences else ZERO,
    )
    today = date.today()
    months = 0
    if wedding.wedding_date and wedding.wedding_date.date() > today:
        months = max(1, (wedding.wedding_date.date() - today).days // 30)
    budget_rows = db.query(WeddingBudgetCategory).filter(
        WeddingBudgetCategory.wedding_id == wedding.id, WeddingBudgetCategory.enabled.is_(True)
    ).all()
    projected_cost = sum((
        category.actual_cost if category.actual_cost > 0
        else category.confirmed_price if category.confirmed_price > 0
        else category.estimated_cost
        for category in budget_rows
    ), ZERO)
    if projected_cost == 0:
        projected_cost = wedding.budget_total or ZERO
    monthly_savings = plan.monthly_partner_one + plan.monthly_partner_two
    confirmed = db.query(WeddingContribution).filter(
        WeddingContribution.wedding_id == wedding.id,
        WeddingContribution.confirmed.is_(True),
    ).all()
    unconfirmed = db.query(WeddingContribution).filter(
        WeddingContribution.wedding_id == wedding.id,
        WeddingContribution.confirmed.is_(False),
    ).all()
    confirmed_total = sum((item.amount for item in confirmed), ZERO)
    unconfirmed_total = sum((item.amount for item in unconfirmed), ZERO)
    base_resources = plan.current_savings + monthly_savings * months + confirmed_total
    optimistic_resources = base_resources + unconfirmed_total + plan.expected_family_contributions + plan.expected_other_income
    confirmed_gap = max(projected_cost - base_resources, ZERO)
    return {
        'months_remaining': months,
        'current_savings': _money(plan.current_savings),
        'monthly_partner_savings': _money(monthly_savings),
        'confirmed_contributions': _money(confirmed_total),
        'unconfirmed_contributions': _money(unconfirmed_total),
        'projected_wedding_cost': _money(projected_cost),
        'conservative': {
            'projected_resources': _money(base_resources),
            'financial_gap': _money(max(projected_cost - base_resources, ZERO)),
            'required_additional_monthly_savings': _money(confirmed_gap / months if months else confirmed_gap),
            'assumptions': 'Includes current savings, planned monthly partner savings, and confirmed contributions only.',
        },
        'optimistic': {
            'projected_resources': _money(optimistic_resources),
            'financial_gap': _money(max(projected_cost - optimistic_resources, ZERO)),
            'assumptions': 'Also includes unconfirmed contributions and planned family or other income; these are not guaranteed.',
        },
    }


@router.get('/activity')
def list_activity(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    wedding, _ = _wedding_access(db, current_user)
    rows = db.query(ActivityLog).filter(ActivityLog.wedding_id == wedding.id).order_by(
        ActivityLog.created_at.desc()
    ).limit(50).all()
    return [{
        'id': row.id, 'actor_user_id': row.actor_user_id, 'action': row.action,
        'entity_type': row.entity_type, 'entity_id': row.entity_id,
        'summary': row.summary, 'created_at': row.created_at.isoformat() if row.created_at else None,
    } for row in rows]


@router.get('/members')
def list_workspace_members(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    wedding, _ = _wedding_access(db, current_user)
    workspace = db.query(Workspace).filter(Workspace.owner_id == wedding.user_id).first()
    if not workspace:
        raise HTTPException(status_code=404, detail='Workspace not found')
    members = db.query(WorkspaceMember, User).join(User, User.id == WorkspaceMember.user_id).filter(
        WorkspaceMember.workspace_id == workspace.id
    ).all()
    owner = db.query(User).filter(User.id == wedding.user_id).first()
    rows = [{
        'id': None, 'user_id': owner.id, 'name': owner.full_name, 'email': owner.email, 'role': 'OWNER'
    }] if owner else []
    rows.extend({
        'id': member.id, 'user_id': user.id, 'name': user.full_name, 'email': user.email, 'role': member.role
    } for member, user in members)
    return rows


@router.post('/members', status_code=status.HTTP_201_CREATED)
def invite_workspace_member(payload: WorkspaceInviteRequest, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    wedding, role = _wedding_access(db, current_user)
    _require_owner(role)
    workspace = db.query(Workspace).filter(Workspace.owner_id == wedding.user_id).first()
    if not workspace:
        raise HTTPException(status_code=404, detail='Workspace not found')
    invitee = db.query(User).filter(User.email == payload.email.lower()).first()
    if not invitee:
        raise HTTPException(status_code=404, detail='Create an account for this email before inviting it')
    if invitee.id == wedding.user_id:
        raise HTTPException(status_code=409, detail='The owner is already a workspace member')
    member = db.query(WorkspaceMember).filter(
        WorkspaceMember.workspace_id == workspace.id,
        WorkspaceMember.user_id == invitee.id,
    ).first()
    if member:
        member.role = payload.role
    else:
        member = WorkspaceMember(
            id=str(uuid.uuid4()), workspace_id=workspace.id,
            user_id=invitee.id, role=payload.role,
        )
        db.add(member)
    db.flush()
    _log(db, wedding, current_user, 'invited', 'workspace_member', member.id, f'Accès partagé avec {invitee.email}')
    db.commit()
    return {'id': member.id, 'email': invitee.email, 'role': member.role}


@router.delete('/members/{member_id}')
def remove_workspace_member(member_id: str, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    wedding, role = _wedding_access(db, current_user)
    _require_owner(role)
    workspace = db.query(Workspace).filter(Workspace.owner_id == wedding.user_id).first()
    member = db.query(WorkspaceMember).filter(
        WorkspaceMember.id == member_id,
        WorkspaceMember.workspace_id == workspace.id if workspace else False,
    ).first()
    if not member:
        raise HTTPException(status_code=404, detail='Workspace member not found')
    _log(db, wedding, current_user, 'removed', 'workspace_member', member.id, 'Membre retiré du workspace')
    db.delete(member)
    db.commit()
    return {'message': 'Workspace member removed'}
