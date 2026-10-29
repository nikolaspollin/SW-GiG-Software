"""Tests for import_backlog.py (run: python -m unittest -v, inside misc/trello-import).

The Trello API is replaced by an in-memory fake, the xlsx file is the real product backlog.
"""

import argparse
import unittest

import import_backlog as ib


class FakeTrello:
    """Just enough of the Trello REST API for Board + run()."""

    def __init__(self, members=None, lists=("Backlog", "Doing"), cards=()):
        self.members = members if members is not None else [
            {"id": "m1", "fullName": "Timo Muster", "username": "timo_m"},
            {"id": "m2", "fullName": "Niki Beispiel", "username": "nikib"},
        ]
        self.lists = [{"id": f"l{i}", "name": n} for i, n in enumerate(lists)]
        self.labels = []
        self.cards = [dict(c) for c in cards]
        self.created_cards = []

    def get(self, path, **params):
        # like a real API: always hand out fresh copies, never the internal lists
        if path.endswith("/lists"):
            return list(self.lists)
        if path.endswith("/labels"):
            return list(self.labels)
        if path.endswith("/members"):
            return list(self.members)
        if path.endswith("/cards"):
            return list(self.cards)
        return {"id": "b1", "name": "GiG", "url": "https://trello.com/b/abc/gig"}

    def post(self, path, **data):
        if path == "/labels":
            label = {"id": f"lab{len(self.labels)}", "name": data["name"], "color": data["color"]}
            self.labels.append(label)
            return label
        if path == "/cards":
            card = {"id": f"c{len(self.created_cards)}", **data}
            self.created_cards.append(card)
            self.cards.append({"name": data["name"], "idList": data["idList"]})
            return card
        raise AssertionError(path)


def args(**overrides):
    base = dict(file=str(ib.DEFAULT_XLSX), sheet=ib.DEFAULT_SHEET, board="https://trello.com/b/abc/gig",
                list="Backlog", owner_map=None, limit=None, dry_run=False, verbose=False)
    base.update(overrides)
    return argparse.Namespace(**base)


class ParsingTest(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.items = ib.read_backlog(ib.DEFAULT_XLSX)

    def test_reads_all_rows_6_to_50(self):
        self.assertEqual(len(self.items), 45)
        self.assertEqual((self.items[0].story_id, self.items[0].row), ("US01", 6))
        self.assertEqual((self.items[-1].story_id, self.items[-1].row), ("US45", 50))

    def test_owner_is_first_line_and_removed_from_task(self):
        first = self.items[0]
        self.assertEqual(first.owners, ["Timo"])
        self.assertTrue(first.task.startswith("Staff/Role entities"))
        self.assertEqual({o for i in self.items for o in i.owners}, {"Timo", "Niki", "Paul", "Basti", "Johannes"})
        self.assertTrue(all(i.owners for i in self.items))

    def test_empty_label_columns_are_skipped(self):
        us03 = next(i for i in self.items if i.story_id == "US03")
        self.assertEqual(us03.types, ["Geschäftsfunktion / CRUD"])
        us01 = self.items[0]
        self.assertEqual(len(us01.types), 3)

    def test_title_and_description(self):
        us01 = self.items[0]
        self.assertEqual(ib.card_title(us01), "US01 (F01): create, edit, deactivate and search staff accounts "
                                              "and role assignments")
        desc = ib.card_description(us01)
        self.assertTrue(desc.startswith("**As a...** Manager\n**I want to be able to...** create, edit"))
        self.assertIn("**So that...** only authorised staff access operational data", desc)
        self.assertIn("**Priority:** Must Have", desc)
        self.assertIn("**Estimation (SP):** 5", desc)
        self.assertIn("**Owner:** Timo", desc)
        self.assertLess(desc.index("**Tasks**"), desc.index("**Acceptance Criteria**"))
        self.assertTrue(desc.rstrip().endswith("Manager-only CRUD."))
        self.assertNotIn("Timo\n", desc.split("**Tasks**")[1])

    def test_split_owner_and_task_edge_cases(self):
        self.assertEqual(ib.split_owner_and_task("Timo\nDo it"), (["Timo"], "Do it"))
        self.assertEqual(ib.split_owner_and_task("Timo, Niki\nDo it"), (["Timo", "Niki"], "Do it"))
        self.assertEqual(ib.split_owner_and_task("Timo/Niki\nDo it"), (["Timo", "Niki"], "Do it"))
        self.assertEqual(ib.split_owner_and_task("no owner line"), ([], "no owner line"))


class OwnerResolutionTest(unittest.TestCase):
    members = [
        {"id": "m1", "fullName": "Timo Muster", "username": "timo_m"},
        {"id": "m2", "fullName": "Niki Beispiel", "username": "nikib"},
        {"id": "m3", "fullName": "Paul A", "username": "paul_a"},
        {"id": "m4", "fullName": "Paul B", "username": "paul_b"},
    ]

    def test_first_name_match(self):
        self.assertEqual(ib.resolve_owner("Timo", self.members, {})[0], "m1")

    def test_owner_map_wins(self):
        self.assertEqual(ib.resolve_owner("Paul", self.members, {"Paul": "paul_b"})[0], "m4")

    def test_ambiguous_and_unknown(self):
        self.assertIsNone(ib.resolve_owner("Paul", self.members, {})[0])
        self.assertIsNone(ib.resolve_owner("Basti", self.members, {})[0])


class RunTest(unittest.TestCase):
    def run_import(self, fake, **overrides):
        log = []
        ib.run(args(**overrides), client=fake, out=log.append)
        return log

    def test_real_import_creates_cards_labels_and_members(self):
        fake = FakeTrello()
        # Board.__init__ calls client.get / run() calls board.client.post -> the fake serves both
        log = self.run_import(fake)
        self.assertEqual(len(fake.created_cards), 45)
        first = fake.created_cards[0]
        self.assertEqual(first["idList"], "l0")  # Backlog
        self.assertEqual(first["pos"], "bottom")
        self.assertEqual(first["idMembers"], "m1")  # Timo
        self.assertEqual(len(first["idLabels"].split(",")), 4)  # 3 types + priority
        names = {label["name"]: label["color"] for label in fake.labels}
        self.assertEqual(names["Must Have"], "red")
        self.assertEqual(names["Could Have"], "yellow")
        self.assertEqual(len(names), len(fake.labels), "labels must not be created twice")
        # Paul, Basti, Johannes are not on the board -> reported, cards still created without member
        self.assertTrue(any("Paul: no board member found" in line for line in log))
        self.assertTrue(any(c["idMembers"] == "" for c in fake.created_cards))

    def test_rerun_skips_existing_stories(self):
        fake = FakeTrello(cards=[{"name": "US01 (F01): old", "idList": "l0"}, {"name": "other", "idList": "l0"}])
        self.run_import(fake, limit=3)
        self.assertEqual([c["name"][:4] for c in fake.created_cards], ["US02", "US03"])

    def test_dry_run_creates_nothing(self):
        fake = FakeTrello()
        self.run_import(fake, dry_run=True)
        self.assertEqual((fake.created_cards, fake.labels), ([], []))

    def test_missing_list_is_reported(self):
        with self.assertRaises(SystemExit) as ctx:
            self.run_import(FakeTrello(lists=("To do",)))
        self.assertIn("List 'Backlog' not found", str(ctx.exception))

    def test_offline_dry_run_without_board(self):
        log = []
        ib.run(args(board=None, dry_run=True, limit=2), out=log.append)
        self.assertTrue(any(line.startswith("  + US01 (F01)") for line in log))


if __name__ == "__main__":
    unittest.main()
