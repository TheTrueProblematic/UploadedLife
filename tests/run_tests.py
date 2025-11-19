#!/usr/bin/env python3
import csv
import io
import re
import unittest
from pathlib import Path

PROJECT_ROOT = Path(__file__).resolve().parents[1]
PUBLIC_DIR = PROJECT_ROOT / "public"
INDEX_HTML = PUBLIC_DIR / "index.html"
SCRIPTS_JS = PUBLIC_DIR / "scripts.js"
SCENARIOS_CSV = PUBLIC_DIR / "Scenarios" / "scenarios.csv"
JOBS_CSV = PUBLIC_DIR / "Scenarios" / "jobs.csv"
INCIDENT_EVENTS_CSV = PUBLIC_DIR / "Scenarios" / "incident_events.csv"
GOOD_EVENTS_CSV = PUBLIC_DIR / "Scenarios" / "good_events.csv"
BAD_EVENTS_CSV = PUBLIC_DIR / "Scenarios" / "bad_events.csv"
HOBBY_OFFERS_CSV = PUBLIC_DIR / "Scenarios" / "hobby_offers.csv"


def _read_csv_rows(path: Path):
    reader = csv.DictReader(io.StringIO(path.read_text(encoding="utf-8")))
    return [row for row in reader if any((value or "").strip() for value in row.values())]


class SiteStructureTests(unittest.TestCase):
    maxDiff = None

    @classmethod
    def setUpClass(cls):
        cls.html = INDEX_HTML.read_text(encoding="utf-8")
        cls.scripts = SCRIPTS_JS.read_text(encoding="utf-8")

    def test_app_root_placeholder_exists(self):
        self.assertRegex(self.html, r'id="app-root"', msg="Expected #app-root container inside index.html")

    def test_iframe_removed(self):
        pattern = re.compile(r'<iframe[^>]+id="game-frame"', re.IGNORECASE)
        self.assertIsNone(pattern.search(self.html), msg="Legacy iframe shell should be removed")

    def test_pages_directory_removed(self):
        self.assertFalse((PUBLIC_DIR / "Pages").exists(), msg="public/Pages should not exist")

    def test_main_template_present(self):
        pattern = re.compile(r'<template[^>]+id="template-main"', re.IGNORECASE)
        self.assertIsNotNone(pattern.search(self.html), msg="template-main definition missing")

    def test_scenario_csv_contains_rows(self):
        self.assertTrue(SCENARIOS_CSV.exists(), msg="public/Scenarios/scenarios.csv missing")
        rows = _read_csv_rows(SCENARIOS_CSV)
        self.assertGreater(len(rows), 0, msg="scenarios.csv should contain at least one scenario row")

    def test_jobs_csv_contains_rows(self):
        self.assertTrue(JOBS_CSV.exists(), msg="public/Scenarios/jobs.csv missing")
        rows = _read_csv_rows(JOBS_CSV)
        self.assertGreater(len(rows), 0, msg="jobs.csv should contain at least one job row")

    def test_incident_events_csv_contains_rows(self):
        self.assertTrue(INCIDENT_EVENTS_CSV.exists(), msg="public/Scenarios/incident_events.csv missing")
        rows = _read_csv_rows(INCIDENT_EVENTS_CSV)
        self.assertGreater(len(rows), 0, msg="incident_events.csv should contain at least one row")

    def test_good_events_csv_contains_rows(self):
        self.assertTrue(GOOD_EVENTS_CSV.exists(), msg="public/Scenarios/good_events.csv missing")
        rows = _read_csv_rows(GOOD_EVENTS_CSV)
        self.assertGreater(len(rows), 0, msg="good_events.csv should contain at least one row")

    def test_bad_events_csv_contains_rows(self):
        self.assertTrue(BAD_EVENTS_CSV.exists(), msg="public/Scenarios/bad_events.csv missing")
        rows = _read_csv_rows(BAD_EVENTS_CSV)
        self.assertGreater(len(rows), 0, msg="bad_events.csv should contain at least one row")

    def test_hobby_offers_csv_contains_rows(self):
        self.assertTrue(HOBBY_OFFERS_CSV.exists(), msg="public/Scenarios/hobby_offers.csv missing")
        rows = _read_csv_rows(HOBBY_OFFERS_CSV)
        self.assertGreater(len(rows), 0, msg="hobby_offers.csv should contain at least one row")

    def test_host_initializes_before_scenario_promise(self):
        host_index = self.scripts.find("new UploadedLifeHost")
        promise_index = self.scripts.find("scenarioLibraryPromise.then")
        self.assertNotEqual(host_index, -1, msg="UploadedLifeHost instantiation missing in scripts.js")
        self.assertNotEqual(promise_index, -1, msg="scenarioLibraryPromise usage missing in scripts.js")
        self.assertLess(host_index, promise_index,
                        msg="UploadedLifeHost must initialize before waiting on scenario data to avoid blank loads")

    def test_script_includes_iframe_loader_fallback(self):
        self.assertRegex(
            self.scripts,
            r"function\s+loadTextViaIframe",
            msg="scripts.js should provide an iframe loading fallback for CSV data",
        )

    def test_loading_modal_flag_defined(self):
        self.assertIn(
            "scenarioLoadModalVisible",
            self.scripts,
            msg="scripts.js should track whether the loading modal is active",
        )

    def test_set_scenario_library_closes_loading_modal(self):
        pattern = re.compile(
            r"setScenarioLibrary[\s\S]+?closeModal\(",
            re.MULTILINE,
        )
        self.assertRegex(
            self.scripts,
            pattern,
            msg="setScenarioLibrary should close the loading modal when data arrives",
        )

    def test_embedded_scenario_rows_present(self):
        self.assertIn(
            "const embeddedScenarioRows",
            self.scripts,
            msg="scripts.js must include embedded scenario rows for offline fallback",
        )

    def test_embedded_datasets_present(self):
        for token in (
            "embeddedIncidentEvents",
            "embeddedGoodEvents",
            "embeddedBadEvents",
            "embeddedHobbyOffers",
        ):
            self.assertIn(token, self.scripts, msg=f"{token} should exist for offline fallbacks")

    def test_script_references_new_data_sources(self):
        for filename in (
            "incident_events.csv",
            "good_events.csv",
            "bad_events.csv",
            "hobby_offers.csv",
        ):
            self.assertIn(filename, self.scripts, msg=f"scripts.js should load {filename}")

    def test_parse_config_supports_objects(self):
        pattern = re.compile(
            r"parseScenarioConfig\(value\)\s*\{[\s\S]+?typeof value === 'object'",
            re.MULTILINE,
        )
        self.assertRegex(
            self.scripts,
            pattern,
            msg="parseScenarioConfig should handle object values (embedded fallback data)",
        )


if __name__ == "__main__":
    suite = unittest.defaultTestLoader.loadTestsFromTestCase(SiteStructureTests)
    runner = unittest.TextTestRunner(verbosity=2)
    result = runner.run(suite)
    if not result.wasSuccessful():
        raise SystemExit(1)
