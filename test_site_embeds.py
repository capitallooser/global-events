import unittest
from pathlib import Path

ROOT=Path(__file__).resolve().parent

class SiteEmbedTests(unittest.TestCase):
    def test_market_ticker_replaces_gift_nifty_embed(self):
        html=(ROOT/'index.html').read_text(encoding='utf-8')
        self.assertIn('id="marketTicker"',html)
        self.assertIn('id="tickerTrack"',html)
        self.assertNotIn('widgets.tradingview-widget.com',html)
        self.assertNotIn('NSEIX:NIFTY1!',html)
        self.assertNotIn('id="giftNiftyLive"',html)

if __name__=='__main__':unittest.main()
