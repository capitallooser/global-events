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

    def test_preserve_cached_quote_on_failure(self):
        cached={'price':100,'change':1,'changePct':1,'sourceTimestamp':'2026-08-26T10:00:00Z','sourceName':'x','status':'Live'}
        q=mp.unavailable_or_cached('gift_nifty','GIFT Nifty',cached,'source failed')
        self.assertEqual(q['price'],100)
        self.assertEqual(q['status'],'Last available')

if __name__=='__main__': unittest.main()
