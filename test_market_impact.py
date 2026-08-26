import importlib.util, unittest
from datetime import date
from pathlib import Path
MODULE=Path(__file__).resolve().parent/'analyze_market_impact.py'
spec=importlib.util.spec_from_file_location('impact',MODULE); impact=importlib.util.module_from_spec(spec); spec.loader.exec_module(impact)

class ImpactTests(unittest.TestCase):
  def test_expanded_benchmark_set(self):
    self.assertTrue({'nifty','banknifty','sensex','sp500','nasdaq','gold','usdinr','bitcoin'} <= set(impact.BENCHMARKS))
  def test_classify_bls(self):
    self.assertEqual(impact.classify_bls_release('Consumer Price Index for July 2026'),'us_cpi')
    self.assertEqual(impact.classify_bls_release('Employment Situation for July 2026'),'us_nfp')
  def test_us_event_india_uses_next_session(self):
    prices={'2025-01-14':100.0,'2025-01-15':101.0,'2025-01-16':104.0}
    self.assertAlmostEqual(impact.reaction_return(prices,date(2025,1,15),'IN','US',1),(104/101-1)*100)
  def test_us_event_us_uses_event_session(self):
    prices={'2025-01-14':100.0,'2025-01-15':102.0,'2025-01-16':103.0}
    self.assertAlmostEqual(impact.reaction_return(prices,date(2025,1,15),'US','US',1),2.0)
  def test_direction_hidden_under_eight(self):
    s=impact.summarize([1,-1,1,-1,1,-1,1]); self.assertFalse(s['directionReady']); self.assertIsNone(s['upPct'])
  def test_impact_thresholds(self):
    self.assertEqual(impact.impact_level(1.3),'very_high'); self.assertEqual(impact.impact_level(.9),'high')

if __name__=='__main__': unittest.main()
