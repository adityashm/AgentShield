"""
scripts/capture_ui_screenshots.py — Drives the AgentShield UI through Playwright and captures screenshot artifacts.
"""

import os
import sys
import time
from playwright.sync_api import sync_playwright

ARTIFACT_DIR = r"C:\Users\aditya\.gemini\antigravity\brain\08ee63f5-d278-4c35-a6e0-ddc337cf3b6d\screenshots"
os.makedirs(ARTIFACT_DIR, exist_ok=True)

PAGES = [
    ("login", "http://127.0.0.1:4173/login"),
    ("dashboard", "http://127.0.0.1:4173/"),
    ("onboarding", "http://127.0.0.1:4173/onboarding"),
    ("agents", "http://127.0.0.1:4173/agents"),
    ("agent_detail", "http://127.0.0.1:4173/agent/AGT-009"),
    ("alerts", "http://127.0.0.1:4173/alerts"),
    ("alerts_triage", "http://127.0.0.1:4173/alerts/triage/ALT-9921"),
    ("rules", "http://127.0.0.1:4173/rules"),
    ("logs", "http://127.0.0.1:4173/logs"),
    ("audit", "http://127.0.0.1:4173/audit"),
    ("settings", "http://127.0.0.1:4173/settings"),
]

def main():
    print("Launching Playwright Chromium...")
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        # Standard desktop mission control viewport
        context = browser.new_context(viewport={"width": 1440, "height": 900})
        page = context.new_page()

        for name, url in PAGES:
            print(f"Navigating to {name} ({url})...")
            try:
                page.goto(url, wait_until="networkidle", timeout=15000)
                time.sleep(0.5) # Allow CSS transitions and fonts to settle
                out_path = os.path.join(ARTIFACT_DIR, f"page_{name}.png")
                page.screenshot(path=out_path, full_page=False)
                print(f"  [OK] Saved screenshot to: {out_path}")
            except Exception as exc:
                print(f"  [ERROR] Failed to capture {name}: {exc}")

        browser.close()
    print("Completed capturing UI screenshots.")

if __name__ == "__main__":
    main()
