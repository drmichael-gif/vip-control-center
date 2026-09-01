#!/usr/bin/env python3
"""Static reconciliation guard for the Outbound Call Data prototype."""

from html.parser import HTMLParser
from pathlib import Path
import re
import sys

PAGE = Path(sys.argv[1] if len(sys.argv) > 1 else Path(__file__).parents[1] / "index.html").resolve()


class PanelParser(HTMLParser):
    def __init__(self):
        super().__init__()
        self.in_panel = False
        self.panel_depth = 0
        self.section = None
        self.in_tr = False
        self.in_td = False
        self.in_label = False
        self.cell = []
        self.row = []
        self.rows = {}
        self.sections = []
        self.labels = []
        self.labels_by_section = {}

    def handle_starttag(self, tag, attrs):
        attrs = dict(attrs)
        if tag == "div" and attrs.get("id") == "northstar-outbound-calls-panel":
            self.in_panel = True
            self.panel_depth = 1
            return
        if not self.in_panel:
            return
        if tag == "div":
            self.panel_depth += 1
        if tag == "section" and attrs.get("id", "").startswith("outbound-table-"):
            self.section = attrs["id"]
            self.sections.append(self.section)
            self.rows.setdefault(self.section, [])
            self.labels_by_section.setdefault(self.section, [])
        elif tag == "tr":
            self.in_tr = True
            self.row = []
        elif tag in ("td", "th") and self.in_tr:
            self.in_td = True
            self.cell = []
        elif tag == "span" and "label" in attrs.get("class", "").split():
            self.in_label = True

    def handle_endtag(self, tag):
        if not self.in_panel:
            return
        if tag == "span" and self.in_label:
            self.in_label = False
        elif tag in ("td", "th") and self.in_td:
            self.row.append(" ".join("".join(self.cell).split()))
            self.in_td = False
        elif tag == "tr" and self.in_tr:
            if self.section and self.row:
                self.rows[self.section].append(self.row)
            self.in_tr = False
        elif tag == "section":
            self.section = None
        if tag == "div":
            self.panel_depth -= 1
            if self.panel_depth == 0:
                self.in_panel = False

    def handle_data(self, data):
        if self.in_td:
            self.cell.append(data)
        if self.in_label and data.strip():
            self.labels.append(data.strip())
            if self.section:
                self.labels_by_section.setdefault(self.section, []).append(data.strip())


def number(value):
    value = value.replace(",", "").strip()
    return float(value[:-1]) if value.endswith("%") else float(value)


html = PAGE.read_text()
parser = PanelParser()
parser.feed(html)
failures = []


def check(condition, message):
    print(("PASS  " if condition else "FAIL  ") + message)
    if not condition:
        failures.append(message)


expected_sections = [
    "outbound-table-target", "outbound-table-delivery", "outbound-table-mode",
    "outbound-table-amd-agent", "outbound-table-amd-auto", "outbound-table-human",
    "outbound-table-auto-outcome", "outbound-table-auto-transfer", "outbound-table-abandon", "outbound-table-handled",
    "outbound-table-hold", "outbound-table-offers", "outbound-table-kpi",
]
check(all(s in parser.sections for s in expected_sections), "all connected outbound audit sections exist")
check(len(re.findall(r'<section[^>]+data-outbound-analytics', html)) == 1, "one outbound director analytics region")
check(all(hook in html for hook in ("data-outbound-trend", "data-outbound-heatmap", "data-outbound-jump-row=\"outbound-row-abandoned\"")), "director views link to the red source row")

# Every additive table preserves full period = office hours + non-office hours.
additive_rows = 0
for section, rows in parser.rows.items():
    if section == "outbound-table-kpi":
        continue
    for row in rows:
        if len(row) < 6 or row[1].lower() == "total":
            continue
        try:
            total, office, nonoffice = map(number, row[1:4])
        except ValueError:
            continue
        additive_rows += 1
        check(total == office + nonoffice, f"{section}: {row[0][:54]} full period equals time-band sum")
