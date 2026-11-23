from fastapi.testclient import TestClient

from app.main import app

client = TestClient(app)


def test_register_and_login():
    response = client.post('/api/v1/auth/register', json={
        'full_name': 'Alice Example',
        'email': 'alice@example.com',
        'password': 'secret123',
    })
    assert response.status_code == 201, response.text

    login = client.post('/api/v1/auth/login', json={
        'email': 'alice@example.com',
        'password': 'secret123',
    })
    assert login.status_code == 200, login.text
    token = login.json()['access_token']
    me = client.get('/api/v1/auth/me', headers={'Authorization': f'Bearer {token}'})
    assert me.status_code == 200
    assert me.json()['email'] == 'alice@example.com'


def test_create_wedding_and_finance_data():
    client.post('/api/v1/auth/register', json={'full_name': 'Bob', 'email': 'bob@example.com', 'password': 'secret123'})
    login = client.post('/api/v1/auth/login', json={'email': 'bob@example.com', 'password': 'secret123'})
    token = login.json()['access_token']
    wedding = client.post('/api/v1/wedding', json={'name': 'Wedding', 'budget_total': 5000}, headers={'Authorization': f'Bearer {token}'})
    assert wedding.status_code == 200
    budget = client.post('/api/v1/wedding/budgets', json={'category': 'Venue', 'planned_amount': 2500, 'actual_amount': 1000}, headers={'Authorization': f'Bearer {token}'})
    assert budget.status_code == 200
    wedding_budgets = client.get('/api/v1/wedding/budgets', headers={'Authorization': f'Bearer {token}'})
    assert wedding_budgets.status_code == 200
    assert wedding_budgets.json()[0]['category'] == 'Venue'
    shopping = client.post('/api/v1/wedding/shopping-items', json={'name': 'Flowers', 'estimated_unit_price': 200}, headers={'Authorization': f'Bearer {token}'})
    assert shopping.status_code == 200
    assert client.get('/api/v1/wedding/shopping-items', headers={'Authorization': f'Bearer {token}'}).json()[0]['name'] == 'Flowers'
    income = client.post('/api/v1/finance/income', json={'description': 'Salary', 'source': 'Employer', 'expected_amount': 3000, 'received_amount': 3000, 'transaction_date': '2026-11-15'}, headers={'Authorization': f'Bearer {token}'})
    assert income.status_code == 200
    assert client.get('/api/v1/finance/income', headers={'Authorization': f'Bearer {token}'}).json()[0]['received_amount'] == 3000
    expense = client.post('/api/v1/finance/expenses', json={'description': 'Groceries', 'amount': 230, 'transaction_date': '2026-11-15'}, headers={'Authorization': f'Bearer {token}'})
    assert expense.status_code == 200
    expenses = client.get('/api/v1/finance/expenses', headers={'Authorization': f'Bearer {token}'})
    assert expenses.status_code == 200
    assert expenses.json()[0]['amount'] == 230
    dash = client.get('/api/v1/finance/dashboard', headers={'Authorization': f'Bearer {token}'})
    assert dash.status_code == 200
    assert dash.json()['monthly_balance'] == 2770
    deleted = client.delete(f"/api/v1/finance/expenses/{expenses.json()[0]['id']}", headers={'Authorization': f'Bearer {token}'})
    assert deleted.status_code == 200


