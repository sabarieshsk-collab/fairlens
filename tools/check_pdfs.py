#!/usr/bin/env python3
"""
Check PDFs in demo-resumes/ for extractable text.
Usage: python tools/check_pdfs.py
Requires: PyPDF2 (pip install PyPDF2)
"""
import os
from pathlib import Path
from PyPDF2 import PdfReader

ROOT = Path(__file__).resolve().parents[1]
DEMOS = ROOT / 'demo-resumes'

if not DEMOS.exists():
    print('demo-resumes/ not found')
    raise SystemExit(1)

files = sorted(DEMOS.glob('*.pdf'))
if not files:
    print('No PDF files found in demo-resumes/')
    raise SystemExit(1)

print(f'Found {len(files)} PDF(s) in demo-resumes/')

for f in files:
    try:
        reader = PdfReader(str(f))
        text = []
        for p in reader.pages:
            try:
                t = p.extract_text() or ''
            except Exception:
                t = ''
            text.append(t)
        joined = '\n'.join(text).strip()
        if len(joined) >= 30:
            sample = '\n'.join(joined.splitlines()[:10])
            print(f'OK: {f.name} — extracted approx {len(joined)} chars')
            print('---- sample ----')
            print(sample)
            print('----------------')
        else:
            print(f'NO TEXT: {f.name} — likely scanned image PDF or extraction failed')
    except Exception as e:
        print(f'ERROR reading {f.name}: {e}')

print('\nIf many files report NO TEXT, run OCR with Tesseract:')
print('tesseract input.pdf output pdf  # writes output.pdf (searchable)')
print('Or install PyPDF2 and try again after converting PDFs to digital text.')
