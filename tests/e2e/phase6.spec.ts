import { expect, test } from '@playwright/test';
import { EMPTY_TRIP, STORAGE_KEY } from '../../src/lib/trip';

test('trip files, monthly weather timeline and mobile sheet work without losing the current plan', async ({ page }) => {
  const trip = { ...EMPTY_TRIP, id:'imported-trip', name:'A warmer year', startDate:'2027-01-01',endDate:'2027-12-31',stops:[
    {id:'denver',name:'Denver',state:'CO',lat:39.74,lon:-104.99,arriveDate:'2027-01-30',departDate:'2027-02-02'},
    {id:'phoenix',name:'Phoenix',state:'AZ',lat:33.45,lon:-112.07,arriveDate:'2027-05-01',departDate:'2027-05-06',nightlyRate:0},
  ]};
  await page.route('**/api/weather?*',route=>{const warm=new URL(route.request().url()).searchParams.get('lat')==='33.45';return route.fulfill({json:{source:'climate',avgHighF:75,avgLowF:warm?67:14,months:Array.from({length:12},(_,i)=>({month:i+1,avgHighF:75,avgLowF:warm?67:14})),coverage:'Test climate',partial:false}});});
  await page.goto('/'); await expect(page.getByRole('button',{name:'Import trip JSON ↙'})).toBeVisible();
  const upload=page.getByLabel('Import trip JSON file');
  await upload.setInputFiles({name:'bad.json',mimeType:'application/json',buffer:Buffer.from('{}')});
  await expect(page.locator('.trip-files [role=alert]')).toContainText('valid trip');await expect(page.locator('.stop-card')).toHaveCount(0);
  await upload.setInputFiles({name:'trip.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(trip))});
  await expect(page.getByRole('region',{name:'Import preview'})).toContainText('A warmer year');
  await page.getByRole('button',{name:'Cancel import',exact:true}).click();await expect(page.locator('.stop-card')).toHaveCount(0);
  await upload.setInputFiles({name:'trip.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(trip))});
  await page.getByRole('button',{name:'Replace local trip',exact:true}).click();await expect(page.locator('.stop-card')).toHaveCount(2);
  await expect(page.locator('.stop-pin.cold')).toHaveCount(1);await expect(page.locator('.stop-pin.warm')).toHaveCount(1);
  const downloadPromise=page.waitForEvent('download');await page.getByRole('button',{name:'Export trip JSON ↗'}).click();const download=await downloadPromise;
  const {readFile}=await import('node:fs/promises');const exported=JSON.parse(await readFile((await download.path())!,'utf8'));expect(exported).toEqual(trip);
  await page.reload();await expect(page.locator('.stop-card')).toHaveCount(2);
  await page.locator('.timeline-panel > summary').click();const timeline=page.getByRole('region',{name:'Monthly timeline'});
  await expect(timeline.getByRole('button',{name:'Denver',exact:false})).toHaveCount(2);
  await expect(timeline.locator('.timeline-stay.cold')).toHaveCount(2);await expect(timeline.locator('.timeline-stay.warm')).toHaveCount(1);
  await expect(timeline).toContainText('30–31 Jan · 2 nights');await expect(timeline).toContainText('1 Feb · 1 night');
  await page.getByRole('button',{name:'Next timeline year'}).click();await expect(timeline.getByRole('heading',{name:'2028'})).toBeVisible();await expect(timeline.locator('.timeline-stay')).toHaveCount(0);
  await page.getByRole('button',{name:'Previous timeline year'}).click();
  await page.setViewportSize({width:390,height:844});await page.getByRole('button',{name:'Expand trip panel',exact:true}).click();
  await expect(page.locator('.planner')).toHaveClass(/sheet-expanded/);
  await timeline.getByRole('button',{name:'Phoenix',exact:false}).click();await expect(page.locator('.planner')).toHaveClass(/sheet-collapsed/);
  await expect.poll(async()=>Math.round((await page.locator('.sidebar').boundingBox())!.height)).toBe(104);
  await expect(page.locator('.stop-pin.warm')).toBeInViewport();expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  await page.screenshot({path:'test-results/phase6-mobile-map.png'});
  await page.getByRole('button',{name:'Open trip planner ↑',exact:true}).click();
  await page.getByRole('button',{name:'Expand trip panel',exact:true}).click();await timeline.scrollIntoViewIfNeeded();
  await page.screenshot({path:'test-results/phase6-mobile-timeline.png'});
  const grip=page.getByRole('button',{name:'Resize trip panel'});await grip.focus();await page.keyboard.press('Enter');await expect(page.locator('.planner')).toHaveClass(/sheet-half/);
  expect(JSON.parse((await page.evaluate(key=>localStorage.getItem(key),STORAGE_KEY))!).stops).toHaveLength(2);
});

test('PWA assets and worker provide an offline page without caching trip or auth responses',async({page,request,context})=>{
 const manifest=await request.get('/manifest.webmanifest');expect(manifest.ok()).toBe(true);const data=await manifest.json();expect(data.display).toBe('standalone');expect(data.start_url).toBe('/');
 for(const icon of data.icons){const response=await request.get(icon.src);expect(response.ok()).toBe(true);expect(response.headers()['content-type']).toContain('image/png');}
 const worker=await request.get('/sw.js');expect(worker.headers()['cache-control']).toContain('no-store');
 await page.goto('/');await page.locator('.install-app > summary').click();await expect(page.getByText('iPhone/iPad:',{exact:true})).toBeVisible();
 await expect.poll(()=>page.evaluate(async()=>Boolean((await navigator.serviceWorker.getRegistration('/'))?.active))).toBe(true);
 await expect.poll(()=>page.evaluate(()=>Boolean(navigator.serviceWorker.controller))).toBe(true);
 const cached=await page.evaluate(async()=>{const keys=await caches.keys();return(await Promise.all(keys.map(async key=>(await(await caches.open(key)).keys()).map(r=>new URL(r.url).pathname)))).flat();});expect(cached).toEqual(['/offline.html']);
 await context.setOffline(true);await page.reload();await expect(page.getByRole('heading',{name:'A little pause in the journey.'})).toBeVisible();
 await context.setOffline(false);await page.getByRole('link',{name:'Try again ↗'}).click();await expect(page.getByRole('heading',{name:'Take the long way.'})).toBeVisible();
});
