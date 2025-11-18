#!/usr/bin/env python3
import re
import unittest
from pathlib import Path

PROJECT_ROOT = Path(__file__).resolve().parents[1]
PUBLIC_DIR = PROJECT_ROOT / "public"
INDEX_HTML = PUBLIC_DIR / "index.html"


class SiteStructureTests(unittest.TestCase):
    maxDiff = None

    @classmethod
    def setUpClass(cls):
        cls.html = INDEX_HTML.read_text(encoding="utf-8")

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


if __name__ == "__main__":
    suite = unittest.defaultTestLoader.loadTestsFromTestCase(SiteStructureTests)
    runner = unittest.TextTestRunner(verbosity=2)
    result = runner.run(suite)
    if not result.wasSuccessful():
        raise SystemExit(1)
