"""Stable-only check of the coverage already collected with backend tests."""
import pathlib
import xml.etree.ElementTree as ET

baseline = float(pathlib.Path('scripts/backend-coverage-baseline.txt').read_text().splitlines()[0])
actual = round(float(ET.parse('artifacts/process-next/backend-coverage.xml').getroot().get('line-rate')) * 100, 1)
print(f'Backend coverage: {actual}% (baseline {baseline}%, existing rounding allowance 0.1 pp)')
raise SystemExit(0 if actual >= baseline - 0.1 else 1)
