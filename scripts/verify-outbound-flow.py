#!/usr/bin/env python3
"""Compatibility entry point for the current outbound verification suite."""
from pathlib import Path
import subprocess
raise SystemExit(subprocess.call(["node", str(Path(__file__).resolve().with_name("verify-outbound-charts.cjs"))]))
