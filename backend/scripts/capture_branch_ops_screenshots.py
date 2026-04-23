"""Capture Branch Ops screenshots for the training PDF using a real admin flow.

Usage:
    python3 scripts/capture_branch_ops_screenshots.py

Requires: PRODUCTION environment admin@factory.com with bidso123.
Runs against REACT_APP_BACKEND_URL from frontend/.env.
"""
import asyncio
import os
import sys
from pathlib import Path

# Import playwright - let it fail loudly if missing
try:
    from playwright.async_api import async_playwright
except ImportError:
    print("ERROR: playwright not installed. Run: pip install playwright && playwright install chromium")
    sys.exit(1)

OUT_DIR = Path("/app/backend/static/training/branch_ops")
OUT_DIR.mkdir(parents=True, exist_ok=True)

# Read backend URL from frontend env
FRONTEND_ENV = Path("/app/frontend/.env")
BASE_URL = None
for line in FRONTEND_ENV.read_text().splitlines():
    if line.startswith("REACT_APP_BACKEND_URL"):
        BASE_URL = line.split("=", 1)[1].strip()
        break

if not BASE_URL:
    print("ERROR: REACT_APP_BACKEND_URL not found in /app/frontend/.env")
    sys.exit(1)

print(f"Base URL: {BASE_URL}")


