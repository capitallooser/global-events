import unittest
from datetime import datetime, timezone, timedelta
import update_market_prices as mp

class MarketPriceTests(unittest.TestCase):
    def test_normalize_quote(self):
        now = datetime(2026,8,27,0,0,tzinfo=timezone.utc)
        q = mp.normalize_quote('nifty','NIFTY 50',25000,24900,now.timestamp(),'Yahoo Finance',now)
        self.assertEqual(q['price'],25000)
        self.assertEqual(q['change'],100)
        self.assertAlmostEqual(q['changePct'],0.4,places=2)
        self.assertEqual(q['status'],'Live')

    def test_stale_quote_is_delayed(self):
        now = datetime(2026,8,27,12,0,tzinfo=timezone.utc)
        old = now - timedelta(hours=3)
        q = mp.normalize_quote('sp500','S&P 500',6500,6480,old.timestamp(),'Yahoo Finance',now)
        self.assertEqual(q['status'],'Delayed')

    def test_instrument_contract_has_crude_and_no_gift_nifty(self):
        self.assertIn('crude', mp.INSTRUMENTS)
        self.assertEqual(mp.INSTRUMENTS['crude'], ('WTI Crude Oil', ['CL=F']))
        self.assertNotIn('gift_nifty', mp.INSTRUMENTS)

    def test_cached_crude_falls_back_to_last_available(self):
        cached={'price':64.5,'change':1.0,'changePct':1.57,'sourceTimestamp':'2026-08-26T10:00:00Z','sourceName':'Yahoo Finance','status':'Live'}
        q=mp.unavailable_or_cached('crude','WTI Crude Oil',cached,'source failed')
        self.assertEqual(q['price'],64.5)
        self.assertEqual(q['status'],'Last available')

if __name__=='__main__': unittest.main()
