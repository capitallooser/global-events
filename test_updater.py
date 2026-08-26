import sys, unittest
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "scripts"))
import update_events as u

class UpdaterTests(unittest.TestCase):
    def test_normalize_holiday(self):
        row = {"date":"2026-01-26","localName":"Republic Day","name":"Republic Day"}
        e = u.normalize_holiday("IN","India",row,"2026-08-26T00:00:00Z")
        self.assertEqual(e["country"], "IN")
        self.assertEqual(e["category"], "holiday")
        self.assertTrue(e["sourceUrl"].startswith("https://"))
        self.assertEqual(e["start"], "2026-01-26T00:00:00Z")

    def test_dedupe(self):
        e = {"title":"X","start":"2026-01-01T00:00:00Z","category":"holiday",
             "country":"IN","importance":"medium"}
        self.assertEqual(len(u.dedupe([dict(e,id="a"),dict(e,id="b")])), 1)

if __name__ == "__main__":
    unittest.main()
