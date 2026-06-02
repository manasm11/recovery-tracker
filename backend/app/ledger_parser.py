"""Parse pasted ledger text and classify entries as DEBIT or CREDIT.

The report format has:
- Header/footer lines (company name, address, column labels, page numbers)
- Entry lines: CUSTOMER_NAME LOCATION AMOUNT
- SUB-TOTAL lines with cumulative DEBIT and CREDIT sums
- GRAND TOTAL line

We use the SUB-TOTAL lines as checkpoints to figure out which individual
entries are CREDIT (since column alignment is lost when copy-pasting).
"""

from __future__ import annotations

import re
from dataclasses import dataclass, field

# Lines matching any of these patterns are not customer entries.
_SKIP_PATTERNS: list[re.Pattern[str]] = [
    re.compile(p, re.IGNORECASE)
    for p in [
        r"^\s*$",
        r"DURGA DAWA GHAR \(PARTNER\)",
        r"PURANI DAL MANDI",
        r"KANPUR-\d+",
        r"FINANCIAL YEAR",
        r"LEDGER ACCOUNTS UPTO",
        r"PARTICULARS\s+CLOSING",
        r"^\s*DEBIT\s+CREDIT\s*$",
        r"Page No\s*[.:]",
        r"Difference in Opening Balance",
    ]
]

_AMOUNT_RE = re.compile(r"^(.+?)\s+(\d[\d,]*\.\d{2})\s*$")
_SUBTOTAL_RE = re.compile(r"^SUB-TOTAL\s+(\d[\d,]*\.\d{2})\s+(\d[\d,]*\.\d{2})\s*$")
_GRAND_RE = re.compile(r"^GRAND TOTAL\s+(\d[\d,]*\.\d{2})\s+(\d[\d,]*\.\d{2})\s*$")


def _parse_amount(s: str) -> float:
    return float(s.replace(",", ""))


@dataclass
class LedgerEntry:
    name: str
    amount: float
    is_credit: bool = False


@dataclass
class ImportSummary:
    debit_entries: list[LedgerEntry] = field(default_factory=list)
    credit_entries: list[LedgerEntry] = field(default_factory=list)
    total_parsed: int = 0


def _is_skip_line(line: str) -> bool:
    return any(p.search(line) for p in _SKIP_PATTERNS)


def _find_credit_indices(amounts: list[float], target: float, tol: float = 0.10) -> set[int]:
    """Find a small subset of indices whose amounts sum to *target* (within *tol*)."""
    n = len(amounts)

    # Single
    for i in range(n):
        if abs(amounts[i] - target) < tol:
            return {i}

    # Pair
    for i in range(n):
        for j in range(i + 1, n):
            if abs(amounts[i] + amounts[j] - target) < tol:
                return {i, j}

    # Triple
    for i in range(n):
        for j in range(i + 1, n):
            s2 = amounts[i] + amounts[j]
            if s2 > target + tol:
                continue
            for k in range(j + 1, n):
                if abs(s2 + amounts[k] - target) < tol:
                    return {i, j, k}

    # Quad
    for i in range(n):
        for j in range(i + 1, n):
            s2 = amounts[i] + amounts[j]
            if s2 > target + tol:
                continue
            for k in range(j + 1, n):
                s3 = s2 + amounts[k]
                if s3 > target + tol:
                    continue
                for el in range(k + 1, n):
                    if abs(s3 + amounts[el] - target) < tol:
                        return {i, j, k, el}

    return set()


def parse_ledger(text: str) -> ImportSummary:
    """Parse a pasted ledger report and return classified entries."""
    lines = text.strip().split("\n")

    pages: list[dict] = []
    current_entries: list[LedgerEntry] = []
    prev_debit = 0.0
    prev_credit = 0.0

    for raw_line in lines:
        line = raw_line.strip()

        if _is_skip_line(line):
            continue

        # GRAND TOTAL — process as final page boundary
        m = _GRAND_RE.match(line)
        if m:
            debit = _parse_amount(m.group(1))
            credit = _parse_amount(m.group(2))
            pages.append(
                {
                    "entries": list(current_entries),
                    "page_debit": debit - prev_debit,
                    "page_credit": credit - prev_credit,
                }
            )
            current_entries = []
            continue

        # SUB-TOTAL — page boundary
        m = _SUBTOTAL_RE.match(line)
        if m:
            debit = _parse_amount(m.group(1))
            credit = _parse_amount(m.group(2))
            pages.append(
                {
                    "entries": list(current_entries),
                    "page_debit": debit - prev_debit,
                    "page_credit": credit - prev_credit,
                }
            )
            prev_debit = debit
            prev_credit = credit
            current_entries = []
            continue

        # Customer entry
        m = _AMOUNT_RE.match(line)
        if m:
            name = m.group(1).strip()
            amount = _parse_amount(m.group(2))
            current_entries.append(LedgerEntry(name=name, amount=amount))

    # Remaining entries without a trailing SUB-TOTAL
    if current_entries:
        pages.append(
            {
                "entries": current_entries,
                "page_debit": sum(e.amount for e in current_entries),
                "page_credit": 0.0,
            }
        )

    # Classify entries per page using SUB-TOTAL checkpoints
    summary = ImportSummary()
    for page in pages:
        entries: list[LedgerEntry] = page["entries"]
        credit_target: float = page["page_credit"]

        if credit_target < 0.01 or not entries:
            summary.debit_entries.extend(entries)
            summary.total_parsed += len(entries)
            continue

        amounts = [e.amount for e in entries]
        credit_idx = _find_credit_indices(amounts, credit_target)

        for i, entry in enumerate(entries):
            if i in credit_idx:
                entry.is_credit = True
                summary.credit_entries.append(entry)
            else:
                summary.debit_entries.append(entry)
        summary.total_parsed += len(entries)

    return summary
