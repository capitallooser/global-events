import unittest
from datetime import datetime, timezone, timedelta
import send_alerts as sa

class AlertTests(unittest.TestCase):
    def test_very_high_event_qualifies(self):
        now=datetime(2026,8,27,10,0,tzinfo=timezone.utc)
        event={'id':'x','title':'CPI','start':(now+timedelta(hours=2)).isoformat().replace('+00:00','Z')}
        impact={'impactLevel':'very_high'}
        self.assertTrue(sa.should_alert(event,impact,now,lead_hours=3))

    def test_high_event_does_not_qualify(self):
        now=datetime(2026,8,27,10,0,tzinfo=timezone.utc)
        event={'id':'x','title':'CPI','start':(now+timedelta(hours=2)).isoformat().replace('+00:00','Z')}
        self.assertFalse(sa.should_alert(event,{'impactLevel':'high'},now,3))

    def test_duplicate_key_is_stable(self):
        event={'id':'x','start':'2026-08-27T12:00:00Z'}
        self.assertEqual(sa.alert_key(event,'lead'),'x|lead|2026-08-27T12:00:00Z')

    def test_alert_time_is_ist(self):
        self.assertEqual(sa.format_ist('2026-08-27T12:30:00Z'),'27 Aug 2026 06:00 PM IST')

if __name__=='__main__': unittest.main()
