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

    def test_parse_nseix_gift_snapshot(self):
        now=datetime(2026,8,21,11,0,tzinfo=timezone.utc)
        text="24,231.85\n153.55 (0.64%)\nNormal Market Open\nCurrent Day\nDate : 21-Aug-2026"
        q=mp.parse_nseix_gift(text,now)
        self.assertEqual(q['key'],'gift_nifty')
        self.assertEqual(q['price'],24231.85)
        self.assertAlmostEqual(q['changePct'],0.64)
        self.assertEqual(q['sourceName'],'NSE IX')

    def test_parse_nseix_near_month_gift_future_block(self):
        now=datetime(2026,8,21,11,0,tzinfo=timezone.utc)
        text='''Current Day\nDate : 21-Aug-2026\nIntra Day Price - Near month GIFT NIFTY Future\n24329\n43 (0.18%)\nOpen\n24282.5\nHigh\n24364'''
        q=mp.parse_nseix_gift(text,now)
        self.assertEqual(q['price'],24329)
        self.assertEqual(q['change'],43)
        self.assertAlmostEqual(q['changePct'],0.18)
        self.assertEqual(q['status'],'Delayed')

if __name__=='__main__': unittest.main()
