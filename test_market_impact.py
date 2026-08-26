import importlib.util
import unittest
from datetime import date
from pathlib import Path

MODULE = Path(__file__).resolve().parent / "analyze_market_impact.py"
spec = importlib.util.spec_from_file_location("impact", MODULE)
impact = importlib.util.module_from_spec(spec)
spec.loader.exec_module(impact)

class ImpactTests(unittest.TestCase):
    def test_classify_bls(self):
        self.assertEqual(
            impact.classify_bls_release("Consumer Price Index for July 2026"),
            "us_cpi"
        )
        self.assertEqual(
            impact.classify_bls_release("Employment Situation for July 2026"),
            "us_nfp"
        )

    def test_parse_bls_table(self):
        html = """
        <table><tr><th>Date</th><th>Time</th><th>Release</th></tr>
        <tr><td>Wednesday, January 15, 2025</td><td>08:30 AM</td>
        <td>Consumer Price Index for December 2024</td></tr>
        <tr><td>Friday, January 10, 2025</td><td>08:30 AM</td>
        <td>Employment Situation for December 2024</td></tr></table>
        """
        rows = impact.parse_bls_history(html)
        self.assertEqual(len(rows), 2)
        self.assertEqual(rows[0]["key"], "us_cpi")
        self.assertEqual(rows[0]["date"], "2025-01-15")

    def test_parse_fomc(self):
        html = """
        <h3>2024 FOMC Meetings</h3>
        <div>January</div><div>30-31</div>
        <div>March</div><div>19-20</div>
        <div>Apr/May</div><div>30-1</div>
        """
        rows = impact.parse_fomc_history(html)
        dates = [r["date"] for r in rows]
        self.assertIn("2024-01-31", dates)
        self.assertIn("2024-03-20", dates)
        self.assertIn("2024-05-01", dates)

    def test_us_event_nifty_uses_next_session(self):
        prices = {
            "2025-01-14": 100.0,
            "2025-01-15": 101.0,  # event date India close
            "2025-01-16": 104.0,  # first reaction day
            "2025-01-17": 103.0,
            "2025-01-20": 105.0,
        }
        value = impact.reaction_return(
            prices, date(2025,1,15), "IN", "US", 1
        )
        self.assertAlmostEqual(value, (104/101-1)*100)

    def test_us_event_sp500_uses_event_session(self):
        prices = {
            "2025-01-14": 100.0,
            "2025-01-15": 102.0,
            "2025-01-16": 103.0,
        }
        value = impact.reaction_return(
            prices, date(2025,1,15), "US", "US", 1
        )
        self.assertAlmostEqual(value, 2.0)

    def test_direction_hidden_under_eight_samples(self):
        stats = impact.summarize([1,-1,1,-1,1,-1,1])
        self.assertFalse(stats["directionReady"])
        self.assertIsNone(stats["upPct"])

    def test_impact_thresholds(self):
        self.assertEqual(impact.impact_level(1.3), "very_high")
        self.assertEqual(impact.impact_level(0.9), "high")
        self.assertEqual(impact.impact_level(0.5), "medium")
        self.assertEqual(impact.impact_level(0.2), "low")

if __name__ == "__main__":
    unittest.main()
