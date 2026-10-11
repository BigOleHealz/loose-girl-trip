import test from 'node:test';
import assert from 'node:assert/strict';
import { NextRequest } from 'next/server';
import { GET as weather } from '../src/app/api/weather/route';
import { GET as gas } from '../src/app/api/gas/route';
import { GET as tile } from '../src/app/api/tiles/[layer]/[z]/[x]/[y]/route';

test('server weather calculates decade monthly averages, 30-day cache and partial forecast',async()=>{
 const original=globalThis.fetch;const calls: Array<{host:string;ttl:number}> = [];
 try {
 globalThis.fetch=async(input,init)=>{
  const url=new URL(String(input));const ttl=(init as RequestInit & {next:{revalidate:number}}).next.revalidate;
  calls.push({host:url.hostname,ttl});
  if(url.hostname.startsWith('archive')) {
   const start=Date.parse(url.searchParams.get('start_date')+'T00:00:00Z'),end=Date.parse(url.searchParams.get('end_date')+'T00:00:00Z');
   const time=Array.from({length:(end-start)/86400000+1},(_,i)=>new Date(start+i*86400000).toISOString().slice(0,10));
   return Response.json({daily:{time,temperature_2m_max:time.map(()=>70),temperature_2m_min:time.map(()=>40)}});
  }
  const time=[new Date().toISOString().slice(0,10)];
  return Response.json({daily:{time,temperature_2m_max:[80],temperature_2m_min:[55]}});
 };
 const today=new Date().toISOString().slice(0,10),depart=new Date(Date.now()+2*86400000).toISOString().slice(0,10);
 const r=await weather(new NextRequest(`http://localhost/api/weather?lat=40&lon=-105&arrive=${today}&depart=${depart}`));
 const d=await r.json();assert.equal(r.status,200);assert.equal(d.source,'forecast');assert.equal(d.avgLowF,55);assert.equal(d.partial,true);assert.equal(d.months.length,12);
 assert.deepEqual(calls.map(c=>c.ttl),[2592000,3600]);
 assert.equal((await weather(new NextRequest('http://localhost/api/weather?lat=bad&lon=-105&arrive=2027-02-30&depart=2027-03-01'))).status,400);
 globalThis.fetch=async()=>new Response('private upstream error',{status:429});
 const failed=await weather(new NextRequest('http://localhost/api/weather?lat=40&lon=-105&arrive=2027-01-01&depart=2027-01-02'));
 assert.equal(failed.status,502);assert.equal((await failed.text()).includes('private upstream'),false);
 } finally {globalThis.fetch=original;}
});
test('EIA and tiles hide keys, enforce cache TTLs, whitelist requests and sanitize failures',async()=>{
 const original=globalThis.fetch;const eia=process.env.EIA_API_KEY,owm=process.env.OPENWEATHER_API_KEY;
 try {
 process.env.EIA_API_KEY='test-only-eia';process.env.OPENWEATHER_API_KEY='test-only-owm';
 globalThis.fetch=async(input,init)=>{
  const url=new URL(String(input));const ttl=(init as RequestInit & {next:{revalidate:number}}).next.revalidate;
  if(url.hostname==='api.eia.gov') {assert.equal(ttl,86400);assert.equal(url.searchParams.get('facets[product][]'),'EPMR');return Response.json({response:{data:[{period:'2026-10-05',duoarea:'NUS','area-name':'U.S.',units:'$/GAL',value:'4.354'},{period:'2026-09-28',duoarea:'SCO',units:'$/GAL',value:'4.1'}]}});}
  assert.equal(ttl,3600);return new Response(new Uint8Array([137,80,78,71]),{headers:{'Content-Type':'image/png'}});
 };
 const r=await gas();const data=await r.json();assert.equal(data.prices.NUS.price,4.354);assert.equal(data.prices.SCO,undefined);assert.equal(JSON.stringify(data).includes('test-only-eia'),false);
 const params={layer:'temp_new',z:'0',x:'0',y:'0'};
 const image=await tile(new NextRequest('http://localhost/api/tiles/temp_new/0/0/0'),{params:Promise.resolve(params)});assert.equal(image.status,200);assert.equal(image.headers.get('Content-Type'),'image/png');assert.equal(image.headers.get('Cache-Control'),'public, max-age=3600');
 assert.equal((await tile(new NextRequest('http://localhost'),{params:Promise.resolve({...params,layer:'arbitrary'})})).status,400);
 assert.equal((await tile(new NextRequest('http://localhost'),{params:Promise.resolve({...params,x:'1'})})).status,400);
 globalThis.fetch=async()=>new Response('test-only-eia test-only-owm',{status:401});
 assert.equal((await gas()).status,502);assert.equal((await tile(new NextRequest('http://localhost'),{params:Promise.resolve(params)})).status,502);
 }finally {globalThis.fetch=original;if(eia===undefined)delete process.env.EIA_API_KEY;else process.env.EIA_API_KEY=eia;if(owm===undefined)delete process.env.OPENWEATHER_API_KEY;else process.env.OPENWEATHER_API_KEY=owm;}
});
