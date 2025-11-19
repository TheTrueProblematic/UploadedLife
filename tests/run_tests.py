#!/usr/bin/env python3
import re
import unittest
from pathlib import Path

PROJECT_ROOT = Path(__file__).resolve().parents[1]
PUBLIC_DIR = PROJECT_ROOT / "public"
INDEX_HTML = PUBLIC_DIR / "index.html"
SCRIPTS_JS = PUBLIC_DIR / "scripts.js"
LIBRARY_JSON = PUBLIC_DIR / "Scenarios" / "library.json"


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

    def test_library_json_contains_datasets(self):
        self.assertTrue(LIBRARY_JSON.exists(), msg="public/Scenarios/library.json missing")
        data = LIBRARY_JSON.read_text(encoding="utf-8")
        self.assertIn('"scenarios": [', data, msg="library.json missing scenarios array")
        self.assertIn('"jobs": [', data, msg="library.json missing jobs array")
        self.assertIn('"incidentEvents": [', data, msg="library.json missing incidentEvents array")
        self.assertIn('"goodEvents": [', data, msg="library.json missing goodEvents array")
        self.assertIn('"badEvents": [', data, msg="library.json missing badEvents array")
        self.assertIn('"hobbyOffers": [', data, msg="library.json missing hobbyOffers array")

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
            msg="scripts.js should provide an iframe loading fallback for dataset files",
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

    def test_script_references_library_json(self):
        self.assertIn(
            "Scenarios/library.json",
            self.scripts,
            msg="scripts.js should load the consolidated library.json dataset",
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
