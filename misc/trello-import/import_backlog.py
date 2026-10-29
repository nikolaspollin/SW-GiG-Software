#!/usr/bin/env python3
"""Import the GiG product backlog ('PB Items' sheet of the xlsx file) into a Trello list.

One backlog row becomes one Trello card:

* title        ->  "US01 (F01): <I want to be able to...>"
* labels       ->  Feature Type / Additional Type 1 / Additional Type 2 (empty ones are skipped)
                   + the MoSCoW priority (colour coded, see PRIORITY_COLORS)
* members      ->  the owner (first line of "Tasks / Owner"), if a matching board member exists
* description  ->  user story template, metadata (feature, priority, sprint, estimation, owner),
                   task description, acceptance criteria

Credentials are read from the environment (never put them into the repository):
    TRELLO_KEY, TRELLO_TOKEN

Usage:
    python import_backlog.py --dry-run                      # offline preview, no credentials needed
    python import_backlog.py --board https://trello.com/b/<shortlink>/<name> --dry-run   # + read-only lookups
    python import_backlog.py --board https://trello.com/b/<shortlink>/<name>             # real import

Re-running is safe: cards whose story ID (e.g. "US01") already exists on the board are skipped.
"""

from __future__ import annotations

import argparse
import json
import os
import re
import sys
import time
import warnings
from dataclasses import dataclass, field
from pathlib import Path

DEFAULT_XLSX = Path(__file__).resolve().parent / "SE_GiG_ProductBacklog.xlsx"
DEFAULT_SHEET = "PB Items"
DEFAULT_LIST = "Backlog"
HEADER_ROW = 5  # 1-based row number of the header line in the sheet

TRELLO_API = "https://api.trello.com/1"

# Header texts of the sheet (used to locate the columns and as captions in the card description).
H_ID = "ID"
H_FEATURE = "Feature ID"
H_TYPES = ("Feature Type", "Additional Type 1", "Additional Type 2")
H_PERSONA = "As a..."
H_ACTION = "I want to be able to..."
H_VALUE = "So that..."
H_PRIORITY = "Priority (MoSCoW)"
H_SPRINT = "Sprint-ID"
H_TASKS = "Tasks / Owner"
H_ESTIMATION = "Estimation (SP)"
H_ACCEPTANCE = "Acceptance Criteria"
REQUIRED_HEADERS = (
    H_ID, H_FEATURE, *H_TYPES, H_PERSONA, H_ACTION, H_VALUE, H_PRIORITY,
    H_SPRINT, H_TASKS, H_ESTIMATION, H_ACCEPTANCE,
)

# MoSCoW priority -> Trello label colour. Warm colours are reserved for priorities,
# type labels use the cooler colours in TYPE_COLORS so both are easy to tell apart.
PRIORITY_COLORS = {
    "must have": "red",
    "should have": "orange",
    "could have": "yellow",
    "won't have": "black",
    "wont have": "black",
}
TYPE_COLORS = ["blue", "sky", "green", "lime", "purple", "pink", "black"]

# Put the sprint on the card as a label ("Sprint 3") in addition to the description line.
SPRINT_AS_LABEL = False
SPRINT_LABEL_COLOR = "green"

OWNER_SPLIT = re.compile(r"\s*(?:,|/|&|\+|;|\band\b|\bund\b)\s*", re.IGNORECASE)


# --------------------------------------------------------------------------- reading the sheet


@dataclass
class BacklogItem:
    story_id: str
    feature_id: str
    types: list[str]
    persona: str
    action: str
    value: str
    priority: str
    sprint: str
    owners: list[str]
    task: str
    estimation: str
    acceptance: str
    row: int = 0
    warnings: list[str] = field(default_factory=list)


def _text(value) -> str:
    """Cell value -> clean string ('' for empty cells, 5.0 -> '5')."""
    if value is None:
        return ""
    if isinstance(value, float) and value.is_integer():
        value = int(value)
    return str(value).replace("\r\n", "\n").replace("\r", "\n").strip()


def split_owner_and_task(raw: str) -> tuple[list[str], str]:
    """'Timo\\nStaff entities, CRUD ...' -> (['Timo'], 'Staff entities, CRUD ...')."""
    if "\n" not in raw:
        return [], raw
    first, rest = raw.split("\n", 1)
    owners = [o.strip() for o in OWNER_SPLIT.split(first) if o.strip()]
    return owners, rest.strip()


