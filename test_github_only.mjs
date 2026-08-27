import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const read=path=>fs.readFileSync(new URL(path,import.meta.url),'utf8');

test('market prices target a five-minute GitHub schedule',()=>{
  const yml=read('./.github/workflows/market-prices.yml');
  assert.match(yml,/cron:\s*["']\*\/5 \* \* \* \*["']/);
  assert.doesNotMatch(yml,/Cloudflare Worker/i);
});

test('news is refreshed by GitHub Actions every five minutes',()=>{
  const yml=read('./.github/workflows/news.yml');
  assert.match(yml,/cron:\s*["']\*\/5 \* \* \* \*["']/);
  assert.match(yml,/node refresh_news\.mjs/);
  assert.match(yml,/news\.json/);
  assert.match(yml,/nifty-in-news\.json/);
});

test('Cloudflare deployment is not part of production',()=>{
  assert.equal(fs.existsSync(new URL('./.github/workflows/deploy-worker.yml',import.meta.url)),false);
  assert.equal(fs.existsSync(new URL('./live-config.json',import.meta.url)),false);
});