def test_wedding_onboarding_financials_and_guest_capacity():
    client.post('/api/v1/auth/register', json={
        'full_name': 'Couple Example', 'email': 'couple@example.com', 'password': 'secret123'
    })
    login = client.post('/api/v1/auth/login', json={
        'email': 'couple@example.com', 'password': 'secret123'
    })
    headers = {'Authorization': f"Bearer {login.json()['access_token']}"}

    onboarding = client.post('/api/v1/wedding/onboarding', headers=headers, json={
        'project_name': 'Amel & Sami',
        'partner_one_name': 'Amel',
        'partner_two_name': 'Sami',
        'wedding_date': '2027-06-15',
        'total_budget': '12000.500',
        'current_savings': '1500.125',
        'partner_one_monthly_savings': '150.000',
        'partner_two_monthly_savings': '200.000',
        'gifts_mode': 'excluded',
        'events': [{'name': 'Henna', 'event_type': 'henna', 'event_date': '2027-06-10'}],
        'custom_categories': ['Cérémonie'],
    })
    assert onboarding.status_code == 201, onboarding.text
    wedding_id = onboarding.json()['id']

    event = client.get('/api/v1/wedding/events', headers=headers).json()[0]
    categories = client.get('/api/v1/wedding/budget-items', headers=headers).json()
    category_id = categories[0]['id']
    item = client.post('/api/v1/wedding/budget-items', headers=headers, json={
        'name': 'Salle', 'event_id': event['id'], 'planned_budget': '2000.125',
        'estimated_cost': '1800.500', 'confirmed_price': '1700.000', 'actual_cost': '1500.250',
    })
    assert item.status_code == 201, item.text
    category_id = item.json()['id']

    payment = client.post('/api/v1/wedding/payments', headers=headers, json={
        'event_id': event['id'], 'budget_category_id': category_id,
        'description': 'Acompte salle', 'amount_due': '500.000',
        'amount_paid': '200.125', 'due_date': '2026-12-15',
    })
    assert payment.status_code == 201, payment.text
    assert payment.json()['remaining_amount'] == '299.875'

    dashboard = client.get('/api/v1/wedding/dashboard/summary', headers=headers)
    assert dashboard.status_code == 200, dashboard.text
    assert dashboard.json()['financial']['total_actual_expenses'] == '1500.250'
    assert dashboard.json()['financial']['total_amount_paid'] == '200.125'

    task = client.post('/api/v1/wedding/tasks', headers=headers, json={
        'title': 'Confirmer la salle', 'due_date': '2027-05-01', 'event_id': event['id']
    })
    assert task.status_code == 201, task.text

    provider = client.post('/api/v1/wedding/providers', headers=headers, json={
        'name': 'Salle des fêtes', 'service_category': 'Venue', 'agreed_price': '1700.000'
    })
    assert provider.status_code == 201, provider.text
    quote = client.post(f"/api/v1/wedding/providers/{provider.json()['id']}/quotes", headers=headers, json={
        'quoted_price': '1800.000'
    })
    assert quote.status_code == 201, quote.text

    table = client.post('/api/v1/wedding/guest-tables', headers=headers, json={
        'name': 'Famille Amel', 'capacity': 2
    })
    assert table.status_code == 201, table.text
    guest = client.post('/api/v1/wedding/guests', headers=headers, json={
        'name': 'Invité', 'table_id': table.json()['id'], 'accompanying_guests': 1
    })
    assert guest.status_code == 201, guest.text
    full_table_guest = client.post('/api/v1/wedding/guests', headers=headers, json={
        'name': 'Autre invité', 'table_id': table.json()['id']
    })
    assert full_table_guest.status_code == 409

    forecast = client.get('/api/v1/wedding/savings-plan/forecast', headers=headers)
    assert forecast.status_code == 200
    assert forecast.json()['conservative']['projected_resources'] != '0.000'
    assert wedding_id == dashboard.json()['wedding']['id']


def test_wedding_summary_category_filter_scopes_payment_totals():
    client.post('/api/v1/auth/register', json={
        'full_name': 'Filter Example', 'email': 'filter@example.com', 'password': 'secret123'
    })
    login = client.post('/api/v1/auth/login', json={
        'email': 'filter@example.com', 'password': 'secret123'
    })
    headers = {'Authorization': f"Bearer {login.json()['access_token']}"}
    onboarding = client.post('/api/v1/wedding/onboarding', headers=headers, json={
        'project_name': 'Filtered wedding', 'total_budget': '900.000'
    })
    assert onboarding.status_code == 201, onboarding.text

    categories = []
    for name in ('Venue', 'Music'):
        response = client.post('/api/v1/wedding/budget-items', headers=headers, json={
            'name': name, 'planned_budget': '100.000', 'confirmed_price': '100.000',
            'actual_cost': '40.000',
        })
        assert response.status_code == 201, response.text
        categories.append(response.json()['id'])

    for category_id, paid in zip(categories, ('25.000', '50.000')):
        response = client.post('/api/v1/wedding/payments', headers=headers, json={
            'budget_category_id': category_id, 'description': 'Installment',
            'amount_due': '100.000', 'amount_paid': paid,
        })
        assert response.status_code == 201, response.text

    summary = client.get(
        f'/api/v1/wedding/dashboard/summary?category_id={categories[0]}',
        headers=headers,
    )
    assert summary.status_code == 200, summary.text
    assert summary.json()['financial']['total_planned_budget'] == '100.000'
    assert summary.json()['financial']['total_amount_paid'] == '25.000'
    assert summary.json()['financial']['total_remaining_payments'] == '75.000'