def read_backlog(path: Path, sheet: str = DEFAULT_SHEET, header_row: int = HEADER_ROW) -> list[BacklogItem]:
    import openpyxl  # imported lazily so that --help works without the dependency

    with warnings.catch_warnings():
        warnings.simplefilter("ignore")  # openpyxl complains about the table's print area
        workbook = openpyxl.load_workbook(path, data_only=True, read_only=False)
    if sheet not in workbook.sheetnames:
        raise SystemExit(f"Sheet '{sheet}' not found in {path}. Available: {workbook.sheetnames}")
    ws = workbook[sheet]

    columns: dict[str, int] = {}
    for col in range(1, ws.max_column + 1):
        header = _text(ws.cell(header_row, col).value)
        if header:
            columns[header] = col
    missing = [h for h in REQUIRED_HEADERS if h not in columns]
    if missing:
        raise SystemExit(f"Header row {header_row} of '{sheet}' is missing columns: {missing}")

    def cell(row: int, header: str) -> str:
        return _text(ws.cell(row, columns[header]).value)

    items: list[BacklogItem] = []
    for row in range(header_row + 1, ws.max_row + 1):
        story_id = cell(row, H_ID)
        if not story_id:
            continue  # blank / spacer row
        owners, task = split_owner_and_task(cell(row, H_TASKS))
        item = BacklogItem(
            story_id=story_id,
            feature_id=cell(row, H_FEATURE),
            types=_unique(cell(row, h) for h in H_TYPES),
            persona=cell(row, H_PERSONA),
            action=cell(row, H_ACTION),
            value=cell(row, H_VALUE),
            priority=cell(row, H_PRIORITY),
            sprint=cell(row, H_SPRINT),
            owners=owners,
            task=task,
            estimation=cell(row, H_ESTIMATION),
            acceptance=cell(row, H_ACCEPTANCE),
            row=row,
        )
        if not owners:
            item.warnings.append("no owner found (expected 'Owner<line break>task description')")
        if not item.action:
            item.warnings.append(f"empty '{H_ACTION}', using the story ID as card title")
        items.append(item)

    duplicates = {i.story_id for i in items if sum(o.story_id == i.story_id for o in items) > 1}
    if duplicates:
        raise SystemExit(f"Duplicate story IDs in the sheet: {sorted(duplicates)}")
    return items


def _unique(values) -> list[str]:
    seen: dict[str, None] = {}
    for value in values:
        if value and value.casefold() not in {k.casefold() for k in seen}:
            seen[value] = None
    return list(seen)


# --------------------------------------------------------------------------- building the card


def card_title(item: BacklogItem) -> str:
    prefix = f"{item.story_id} ({item.feature_id})" if item.feature_id else item.story_id
    return f"{prefix}: {item.action}" if item.action else prefix


def card_description(item: BacklogItem) -> str:
    lines = []
    for caption, value in ((H_PERSONA, item.persona), (H_ACTION, item.action), (H_VALUE, item.value)):
        lines.append(f"**{caption}** {value}".rstrip())

    meta = []
    if item.feature_id:
        meta.append(f"**Feature:** {item.feature_id}")
    if item.priority:
        meta.append(f"**Priority:** {item.priority}")
    if item.sprint:
        meta.append(f"**Sprint:** {item.sprint}")
    if item.estimation:
        meta.append(f"**{H_ESTIMATION}:** {item.estimation}")
    if item.owners:
        meta.append(f"**Owner:** {', '.join(item.owners)}")

    parts = ["\n".join(lines)]
    if meta:
        parts.append("---\n" + " | ".join(meta))
    if item.task:
        parts.append(f"**Tasks**\n{item.task}")
    if item.acceptance:
        parts.append(f"**{H_ACCEPTANCE}**\n{item.acceptance}")
    return "\n\n".join(parts)


def label_specs(item: BacklogItem, type_colors: dict[str, str]) -> list[tuple[str, str]]:
    """(name, colour) for every label the card should carry."""
    specs = [(t, type_colors[t.casefold()]) for t in item.types]
    if item.priority:
        specs.append((item.priority, PRIORITY_COLORS.get(item.priority.casefold(), "orange")))
    if SPRINT_AS_LABEL and item.sprint:
        specs.append((f"Sprint {item.sprint}", SPRINT_LABEL_COLOR))
    return specs


