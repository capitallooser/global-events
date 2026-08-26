import test from 'node:test';
import assert from 'node:assert/strict';
import {classifyCategory,classifyRegion,relevanceLevel,scoreNewsItem,dedupeNews,parseFeed} from './worker/src/news.mjs';

test('news category and region classification identifies market-moving topics',()=>{
  assert.equal(classifyCategory('Federal Reserve cuts interest rates after FOMC meeting'),'central_bank');
  assert.equal(classifyCategory('OPEC discusses crude oil production cuts'),'oil_commodities');
  assert.equal(classifyRegion('RBI announces new banking liquidity rules','GLOBAL'),'IN');
});

test('relevance thresholds are stable',()=>{
  assert.equal(relevanceLevel(90),'very_high');
  assert.equal(relevanceLevel(70),'high');
  assert.equal(relevanceLevel(45),'medium');
  assert.equal(relevanceLevel(20),'low');
});

test('fresh official central-bank news outranks an old generic market wrap',()=>{
  const now=new Date('2026-08-27T10:00:00Z');
  const official={title:'Federal Reserve issues FOMC rate decision',source:'Federal Reserve',publishedAt:'2026-08-27T09:50:00Z',category:'central_bank',region:'US',matchedStocks:[],corroboration:1};
  const generic={title:'Markets mixed in Wednesday trading',source:'General News',publishedAt:'2026-08-25T10:00:00Z',category:'other_market_moving',region:'GLOBAL',matchedStocks:[],corroboration:1};
  assert.ok(scoreNewsItem(official,now)>scoreNewsItem(generic,now));
});

test('dedupe keeps one canonical URL and increments corroboration',()=>{
  const rows=[
    {id:'a',title:'Fed keeps rates unchanged',url:'https://example.com/a?utm_source=x',source:'Source A',publishedAt:'2026-08-27T09:00:00Z',corroboration:1},
    {id:'b',title:'Fed keeps rates unchanged',url:'https://example.com/a',source:'Source B',publishedAt:'2026-08-27T09:05:00Z',corroboration:1}
  ];
  const out=dedupeNews(rows);
  assert.equal(out.length,1);
  assert.equal(out[0].corroboration,2);
});

test('RSS parser stores metadata only',()=>{
  const xml=`<rss><channel><item><title>RBI keeps repo rate unchanged</title><link>https://example.com/rbi</link><pubDate>Thu, 27 Aug 2026 09:00:00 GMT</pubDate><description>Policy decision summary</description><source>Example Finance</source></item></channel></rss>`;
  const rows=parseFeed(xml,{name:'India Market News',region:'IN'});
  assert.equal(rows.length,1);
  assert.equal(rows[0].title,'RBI keeps repo rate unchanged');
  assert.equal(rows[0].region,'IN');
  assert.equal('body' in rows[0],false);
});
