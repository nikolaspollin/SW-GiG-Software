# Product backlog -> Trello import

Imports the `PB Items` sheet of `../SE_GiG_ProductBacklog.xlsx` (header in row 5, data from row 6) as cards
into the `Backlog` list of a Trello board.

## Setup

```bash
cd misc/trello-import
python3 -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
export TRELLO_KEY=...     # https://trello.com/power-ups/admin -> your Power-Up -> API key
export TRELLO_TOKEN=...   # generate a token from the same page ("Token" link next to the API key)
```

Keep key and token out of the repository (environment variables only).

## Run

```bash
# 1. offline preview of the cards (no credentials, nothing is sent anywhere)
python import_backlog.py --dry-run -v --limit 3

# 2. preview against the real board (read-only lookups: list, labels, members, existing cards)
python import_backlog.py --board https://trello.com/b/<shortlink>/<name> --dry-run

# 3. try with a few cards, then everything
python import_backlog.py --board https://trello.com/b/<shortlink>/<name> --limit 3
python import_backlog.py --board https://trello.com/b/<shortlink>/<name>
```

Re-running is safe: stories whose ID (`US01`, ...) already appears in a card title on the board are skipped.
Options: `--list` (default `Backlog`), `--sheet`, `--file`, `--owner-map owners.json`.

## Mapping

| Sheet column                          | Trello                                                              |
|---------------------------------------|---------------------------------------------------------------------|
| A `ID`, B `Feature ID`, G action      | card title: `US01 (F01): <I want to be able to...>`                 |
| C-E `Feature Type`, `Additional Type` | labels, all equal (empty cells skipped; cool colours, no red/orange/yellow) |
| F-H `As a... / I want... / So that...`| top of the description, with the column names as captions           |
| I `Priority (MoSCoW)`                 | colour coded label (Must = red, Should = orange, Could = yellow) + description |
| J `Sprint-ID`, M `Estimation (SP)`    | description meta line (`SPRINT_AS_LABEL` in the script adds a label)|
| K `Status`                            | not stored (everything lands in the `Backlog` list)                 |
| L `Tasks / Owner`                     | first line = owner -> card member; rest = `Tasks` section           |
| N `Acceptance Criteria`               | bottom of the description                                           |

## Owners / members

Cards can only be assigned to people who are **members of the board** (they need a Trello account, but
no e-mail address has to be given to the script). The script matches the owner name from the sheet to a board
member by username or first name. Owners it cannot match (not on the board, ambiguous) are listed at the end;
the card is still created and names the owner in its description. For unusual usernames use a map file:

```json
{ "Timo": "timo_trello_username", "Basti": "sebastian123" }
```

## Tests

```bash
python -m unittest -v
```

The tests use the real xlsx file and an in-memory fake of the Trello API (no network, no credentials).
