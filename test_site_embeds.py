import unittest
from pathlib import Path

ROOT=Path(__file__).resolve().parent

class SiteEmbedTests(unittest.TestCase):
    def test_gift_nifty_uses_free_tradingview_single_ticker(self):
        html=(ROOT/'index.html').read_text(encoding='utf-8')
        self.assertIn('widgets.tradingview-widget.com/w/en/tv-single-ticker.js',html)
        self.assertIn('symbol="NSEIX:NIFTY1!"',html)
        self.assertIn('id="giftNiftyLive"',html)

if __name__=='__main__':unittest.main()