def assign_type_colors(items: list[BacklogItem]) -> dict[str, str]:
    """Stable colour per type label: in order of first appearance, cycling through TYPE_COLORS."""
    colors: dict[str, str] = {}
    for item in items:
        for t in item.types:
            colors.setdefault(t.casefold(), TYPE_COLORS[len(colors) % len(TYPE_COLORS)])
    return colors


# --------------------------------------------------------------------------- Trello access


class TrelloError(RuntimeError):
    pass


class TrelloClient:
    """Minimal Trello REST client (key/token auth, throttling, retry on HTTP 429)."""

    def __init__(self, key: str, token: str, min_interval: float = 0.15):
        import requests

        self._requests = requests
        self._session = requests.Session()
        self._auth = {"key": key, "token": token}
        self._min_interval = min_interval
        self._last_call = 0.0

    def request(self, method: str, path: str, params: dict | None = None, data: dict | None = None):
        for attempt in range(5):
            wait = self._min_interval - (time.monotonic() - self._last_call)
            if wait > 0:
                time.sleep(wait)
            self._last_call = time.monotonic()
            response = self._session.request(
                method,
                f"{TRELLO_API}{path}",
                params={**self._auth, **(params or {})},
                data=data,
                timeout=30,
            )
            if response.status_code == 429:
                time.sleep(float(response.headers.get("Retry-After", 2 * (attempt + 1))))
                continue
            if not response.ok:
                raise TrelloError(f"{method} {path} -> HTTP {response.status_code}: {response.text[:300]}")
            return response.json()
        raise TrelloError(f"{method} {path} -> still rate limited after several retries")

    def get(self, path, **params):
        return self.request("GET", path, params=params)

    def post(self, path, **data):
        return self.request("POST", path, data=data)


def board_ref(value: str) -> str:
    """Accept a board URL, short link or board id."""
    match = re.search(r"/b/([A-Za-z0-9]+)", value)
    return match.group(1) if match else value.strip()


class Board:
    """Everything the import needs to know about the target board (lists, labels, members, cards)."""

    def __init__(self, client: TrelloClient, ref: str):
        self.client = client
        info = client.get(f"/boards/{ref}", fields="name,id,url")
        self.id, self.name, self.url = info["id"], info["name"], info["url"]
        self.lists = client.get(f"/boards/{self.id}/lists", filter="open", fields="name")
        self.labels = client.get(f"/boards/{self.id}/labels", fields="name,color", limit=1000)
        self.members = client.get(f"/boards/{self.id}/members", fields="fullName,username")
        self.cards = client.get(f"/boards/{self.id}/cards", filter="open", fields="name,idList")

    def find_list(self, name: str) -> dict:
        matches = [lst for lst in self.lists if lst["name"].strip().casefold() == name.strip().casefold()]
        if not matches:
            raise SystemExit(
                f"List '{name}' not found on board '{self.name}'. Open lists: {[l['name'] for l in self.lists]}"
            )
        return matches[0]

    def existing_story_ids(self) -> set[str]:
        ids = set()
        for card in self.cards:
            match = re.match(r"\s*(US\d+)\b", card["name"], re.IGNORECASE)
            if match:
                ids.add(match.group(1).upper())
        return ids

    def label_id(self, name: str, color: str, create: bool) -> str | None:
        for label in self.labels:
            if label["name"].strip().casefold() == name.casefold():
                return label["id"]
        if not create:
            return None
        label = self.client.post("/labels", name=name, color=color, idBoard=self.id)
        self.labels.append(label)
        return label["id"]


def resolve_owner(owner: str, members: list[dict], owner_map: dict[str, str]) -> tuple[str | None, str]:
    """Find the Trello member for an owner name. Returns (member id or None, explanation)."""
    wanted = owner_map.get(owner, owner).strip().lstrip("@").casefold()

    exact = [m for m in members if wanted in (m["username"].casefold(), m["id"].casefold(),
                                              m["fullName"].strip().casefold())]
    if len(exact) == 1:
        return exact[0]["id"], f"{exact[0]['fullName']} (@{exact[0]['username']})"

    def first_name(member):
        return (member["fullName"].split() or [""])[0].casefold()

    loose = [m for m in members if wanted == first_name(m) or m["username"].casefold().startswith(wanted)]
    if len(loose) == 1:
        return loose[0]["id"], f"{loose[0]['fullName']} (@{loose[0]['username']})"
    if len(loose) > 1 or len(exact) > 1:
        return None, "ambiguous, add it to the owner map"
    return None, "no board member found"


# --------------------------------------------------------------------------- main


