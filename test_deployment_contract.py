import json, unittest
from pathlib import Path

ROOT=Path(__file__).resolve().parent

class DeploymentContractTests(unittest.TestCase):
    def test_live_config_exists_and_does_not_guess_worker_url(self):
        path=ROOT/'live-config.json'
        self.assertTrue(path.exists())
        cfg=json.loads(path.read_text())
        self.assertIn('liveDataBase',cfg)
        value=cfg['liveDataBase']
        self.assertTrue(value=='' or value.startswith('https://'))
        if value:
            self.assertNotIn('<account-subdomain>',value)

    def test_worker_deployment_workflow_references_secret_names_not_values(self):
        text=(ROOT/'.github/workflows/deploy-worker.yml').read_text()
        self.assertIn('CLOUDFLARE_API_TOKEN',text)
        self.assertIn('CLOUDFLARE_ACCOUNT_ID',text)
        self.assertIn('cloudflare/wrangler-action@v3',text)
        self.assertIn('workingDirectory: worker',text)

    def test_nifty50_fallback_sync_workflow_exists(self):
        text=(ROOT/'.github/workflows/nifty50.yml').read_text()
        self.assertIn('python sync_nifty50.py',text)
        self.assertIn('nifty50.json',text)

if __name__=='__main__':unittest.main()
