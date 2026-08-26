import unittest
import historical_event_dates as hed

class HistoricalEventDateTests(unittest.TestCase):
    def test_parse_rbi_schedule_uses_decision_day_at_end_of_meeting(self):
        text='''Meeting Schedule of the Monetary Policy Committee for 2024-2025\nApril 3-5, 2024\nJune 5-7, 2024\nAugust 6-8, 2024\nOctober 7-9, 2024\nDecember 4-6, 2024\nFebruary 5-7, 2025'''
        rows=hed.parse_rbi_schedule(text)
        self.assertEqual([r['date'] for r in rows],['2024-04-05','2024-06-07','2024-08-08','2024-10-09','2024-12-06','2025-02-07'])
        self.assertTrue(all(r['key']=='rbi_mpc' for r in rows))

    def test_parse_rbi_cross_month_schedule_uses_last_day(self):
        text='''Dates of Meetings of Monetary Policy Committee for 2025-26\nApril 7-9, 2025\nJune 4-6, 2025\nAugust 5-7, 2025\nSeptember 29-30 and October 1, 2025\nDecember 3-5, 2025\nFebruary 4-6, 2026'''
        rows=hed.parse_rbi_schedule(text)
        self.assertIn('2025-10-01',[r['date'] for r in rows])

    def test_parse_ecb_archive_only_takes_monetary_policy_decision_dates(self):
        text='''23 July 2026 Monetary policy decisions Related 23 July 2026 Combined monetary policy decisions and statement\n19 March 2026 Monetary policy decisions\n30 June 2025 ECB strategy review'''
        rows=hed.parse_ecb_archive(text)
        self.assertEqual([r['date'] for r in rows],['2026-07-23','2026-03-19'])

    def test_parse_boe_calendar_with_explicit_year(self):
        text='''2025 provisional dates\nThursday 6 February | February MPC Summary and minutes\nThursday 20 March | March MPC Summary and minutes\nThursday 8 May | May MPC Summary and minutes'''
        rows=hed.parse_boe_calendar(text,2025)
        self.assertEqual([r['date'] for r in rows],['2025-02-06','2025-03-20','2025-05-08'])

    def test_parse_mospi_text_maps_cpi_iip_and_gdp(self):
        text='''January 2025 7th Jan First Advance Estimates of GDP (2024-25) 13th Jan All India Consumer Price Index (CPI) 10th Jan All India Index of Industrial Production (IIP)\nFebruary 2025 12th Feb All India Consumer Price Index (CPI) 12th Feb All India Index of Industrial Production (IIP) 28th Feb Second Advance Estimates of GDP (2024-25)'''
        rows=hed.parse_mospi_calendar(text)
        got={(r['key'],r['date']) for r in rows}
        self.assertIn(('india_cpi','2025-01-13'),got)
        self.assertIn(('india_iip','2025-01-10'),got)
        self.assertIn(('india_gdp','2025-02-28'),got)

if __name__=='__main__': unittest.main()
