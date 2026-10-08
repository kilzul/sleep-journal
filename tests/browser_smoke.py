"""Explicit live smoke test: creates and removes its own temporary Supabase account.
Run after pip install -r requirements-dev.txt and playwright install chromium.
"""
import os
import secrets
import subprocess
import sys
import time
from datetime import date, timedelta
from pathlib import Path
from urllib.parse import urlencode
from playwright.sync_api import sync_playwright, expect

ROOT = Path(__file__).resolve().parents[1]
ORIGIN = 'http://127.0.0.1:8765'


def main():
    env = {**os.environ, 'APP_URL': ORIGIN}
    log = open('/tmp/sleep-journal-smoke-server.log', 'w')
    server = subprocess.Popen([sys.executable, '-m', 'uvicorn', 'main:app', '--host', '127.0.0.1', '--port', '8765'], cwd=ROOT, env=env, stdout=log, stderr=log)
    marker = 'smoke-' + secrets.token_hex(8)
    email, password = marker + '@example.invalid', 'SmokeTest' + secrets.token_hex(12)
    created = False
    errors = []
    try:
        with sync_playwright() as p:
            browser = p.chromium.launch()
            context = browser.new_context(viewport={'width': 1440, 'height': 1000})
            page = context.new_page()
            page.on('pageerror', lambda error: errors.append(str(error)))
            # The external icon kit is cosmetic and doesn't need network access in this test.
            page.route('https://kit.fontawesome.com/**', lambda route: route.abort())
            for attempt in range(100):
                try:
                    if context.request.get(ORIGIN + '/healthz').ok:
                        break
                except Exception:
                    time.sleep(0.1)
            else:
                raise AssertionError('Test server did not start')
            def ready():
                expect(page.locator('#loading-screen')).to_be_hidden(timeout=60000)
            def nav(id):
                page.locator(id).click()
                ready()
            def login():
                page.locator('#login-email').fill(email)
                page.locator('#log-in-password').fill(password)
                page.locator('#log-in-button').click()
                expect(page.locator('#overview-page')).to_be_visible(timeout=60000)
                ready()
            try:
                page.goto(ORIGIN)
                ready()
                nav('#settings-button')
                expect(page.locator('#log-in-page')).to_be_visible()
                page.locator('#idhaa').click()
                page.locator('#name').fill(marker)
                page.locator('#email').fill(email)
                page.locator('#sign-up-password').fill(password)
                page.locator('#confirm-password').fill(password)
                page.locator('#sign-up-button').click()
                expect(page.locator('#log-in-notice')).to_contain_text('have an account', timeout=60000)
                created = True
                # Clear the remembered settings destination before the login assertion.
                page.reload()
                ready()
                login()
                expect(page.locator('#overview-cards .data-card')).to_have_count(3)
                nav('#overview-button')
                expect(page.locator('#overview-cards .data-card')).to_have_count(3)
                nav('#settings-button')
                expect(page.locator('#settings-name')).to_have_value(marker)
                page.locator('#sleep-goal').fill('7.5')
                page.locator('#target-wake').fill('06:30')
                page.locator('#save-settings-button').click()
                expect(page.locator('#settings-status')).to_contain_text('Settings saved', timeout=60000)
                nav('#journals-button')
                for i in range(3):
                    page.locator('#add-journal-button').click()
                    if i == 0:
                        page.locator('#save-journal-button').click()
                        expect(page.locator('#save-journal-button')).to_be_enabled()
                    page.locator('#sleep-date').fill((date.today() - timedelta(days=i)).isoformat())
                    page.locator('#bed-time').fill('23:00')
                    page.locator('#wake-time').fill('07:00')
                    page.locator('label[for="quality-5"]').click()
                    page.locator('#notes').fill('temporary integration smoke check')
                    page.locator('#save-journal-button').click()
                    expect(page.locator('#journals-page')).to_be_visible(timeout=60000)
                    ready()
                    expect(page.locator('.journal-card')).to_have_count(i + 1)
                nav('#stats-button')
                expect(page.locator('#stats-cards .data-card')).to_have_count(8)
                expect(page.locator('#stats-cards')).to_contain_text('23:00')
                expect(page.locator('#stats-insight')).to_contain_text('7.5 hours')
                expect(page.locator('#stats-history .sleep-history-row')).to_have_count(3)
                page.locator('#stats-period').select_option('7')
                expect(page.locator('#stats-status')).to_contain_text('3 journal entries', timeout=60000)
                nav('#overview-button')
                expect(page.locator('#overview-cards')).to_contain_text('24.0 hours')
                page.reload()
                ready()
                expect(page.locator('#overview-page')).to_be_visible()
                nav('#settings-button')
                expect(page.locator('#sleep-goal')).to_have_value('7.5')
                page.locator('#sign-out-button').click()
                expect(page.locator('#log-in-notice')).to_contain_text('signed out', timeout=60000)
                expect(page.locator('#journal-grid')).to_be_attached()
                login()
                nav('#journals-button')
                expect(page.locator('.journal-card')).to_have_count(3)
                page.locator('.delete-entry').first.click()
                expect(page.locator('.journal-card')).to_have_count(2, timeout=60000)
                nav('#settings-button')
                page.locator('#delete-account-button').click()
                page.locator('#delete-password').fill(password)
                page.locator('#delete-account-form [type="submit"]').click()
                expect(page.locator('#log-in-notice')).to_contain_text('were deleted', timeout=60000)
                created = False
                assert context.request.get(ORIGIN + '/api/me').status == 401
                assert not errors, errors
                print('PASS: protected navigation, signup, login, repeated overview, settings persistence, journal creation/deletion, stats, session restore, sign-out/re-login, account cleanup; no browser JavaScript errors.')
            finally:
                if created:
                    response = context.request.post(ORIGIN + '/api/login', form={'email': email, 'password': password})
                    if response.ok:
                        cleanup = context.request.delete(ORIGIN + '/api/account', data=urlencode({'password': password}), headers={'Content-Type': 'application/x-www-form-urlencoded'})
                        assert cleanup.status == 204, 'Temporary account cleanup failed'
                browser.close()
    finally:
        server.terminate()
        server.wait(timeout=10)
        log.close()


if __name__ == '__main__':
    main()