async def run():
    captured = {}
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        context = await browser.new_context(viewport={"width": 1440, "height": 900})
        page = await context.new_page()

        # ---- Login ----
        await page.goto(f"{BASE_URL}/login", wait_until="networkidle")
        await page.wait_for_timeout(1000)
        await page.fill('input[type="email"]', "admin@factory.com")
        await page.fill('input[type="password"]', "bidso123")
        await page.click('button[type="submit"]')
        await page.wait_for_timeout(3000)

        # ---- 01 sidebar ----
        await page.goto(f"{BASE_URL}/dashboard", wait_until="networkidle")
        await page.wait_for_timeout(1500)
        await page.screenshot(path=str(OUT_DIR / "01_sidebar.png"),
                              clip={"x": 0, "y": 0, "width": 280, "height": 900})
        print("✓ 01_sidebar.png")

        # ---- 02 dashboard ----
        await page.goto(f"{BASE_URL}/branch-ops", wait_until="networkidle")
        await page.wait_for_timeout(3000)
        await page.screenshot(path=str(OUT_DIR / "02_dashboard.png"), full_page=False)
        print("✓ 02_dashboard.png")

        # ---- Switch to Custom date range so all scheduled rows show ----
        try:
            # Find first combobox (date filter) and set to Custom
            comboboxes = await page.locator('button[role="combobox"]').all()
            if comboboxes:
                await comboboxes[0].click()
                await page.wait_for_timeout(500)
                await page.locator('div[role="option"]:has-text("Custom")').click(timeout=3000)
                await page.wait_for_timeout(500)
            # Set wide date range
            date_inputs = await page.locator('input[type="date"]').all()
            if len(date_inputs) >= 2:
                await date_inputs[0].fill("2026-01-01")
                await date_inputs[1].fill("2026-12-31")
            # Apply
            await page.click('button:has-text("Apply Filters")')
            await page.wait_for_timeout(2500)
        except Exception as e:
            print(f"Date filter setup: {e}")

        # ---- 03 filters ----
        await page.evaluate("window.scrollTo(0, 250)")
        await page.wait_for_timeout(500)
        await page.screenshot(path=str(OUT_DIR / "03_filters.png"), full_page=False)
        print("✓ 03_filters.png")
        await page.evaluate("window.scrollTo(0, 0)")

        # ---- Find a SCHEDULED row small-qty ----
        target_code = os.environ.get("TRAINING_SCHEDULE_CODE")
        if not target_code:
            # Pick smallest scheduled via direct API
            import httpx
            async with httpx.AsyncClient() as client:
                login_r = await client.post(
                    f"{BASE_URL}/api/auth/login",
                    json={"email": "admin@factory.com", "password": "bidso123"},
                    timeout=30,
                )
                token = login_r.json().get("token") or login_r.json().get("access_token")
                # Small SCHEDULED row
                r = await client.get(
                    f"{BASE_URL}/api/production-schedules?status=SCHEDULED&limit=5",
                    headers={"Authorization": f"Bearer {token}"},
                    timeout=30,
                )
                data = r.json() if r.status_code == 200 else []
                items = data if isinstance(data, list) else data.get("items", [])
                # Sort by qty ascending
                items.sort(key=lambda x: x.get("target_quantity", 999999))
                if items:
                    target_code = items[0].get("schedule_code")
                    captured["schedule_code"] = target_code
                    captured["sku_id"] = items[0].get("sku_id")
                    captured["branch"] = items[0].get("branch")
                    captured["target_qty"] = items[0].get("target_quantity")
        print(f"Target schedule: {target_code}")

        # ---- 04 schedule row (screenshot showing the Complete button) ----
        # Change status filter to SCHEDULED to guarantee a row
        # Just screenshot current table view
        await page.wait_for_timeout(1000)
        # Try to scroll the table so a SCHEDULED row is visible
        await page.evaluate("""() => {
            const rows = Array.from(document.querySelectorAll('tr'));
            const scheduledRow = rows.find(r => r.querySelector('button') && r.textContent.includes('Complete'));
            if (scheduledRow) scheduledRow.scrollIntoView({block: 'center'});
        }""")
        await page.wait_for_timeout(500)
        await page.screenshot(path=str(OUT_DIR / "04_schedule_row.png"), full_page=False)
        print("✓ 04_schedule_row.png")

        # ---- Open Complete dialog by clicking the data-testid button ----
        schedule_id_sel = None
        if target_code:
            # Find the schedule ID using API
            import httpx
            async with httpx.AsyncClient() as client:
                login_r = await client.post(
                    f"{BASE_URL}/api/auth/login",
                    json={"email": "admin@factory.com", "password": "bidso123"},
                    timeout=30,
                )
                token = login_r.json().get("token") or login_r.json().get("access_token")
                r = await client.get(
                    f"{BASE_URL}/api/production-schedules?status=SCHEDULED&limit=100",
                    headers={"Authorization": f"Bearer {token}"},
                    timeout=30,
                )
                data = r.json() if r.status_code == 200 else []
                items = data if isinstance(data, list) else data.get("items", [])
                match = next((s for s in items if s.get("schedule_code") == target_code), None)
                if match:
                    schedule_id_sel = match.get("id")
                    captured["schedule_id"] = schedule_id_sel

        clicked = False
        if schedule_id_sel:
            sel = f'[data-testid="complete-btn-{schedule_id_sel}"]'
            try:
                # Make sure the row exists in DOM first
                exists = await page.locator(sel).count()
                if exists == 0:
                    # Scroll table to find the schedule row
                    await page.evaluate(f"""() => {{
                        const rows = Array.from(document.querySelectorAll('tr'));
                        const row = rows.find(r => r.textContent.includes('{target_code}'));
                        if (row) row.scrollIntoView({{block: 'center'}});
                    }}""")
                    await page.wait_for_timeout(800)
                await page.locator(sel).scroll_into_view_if_needed(timeout=5000)
                await page.click(sel, timeout=5000)
                clicked = True
            except Exception as e:
                print(f"Specific button click failed: {e}")

        if not clicked:
            # Fallback: click first visible "Complete" button
            btns = await page.locator('button:has-text("Complete")').all()
            for b in btns:
                try:
                    if await b.is_visible():
                        await b.scroll_into_view_if_needed()
                        await b.click()
                        clicked = True
                        break
                except Exception:
                    continue
        await page.wait_for_timeout(1500)

        # ---- 05 complete dialog ----
        await page.screenshot(path=str(OUT_DIR / "05_complete_dialog.png"), full_page=False)
        print("✓ 05_complete_dialog.png")

        # ---- 06 pre-check OK: click Check RM ----
        try:
            await page.click('[data-testid="precheck-rm-btn"]', timeout=5000)
            await page.wait_for_timeout(2500)
        except Exception as e:
            print(f"Check RM click failed: {e}")
        await page.screenshot(path=str(OUT_DIR / "06_precheck_ok.png"), full_page=False)
        print("✓ 06_precheck_ok.png")

        # ---- 07 pre-check shortage: set a huge quantity ----
        try:
            await page.fill('[data-testid="completed-qty-input"]', "999999")
            await page.click('[data-testid="precheck-rm-btn"]', timeout=3000)
            await page.wait_for_timeout(2500)
            await page.screenshot(path=str(OUT_DIR / "07_precheck_short.png"), full_page=False)
            print("✓ 07_precheck_short.png")
        except Exception as e:
            print(f"Shortage capture failed: {e}")

        # ---- Reset to actual quantity and pre-check again ----
        try:
            if captured.get("target_qty"):
                await page.fill('[data-testid="completed-qty-input"]', str(captured["target_qty"]))
                await page.click('[data-testid="precheck-rm-btn"]', timeout=3000)
                await page.wait_for_timeout(2500)
        except Exception as e:
            print(f"Reset qty failed: {e}")

        # ---- Close dialog (we don't actually complete — preview stock is depleted) ----
        try:
            await page.keyboard.press("Escape")
            await page.wait_for_timeout(1000)
        except Exception:
            pass

        # ---- Metadata: use an already-COMPLETED schedule for the "live flow" section ----
        try:
            import httpx
            async with httpx.AsyncClient() as client:
                login_r = await client.post(
                    f"{BASE_URL}/api/auth/login",
                    json={"email": "admin@factory.com", "password": "bidso123"},
                    timeout=30,
                )
                token = login_r.json().get("token") or login_r.json().get("access_token")
                r = await client.get(
                    f"{BASE_URL}/api/production-schedules?status=COMPLETED&limit=1",
                    headers={"Authorization": f"Bearer {token}"},
                    timeout=30,
                )
                data = r.json() if r.status_code == 200 else []
                items = data if isinstance(data, list) else data.get("items", [])
                if items:
                    done = items[0]
                    captured["schedule_code"] = done.get("schedule_code")
                    captured["sku_id"] = done.get("sku_id")
                    captured["branch"] = done.get("branch")
                    captured["target_qty"] = done.get("target_quantity")
                    captured["completed_qty"] = done.get("completed_quantity")
                    captured["completed_at"] = done.get("completed_at")
                    print(f"✓ Using completed schedule for metadata: {done.get('schedule_code')}")
        except Exception as e:
            print(f"Metadata fetch failed: {e}")

        # ---- 08 completed row ----
        # Refresh page so the status update is reflected
        await page.reload(wait_until="networkidle")
        await page.wait_for_timeout(2500)
        # Set custom date range again + filter Completed
        try:
            comboboxes = await page.locator('button[role="combobox"]').all()
            if comboboxes:
                await comboboxes[0].click()
                await page.wait_for_timeout(400)
                await page.locator('div[role="option"]:has-text("Custom")').click(timeout=3000)
                await page.wait_for_timeout(400)
            date_inputs = await page.locator('input[type="date"]').all()
            if len(date_inputs) >= 2:
                await date_inputs[0].fill("2026-01-01")
                await date_inputs[1].fill("2026-12-31")
            # Status select to Completed
            comboboxes = await page.locator('button[role="combobox"]').all()
            if len(comboboxes) >= 2:
                await comboboxes[-1].click()
                await page.wait_for_timeout(400)
                await page.locator('div[role="option"]:has-text("Completed")').click(timeout=3000)
                await page.wait_for_timeout(400)
            await page.click('button:has-text("Apply Filters")')
            await page.wait_for_timeout(2500)
        except Exception as e:
            print(f"Filter change failed: {e}")

        # Scroll to the completed row by schedule_code
        if target_code:
            await page.evaluate(f"""() => {{
                const rows = Array.from(document.querySelectorAll('tr'));
                const row = rows.find(r => r.textContent.includes('{target_code}'));
                if (row) row.scrollIntoView({{block: 'center'}});
            }}""")
            await page.wait_for_timeout(500)
        await page.screenshot(path=str(OUT_DIR / "08_completed_row.png"), full_page=False)
        print("✓ 08_completed_row.png")

        await browser.close()

    # Write metadata
    import json
    (OUT_DIR / "flow_metadata.json").write_text(json.dumps(captured, indent=2, default=str))
    print("\nFlow metadata:", captured)
    print(f"\nAll screenshots saved to {OUT_DIR}")


if __name__ == "__main__":
    asyncio.run(run())