def load_owner_map(path: str | None) -> dict[str, str]:
    if not path:
        return {}
    with open(path, encoding="utf-8") as handle:
        return json.load(handle)


def run(args: argparse.Namespace, client: TrelloClient | None = None, out=print) -> int:
    items = read_backlog(Path(args.file), args.sheet)
    if args.limit:
        items = items[: args.limit]
    type_colors = assign_type_colors(items)
    owner_map = load_owner_map(args.owner_map)
    out(f"Read {len(items)} backlog items from '{args.sheet}' in {args.file}")

    board = None
    if args.board:
        if client is None:
            key, token = os.environ.get("TRELLO_KEY"), os.environ.get("TRELLO_TOKEN")
            if not key or not token:
                if not args.dry_run:
                    raise SystemExit("Set the environment variables TRELLO_KEY and TRELLO_TOKEN first.")
                out("TRELLO_KEY / TRELLO_TOKEN not set -> offline dry run, owners and labels are not looked up.")
            else:
                client = TrelloClient(key, token)
        if client is not None:
            board = Board(client, board_ref(args.board))
            out(f"Board: {board.name} ({board.url})")
    elif not args.dry_run:
        raise SystemExit("--board is required for a real import (use --dry-run for an offline preview).")

    target_list = board.find_list(args.list) if board else None
    already_there = board.existing_story_ids() if board else set()
    member_cache: dict[str, str | None] = {}
    unmatched: dict[str, str] = {}

    created = skipped = 0
    for item in items:
        for warning in item.warnings:
            out(f"  ! {item.story_id} (row {item.row}): {warning}")
        if item.story_id.upper() in already_there:
            out(f"  = {item.story_id}: already on the board, skipped")
            skipped += 1
            continue

        member_ids = []
        if board:
            for owner in item.owners:
                if owner not in member_cache:
                    member_cache[owner], why = resolve_owner(owner, board.members, owner_map)
                    if member_cache[owner] is None:
                        unmatched[owner] = why
                if member_cache[owner]:
                    member_ids.append(member_cache[owner])

        specs = label_specs(item, type_colors)
        title, description = card_title(item), card_description(item)

        if args.dry_run:
            out(f"  + {title}")
            out(f"      labels : {[name for name, _ in specs]}")
            out(f"      owner  : {item.owners or '-'}"
                + ("" if not board else f" -> {'assigned' if member_ids else 'NOT matched (only in description)'}"))
            if args.verbose:
                out("      " + description.replace("\n", "\n      "))
            created += 1
            continue

        label_ids = [board.label_id(name, color, create=True) for name, color in specs]
        card = board.client.post(
            "/cards",
            idList=target_list["id"],
            name=title,
            desc=description,
            pos="bottom",
            idLabels=",".join(label_ids),
            idMembers=",".join(member_ids),
        )
        out(f"  + {item.story_id}: {card.get('shortUrl', card.get('id'))}")
        created += 1

    verb = "would be created" if args.dry_run else "created"
    out(f"\n{created} card(s) {verb}, {skipped} skipped (already on the board).")
    if unmatched:
        out("Owners that could not be linked to a Trello member (they are still named in the card description):")
        for owner, why in unmatched.items():
            out(f"  - {owner}: {why}")
        out("  -> invite them to the board, or map them via --owner-map (JSON: {\"Timo\": \"trello_username\"}).")
    return 0


def parse_args(argv=None) -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Import the product backlog xlsx into a Trello list.")
    parser.add_argument("--file", default=str(DEFAULT_XLSX), help="path to the xlsx file (default: %(default)s)")
    parser.add_argument("--sheet", default=DEFAULT_SHEET, help="sheet name (default: %(default)s)")
    parser.add_argument("--board", help="Trello board URL, short link or id")
    parser.add_argument("--list", default=DEFAULT_LIST, help="target list name (default: %(default)s)")
    parser.add_argument("--owner-map", help="JSON file mapping sheet owner names to Trello usernames")
    parser.add_argument("--limit", type=int, help="only process the first N items (handy for a first test run)")
    parser.add_argument("--dry-run", action="store_true", help="show what would happen, create nothing")
    parser.add_argument("--verbose", "-v", action="store_true", help="with --dry-run: print full descriptions")
    return parser.parse_args(argv)


if __name__ == "__main__":
    try:
        sys.exit(run(parse_args()))
    except TrelloError as error:
        sys.exit(f"Trello error: {error}")
