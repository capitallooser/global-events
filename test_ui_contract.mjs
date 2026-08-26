import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
const html=fs.readFileSync(new URL('./index.html',import.meta.url),'utf8');
const app=fs.readFileSync(new URL('./app.js',import.meta.url),'utf8');

test('all legacy filters are present in the shared filter bar',()=>{
 for(const id of ['q','country','category','importance','impact','sort']) assert.match(html,new RegExp(`id="${id}"`));
 for(const win of ['today','7d','30d','all']) assert.match(html,new RegExp(`data-win="${win}"`));
 for(const category of ['earnings','ipo','sports','geopolitical','crypto']) assert.match(html,new RegExp(`value="${category}"`));
});

test('one-minute live refresh is wired without page reloads',()=>{
 assert.match(app,/setInterval\(refreshEverything,LIVE_REFRESH_MS\)/);
 assert.match(app,/const y=window\.scrollY/);
 assert.doesNotMatch(app,/location\.reload/);
 assert.doesNotMatch(app,/refreshMarketData/);
 assert.doesNotMatch(app,/refreshDashboardData/);
});

test('continuous ticker and News navigation replace the old market snapshot',()=>{
 assert.match(html,/id="marketTicker"/);
 assert.match(html,/id="tickerTrack"/);
 assert.match(html,/data-tab="news"/);
 assert.doesNotMatch(html,/giftNiftyLive/);
 assert.doesNotMatch(html,/tv-single-ticker/);
 assert.doesNotMatch(html,/NSEIX:NIFTY1!/);
 assert.doesNotMatch(html,/tradingview/i);
});

test('region tabs keep shared filter state but lock their region',()=>{
 assert.match(app,/forcedCountryForTab/);
 assert.match(app,/countryFilterLabel/);
 assert.match(app,/filterWindow='30d'/);
});
