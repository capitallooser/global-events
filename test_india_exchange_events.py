import unittest
import india_exchange_events as ie

class IndiaExchangeEventTests(unittest.TestCase):
    def test_2026_future_nse_holidays_are_present(self):
        rows = ie.nse_2026_events('2026-08-27T00:00:00Z')
        dates = {r['start'][:10] for r in rows}
        self.assertTrue({'2026-09-14','2026-10-02','2026-10-20','2026-11-10','2026-11-24','2026-12-25'} <= dates)

    def test_muhurat_trading_event_is_distinct(self):
        rows = ie.nse_2026_events('2026-08-27T00:00:00Z')
        hit = [r for r in rows if r.get('eventKey') == 'nse_muhurat_2026']
        self.assertEqual(len(hit), 1)
        self.assertEqual(hit[0]['start'][:10], '2026-11-08')
        self.assertEqual(hit[0]['eventType'], 'exchange')
        self.assertIn('Muhurat', hit[0]['title'])

    def test_exchange_events_are_india_and_official_source(self):
        rows = ie.nse_2026_events('2026-08-27T00:00:00Z')
        self.assertTrue(all(r['country'] == 'IN' for r in rows))
        self.assertTrue(all('nseindia.com' in r['sourceUrl'] for r in rows))

if __name__ == '__main__': unittest.main()
