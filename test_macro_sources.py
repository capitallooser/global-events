import unittest
import macro_sources as ms

class MacroSourceTests(unittest.TestCase):
    def test_india_calendar_contains_cpi_iip_gdp(self):
        rows=ms.india_macro_events('2026-08-27T00:00:00Z')
        keys={r['eventKey'] for r in rows}
        self.assertTrue({'india_cpi','india_iip','india_gdp','india_wpi'} <= keys)

    def test_september_cpi_date(self):
        rows=ms.india_macro_events('2026-08-27T00:00:00Z')
        hit=[r for r in rows if r['eventKey']=='india_cpi' and r['start'].startswith('2026-09-12')]
        self.assertEqual(len(hit),1)
        self.assertEqual(hit[0]['country'],'IN')

if __name__=='__main__': unittest.main()
