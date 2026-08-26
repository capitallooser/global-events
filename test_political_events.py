import unittest
import update_political_events as pe

class PoliticalEventTests(unittest.TestCase):
    def test_us_2026_general_election_seed(self):
        rows=pe.seed_events('2026-08-27T00:00:00Z')
        matches=[r for r in rows if r['id']=='us-federal-general-election-2026']
        self.assertEqual(len(matches),1)
        self.assertEqual(matches[0]['start'][:10],'2026-11-03')
        self.assertEqual(matches[0]['country'],'US')
        self.assertEqual(matches[0]['eventType'],'election')

    def test_normalize_india_election(self):
        row=pe.make_election('India Assembly Election','2027-02-10','IN','India','assembly','https://www.eci.gov.in/','ECI','2026-08-27T00:00:00Z')
        self.assertEqual(row['category'],'politics')
        self.assertEqual(row['eventType'],'election')
        self.assertEqual(row['electionType'],'assembly')

    def test_merge_replaces_duplicate_id(self):
        old=[{'id':'x','start':'2026-11-03T00:00:00Z'}]
        new=[{'id':'x','start':'2026-11-03T05:00:00Z'}]
        merged=pe.merge_by_id(old,new)
        self.assertEqual(len(merged),1)
        self.assertEqual(merged[0]['start'],'2026-11-03T05:00:00Z')

class EciNumericDateTests(unittest.TestCase):
    def test_extracts_numeric_eci_poll_and_counting_dates(self):
        text='''Schedule for bye-elections to Assembly Constituencies\nDate of Poll: 30-07-2026\nDate of Counting: 02-08-2026'''
        rows=pe.extract_eci_bye_elections(text,'2026-08-27T00:00:00Z')
        dates=[r['start'][:10] for r in rows]
        self.assertIn('2026-07-30',dates)
        self.assertIn('2026-08-02',dates)

if __name__=='__main__': unittest.main()
