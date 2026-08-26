import unittest
import sync_nifty50 as n50

class Nifty50Tests(unittest.TestCase):
    def test_csv_normalization_dedupes_symbols_and_builds_aliases(self):
        text='''Company Name,Industry,Symbol,Series,ISIN Code\nReliance Industries Ltd.,Energy,RELIANCE,EQ,INE002A01018\nReliance Industries Ltd.,Energy,RELIANCE,EQ,INE002A01018\nHDFC Bank Limited,Financial Services,HDFCBANK,EQ,INE040A01034\n'''
        rows=n50.parse_nifty50_csv(text)
        self.assertEqual(len(rows),2)
        reliance=next(x for x in rows if x['symbol']=='RELIANCE')
        self.assertEqual(reliance['company'],'Reliance Industries Ltd.')
        self.assertIn('RELIANCE',reliance['aliases'])
        self.assertIn('Reliance Industries',reliance['aliases'])
        self.assertEqual(len({x['symbol'] for x in rows}),len(rows))

if __name__=='__main__': unittest.main()
