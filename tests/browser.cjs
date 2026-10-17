const assert=require('node:assert/strict'),fs=require('node:fs'),{chromium}=require('playwright');
const G=require('../js/gia'),C=require('../js/converter');
(async()=>{
 fs.mkdirSync('test-results',{recursive:true});
 const fixture=G.convertJsonToGiaBytes({import_scene:true,group_name:'Browser test',elements:[{type:'rectangle',imported_name:'Test image',relative:{x:1,y:2},size:{width:30,height:20}}],mask:{position:{x:0,y:0},size:{x:80,y:80},enabled:false}},fs.readFileSync('assets/image_template.gia'),G.MODE_IMAGE);
 fs.writeFileSync('test-results/input.gia',fixture);
 const browser=await chromium.launch({executablePath:process.env.CHROME_PATH||'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});
 const context=await browser.newContext({viewport:{width:1280,height:1100},acceptDownloads:true});const page=await context.newPage(),errors=[];
 page.on('pageerror',e=>errors.push(e.message));page.on('response',r=>{if(r.status()>=400)errors.push(r.status()+' '+r.url())});
 let templateRequests=0;page.on('request',r=>{if(/\/assets\/[^/]+\.gia$/.test(new URL(r.url()).pathname))templateRequests++;});
 const site=process.env.SITE_URL||'http://127.0.0.1:8321/';await page.goto(site);
 assert.equal(await page.locator('#downloads a').count(),0);assert.equal(await page.locator('#target').count(),0);assert(await page.locator('#convert').isDisabled());
 assert.equal(await page.locator('html').getAttribute('data-theme'),'dark');
 async function confirm(){await page.waitForFunction(()=>!document.getElementById('convert').disabled);assert.equal(await page.locator('#downloads a').count(),0);await page.locator('#convert').click();}
 async function ready(){await confirm();await page.waitForFunction(()=>document.querySelectorAll('#downloads a').length===2);assert.equal(await page.locator('#downloads').getAttribute('aria-busy'),'false');}
 async function verifyDownloads(input,prefix){
  const source=C.decodeUiGia(input),targets=C.availableFormats(source).filter(f=>f!==source.format);
  assert.deepEqual(await page.locator('#downloads a').evaluateAll(links=>links.map(a=>a.dataset.format)),targets);
  for(const format of targets){
   const link=page.locator('#downloads a[data-format="'+format+'"]');assert(await link.isVisible());
   const [download]=await Promise.all([page.waitForEvent('download'),link.click()]);const path='test-results/'+prefix+'_'+format+'.gia';await download.saveAs(path);
   assert(download.suggestedFilename().endsWith('_'+format+'.gia'));const result=C.decodeUiGia(fs.readFileSync(path));assert.equal(result.format,format);if(format==='asset-group'&&C.hasFullscreenAnimations(source)){assert(!C.hasFullscreenAnimations(result));assert.deepEqual(result.json.elements.map(e=>e.imported_name),source.json.elements.filter(e=>e.type!=='fullscreenAnimation').map(e=>e.imported_name));}else assert(C.equalScene(source,result));
  }
 }
 await page.evaluate(data=>{const transfer=new DataTransfer();transfer.items.add(new File([Uint8Array.from(data)],'page-drop.gia'));document.querySelector('header').dispatchEvent(new DragEvent('dragenter',{bubbles:true,cancelable:true,dataTransfer:transfer}));document.body.dispatchEvent(new DragEvent('drop',{bubbles:true,cancelable:true,dataTransfer:transfer}));},Array.from(fixture));
 await page.waitForFunction(()=>!document.getElementById('convert').disabled);assert.equal(templateRequests,0,'Upload must not fetch conversion templates before confirmation');
 await ready();assert.equal(await page.locator('#file-name').textContent(),'page-drop.gia');assert.equal(await page.locator('body').evaluate(el=>el.classList.contains('file-drag')),false);await verifyDownloads(fixture,'drop');
 await page.locator('#clear').click();assert.equal(await page.locator('#downloads a').count(),0);
 for(const name of ['OrangeDisc','Terra_Blade','z_bigbanner','z_frisbee_all','z_scoreboard','z_ui_animation_server','ServerControlTemplate']){
  await page.locator('#file').setInputFiles('tests/fixtures/'+name+'.gia');await ready();await verifyDownloads(fs.readFileSync('tests/fixtures/'+name+'.gia'),name);
 }
 // Both remaining formats are prepared together after confirmation.
 for(const format of ['client-control']){
  const file='test-results/ServerControlTemplate_'+format+'.gia';await page.locator('#file').setInputFiles(file);await ready();await verifyDownloads(fs.readFileSync(file),'from_'+format);
 }
 await page.selectOption('#language','zh-CN');assert.equal(await page.evaluate(()=>localStorage.getItem('miliastra-lang')),'zhs');assert(await page.locator('#downloads a').first().getAttribute('aria-label'));await page.selectOption('#language','en');
 for(const name of ['z_ui_animation_client','z_ui_animation_server']){
  await page.locator('#file').setInputFiles('tests/fixtures/'+name+'.gia');
  await page.waitForFunction(()=>!document.getElementById('convert').disabled);
  assert(await page.locator('#format-notice').isVisible());assert((await page.locator('#format-notice').textContent()).includes('Fullscreen UI Animation'));
  await ready();await verifyDownloads(fs.readFileSync('tests/fixtures/'+name+'.gia'),name+'_fullscreen');
  assert(await page.locator('#format-notice').isVisible());assert.equal(await page.locator('#downloads a[data-format="asset-group"]').count(),1);
 }
 await page.locator('#clear').click();assert(await page.locator('#format-notice').isHidden());
 await page.screenshot({path:'test-results/desktop.png',fullPage:true});await page.setViewportSize({width:390,height:844});await page.screenshot({path:'test-results/mobile.png',fullPage:true});assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
 await page.locator('#file').setInputFiles('tests/fixtures/z_clientcontrol.gia');await page.waitForFunction(()=>document.getElementById('status').textContent.includes('GridScrollerControl'));assert.equal(await page.locator('#downloads a').count(),0);
 fs.writeFileSync('test-results/invalid.gia',Buffer.from('not gia'));await page.locator('#file').setInputFiles('test-results/invalid.gia');await page.waitForFunction(()=>document.getElementById('status').classList.contains('error'));assert.equal(await page.locator('#downloads a').count(),0);
 await page.route('**/assets/*.gia',route=>route.abort());await page.locator('#file').setInputFiles('test-results/input.gia');await confirm();await page.waitForFunction(()=>document.getElementById('status').classList.contains('error'));assert.equal(await page.locator('#downloads a').count(),0);await page.unroute('**/assets/*.gia');
 // Clearing while templates load cancels the old run and never restores stale downloads.
 let release;const gate=new Promise(resolve=>release=resolve);await page.route('**/assets/*.gia',async route=>{await gate;try{await route.continue();}catch(e){}});
 await page.locator('#file').setInputFiles('test-results/input.gia');await confirm();await page.waitForFunction(()=>document.getElementById('downloads').getAttribute('aria-busy')==='true');await page.locator('#clear').click();release();await page.unroute('**/assets/*.gia');
 await page.locator('#file').setInputFiles('tests/fixtures/ServerControlTemplate.gia');await ready();assert.equal(await page.locator('#file-name').textContent(),'ServerControlTemplate.gia');assert.equal(await page.locator('#downloads a').evaluateAll(links=>links.every(a=>a.download.startsWith('ServerControlTemplate_'))),true);
 await page.locator('#theme').click();await page.reload();assert.equal(await page.locator('html').getAttribute('data-theme'),'light');await page.locator('#theme').click();
 const other=await context.newPage();await other.goto(site);await other.selectOption('#language','fr');await page.waitForFunction(()=>document.documentElement.lang==='fr');await other.selectOption('#language','en');await other.close();
 assert.deepEqual(errors,[]);await browser.close();console.log('PASS: confirmation required before paired conversion for all formats, verified contents, drag/drop, stale-run cancellation, errors, preferences and mobile layout');
})().catch(e=>{console.error(e);process.exit(1)});