check(additive_rows >= 50, "checked at least 50 additive outbound rows")

# Parent/child control equations at the displayed grains.
equations = {
    "targeted recipient status": (12000, [11520, 360, 120]),
    "recipient exclusions": (360, [150, 90, 70, 50]),
    "send-attempt dispositions": (11520, [11300, 140, 80]),
    "voice delivery modes": (11300, [7600, 3700]),
    "agent-assisted AMD dispositions": (7600, [3040, 2080, 1260, 700, 315, 170, 35]),
    "automated AMD dispositions": (3700, [1480, 1020, 620, 350, 155, 60, 15]),
    "agent-assisted human-answer outcomes": (3040, [2860, 120, 60]),
    "automated human-answer outcomes": (1480, [720, 420, 280, 60]),
    "automated transfer outcomes": (420, [350, 60, 10]),
    "abandon duration bands": (120, [16, 24, 28, 26, 16, 10]),
    "connected terminal reasons": (2860, [1580, 810, 350, 120]),
    "hold status": (2860, [2350, 510]),
    "held frequency": (510, [410, 100]),
    "agent-offer attempts": (3100, [2860, 200, 40]),
}
for name, (parent, children) in equations.items():
    check(parent == sum(children), f"{name}: children reconcile to parent ({parent:,})")

# Source mappings must cover every non-control display metric in the connected tables.
native_block = re.search(r"const nativeSources=\{([\s\S]*?)\n  \};", html[html.index("const months=['Sep 25'"):])
derived_block = re.search(r"const derivedSources=\{([\s\S]*?)\n  \};", html[html.index("const months=['Sep 25'"):])
mapped = set()
for block in (native_block, derived_block):
    if block:
        mapped.update(re.findall(r"['\"]([^'\"]+)['\"]\s*:", block.group(1)))
connected_labels = {
    label
    for section, labels in parser.labels_by_section.items()
    if section != "outbound-table-kpi"
    for label in labels
}
unmapped = sorted({label for label in connected_labels if label not in {"Amazon provided", "Derived"} and "roll-up" not in label and not label.endswith("reconciliation") and label not in mapped})
check(not unmapped, "every connected-table metric has an Amazon or derived source mapping" + (f": {unmapped}" if unmapped else ""))

connector_ids = re.findall(r"\['(outbound-[^']+)','(outbound-[^']+)'", html)
connected_nodes = {node for pair in connector_ids for node in pair}
required_connector_nodes = {
    "outbound-delivery-voice-source", "outbound-mode-parent", "outbound-mode-agent", "outbound-agent-amd-parent",
    "outbound-mode-auto", "outbound-auto-amd-parent", "outbound-agent-human", "outbound-agent-human-parent",
    "outbound-auto-human", "outbound-auto-human-parent", "outbound-row-abandoned", "outbound-abandon-parent",
    "outbound-auto-transfer-request", "outbound-auto-transfer-parent", "outbound-agent-connected",
    "outbound-terminal-parent", "outbound-hold-parent", "outbound-offer-connected"
}
check(required_connector_nodes.issubset(connected_nodes), "all mode-fork and carry-forward populations have logical connector definitions")

panel_html = html[html.index('<div class="audit-tab-panel" id="northstar-outbound-calls-panel"'):html.index('</main>', html.index('<div class="audit-tab-panel" id="northstar-outbound-calls-panel"'))]
ids = re.findall(r'\bid="([^"]+)"', panel_html)
duplicates = sorted({x for x in ids if ids.count(x) > 1})
check(not duplicates, "no duplicate HTML ids" + (f": {duplicates}" if duplicates else ""))

print(f"\nOutbound flow audit: {PAGE}")
print("ALL CHECKS PASSED" if not failures else f"FAILED: {len(failures)} check(s)")
sys.exit(1 if failures else 0)
