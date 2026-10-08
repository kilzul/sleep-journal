import unittest
from datetime import date
from unittest.mock import patch
from fastapi.testclient import TestClient
from main import app
from backend.sessions import get_current_user
from backend.stats import calculate_stats, calculate_overview

SETTINGS = {'username': 'Tester', 'email': 'test@example.invalid', 'sleep_goal_hours': 8, 'target_wake_time': '07:00'}
ENTRIES = [{'id': i, 'sleep_date': date(2026, 10, i), 'bedtime': bed, 'wake_time': wake, 'quality': 5, 'notes': ''}
           for i, bed, wake in [(1, '23:30', '07:30'), (2, '00:30', '08:30'), (3, '00:00', '08:00')]]


class IntegrationTests(unittest.TestCase):
    def setUp(self):
        self.client = TestClient(app)

    def tearDown(self):
        app.dependency_overrides.clear()

    def login(self):
        app.dependency_overrides[get_current_user] = lambda: {'id': 123}

    def test_protected_endpoints(self):
        for path, method in [('/api/settings', 'GET'), ('/api/settings', 'PUT'), ('/api/stats', 'GET'), ('/api/overview', 'GET'), ('/api/account', 'DELETE')]:
            self.assertEqual(self.client.request(method, path).status_code, 401)

    def test_static_assets_and_health(self):
        for path in ['/', '/js/app.js', '/js/stats.js', '/css/style.css', '/fonts/Chewy-Regular.ttf', '/healthz']:
            self.assertEqual(self.client.get(path).status_code, 200)

    def test_overview_matches_frontend_contract(self):
        self.login()
        with patch('main.get_user_journals', return_value=ENTRIES) as journals:
            result = self.client.get('/api/overview')
            self.assertEqual(result.status_code, 200)
            self.assertEqual(result.json(), {'entry_count': 3, 'first_entry_date': '2026-10-01', 'total_sleep_hours': 24})
            journals.assert_called_once_with(123)

    def test_empty_overview(self):
        self.assertEqual(calculate_overview([]), {'entry_count': 0, 'first_entry_date': None, 'total_sleep_hours': 0})

    def test_stats_midnight_and_date_range(self):
        self.login()
        with patch('main.get_user_journals', return_value=ENTRIES), patch('main.get_settings', return_value=SETTINGS):
            result = self.client.get('/api/stats?days=7&today=2026-10-07')
            self.assertEqual(result.status_code, 200)
            self.assertEqual(result.json()['best_bedtime'], '00:00')
            self.assertEqual(result.json()['average_hours'], 8)
            self.assertEqual(self.client.get('/api/stats?days=0').status_code, 422)

    def test_settings_validate_and_use_session_owner(self):
        self.login()
        fields = {'username': ' Tester ', 'sleep_goal_hours': '7.5', 'target_wake_time': '06:30'}
        with patch('main.update_settings', return_value=SETTINGS) as save:
            self.assertEqual(self.client.put('/api/settings', data=fields).status_code, 200)
            self.assertEqual(save.call_args.args[:3], (123, 'Tester', 7.5))
            fields['sleep_goal_hours'] = '30'
            self.assertEqual(self.client.put('/api/settings', data=fields).status_code, 422)
            self.assertEqual(save.call_count, 1)

    def test_cross_site_writes_rejected(self):
        self.login()
        self.assertEqual(self.client.put('/api/settings', headers={'Origin': 'https://example.invalid'}).status_code, 403)

    def test_journal_form_contract(self):
        self.login()
        with patch('main.insert_journal', return_value=ENTRIES[0]) as insert:
            response = self.client.post('/api/entries', data={'sleep_date': '2026-10-01', 'bedtime': '23:30', 'wake_time': '07:30', 'quality': '5', 'notes': ''})
            self.assertEqual(response.status_code, 201)
            args = insert.call_args.args
            self.assertEqual(args[0], 123)
            self.assertEqual((args[3] - args[2]).total_seconds(), 8 * 3600)

    def test_account_wrong_password(self):
        self.login()
        with patch('main.delete_account', return_value=False):
            self.assertEqual(self.client.request('DELETE', '/api/account', data={'password': 'wrong'}).status_code, 403)


if __name__ == '__main__':
    unittest.main()
