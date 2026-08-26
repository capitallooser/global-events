import unittest
from pathlib import Path

ROOT=Path(__file__).resolve().parent

class DeploymentContractTests(unittest.TestCase):
    def test_cloudflare_is_not_a_production_dependency(self):
        self.assertFalse((ROOT/'live-config.json').exists())
        self.assertFalse((ROOT/'.github/workflows/deploy-worker.yml').exists())

    def test_market_prices_refresh_every_five_minutes(self):
        text=(ROOT/'.github/workflows/market-prices.yml').read_text()
        self.assertIn('*/5 * * * *',text)
        self.assertNotIn('Cloudflare Worker',text)

    def test_news_refresh_workflow_exists(self):
        text=(ROOT/'.github/workflows/news.yml').read_text()
        self.assertIn('*/5 * * * *',text)
        self.assertIn('node refresh_news.mjs',text)
        self.assertIn('news.json',text)
        self.assertIn('nifty-in-news.json',text)

    def test_nifty50_fallback_sync_workflow_exists(self):
        text=(ROOT/'.github/workflows/nifty50.yml').read_text()
        self.assertIn('python sync_nifty50.py',text)
        self.assertIn('nifty50.json',text)

if __name__=='__main__':unittest.main()
