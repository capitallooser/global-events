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

test('live refresh is wired without page reloads',()=>{
 assert.match(app,/LIVE_REFRESH_MS/);
 assert.match(app,/setInterval\(refreshMarketData,LIVE_REFRESH_MS\.market\)/);
 assert.match(app,/setInterval\(refreshDashboardData,LIVE_REFRESH_MS\.data\)/);
 assert.match(app,/const y=window\.scrollY/);
 assert.doesNotMatch(app,/location\.reload/);
});

test('region tabs keep shared filter state but lock their region',()=>{
 assert.match(app,/forcedCountryForTab/);
 assert.match(app,/countryFilterLabel/);
 assert.match(app,/filterWindow='30d'/);
});
