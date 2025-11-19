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
        reader = csv.DictReader(io.StringIO(SCENARIOS_CSV.read_text(encoding="utf-8")))
        rows = [row for row in reader if any((value or '').strip() for value in row.values())]
        self.assertGreater(len(rows), 0, msg="scenarios.csv should contain at least one scenario row")

    def test_jobs_csv_contains_rows(self):
        self.assertTrue(JOBS_CSV.exists(), msg="public/Scenarios/jobs.csv missing")
        reader = csv.DictReader(io.StringIO(JOBS_CSV.read_text(encoding="utf-8")))
        rows = [row for row in reader if any((value or '').strip() for value in row.values())]
        self.assertGreater(len(rows), 0, msg="jobs.csv should contain at least one job row")

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
