'use strict';
// Offline Loon API mocks; not a native Loon parser or server acceptance test.
const fs=require('fs'),vm=require('vm'),assert=require('assert'),crypto=require('crypto');
const root=require('path').resolve(__dirname,'..');
const web='https://api.bilibili.com/x/web-interface/wbi/index/top/feed/rcmd?w_rid=unchanged';
const app='https://app.bilibili.com/x/v2/feed/index';
let tests=0;
function run(file,req,arg={},store={},body,failStore=false){
 const done=[],logs=[],notes=[];
 const c={ $request:{method:'GET',headers:{},...req},$argument:arg,
 $response:{status:200,body},$persistentStore:{read:k=>{if(failStore)throw Error('mock store');return store[k]||null},write:(v,k)=>{store[k]=v;return true}},
 $notification:{post:(...v)=>notes.push(v)},$done:v=>done.push(JSON.parse(JSON.stringify(v))),console:{log:v=>logs.push(String(v))}};
 vm.runInNewContext(fs.readFileSync(root+'/scripts/'+file+'.js','utf8'),c);
 assert.equal(done.length,1,'exactly one done');return {out:done[0],logs,notes,store,c};
}
function test(name,fn){fn();tests++;console.log('ok '+name)}
const r=(req,arg,store)=>run('tabulabili-rcmd',req,arg,store);
const headers={cOoKiE:'SESSDATA=private; buvid3=current; buvid4=four',Authorization:'private','x-bili-mid':'123'};
test('origin unchanged',()=>assert.deepEqual(r({url:web,headers},{mode:'origin'}).out,{}));
test('refresh only fingerprint and no WBI query changes',()=>{const o=r({url:web,headers},{mode:'refresh'}).out;assert.deepEqual(o,{headers:{Cookie:'buvid3=current; buvid4=four'}})});
test('pure removes all identity',()=>assert.deepEqual(r({url:web,headers},{mode:'pure'}).out,{headers:{}}));
test('mixed alternates global requests',()=>{const s={};assert.ok(r({url:web,headers},{mode:'mixed'},s).out.headers);assert.deepEqual(r({url:web,headers},{mode:'mixed'},s).out,{});assert.equal(s.tabulabili_mixed_counter,'2')});
test('string arguments and store fallback',()=>{assert.deepEqual(r({url:web,headers},'mode=pure').out,{headers:{}});assert.deepEqual(r({url:web,headers},{mode:'bad'},{tabulabili_mode:'origin'}).out,{})});
test('current fingerprint preferred to stored identity',()=>assert.equal(r({url:web,headers},{mode:'refresh'},{tabulabili_fingerprint:'buvid3=old; SESSDATA=private'}).out.headers.Cookie,'buvid3=current; buvid4=four'));
test('fallback sanitized and supports buvid4/buvid',()=>{for(const fp of ['buvid4=only','buvid=app'])assert.equal(r({url:web},{mode:'refresh'},{tabulabili_fingerprint:fp+'; SESSDATA=private'}).out.headers.Cookie,fp)});
test('no fingerprint drops Cookie',()=>assert.deepEqual(r({url:web,headers:{Cookie:'SESSDATA=private'}},{mode:'refresh'}).out,{headers:{}}));
test('playback, foreign host and sibling paths untouched and uncounted',()=>{for(const url of ['https://api.bilibili.com/x/player/wbi/playurl?access_key=private',app+'/story',app+'evil','https://evil.test/'+app]){const s={};assert.deepEqual(r({url,headers},{mode:'mixed'},s).out,{});assert.equal(s.tabulabili_mixed_counter,undefined)}});
test('POST unchanged',()=>assert.deepEqual(r({url:app,method:'POST',headers},{mode:'pure'}).out,{}));
test('App encoded-query signature matches independent crypto',()=>{const o=r({url:app+'?appkey=1d8b6e7d45233436&access_key=private&access_token=private&session_key=private&sign=old&title=%E4%B8%AD%E6%96%87%20%26&ts=123',headers},{mode:'refresh'}).out;const u=new URL(o.url);for(const k of ['access_key','access_token','session_key'])assert.equal(u.searchParams.has(k),false);const q=o.url.split('?')[1].split('&').filter(p=>!p.startsWith('sign=')).join('&');assert.equal(u.searchParams.get('sign'),crypto.createHash('md5').update(q+'560c52ccd288fed045859ed18bffd973').digest('hex'));assert.equal(o.headers.Cookie,'buvid3=current; buvid4=four')});
test('unknown appkey atomically passes original',()=>assert.deepEqual(r({url:app+'?appkey=unknown&access_key=private&sign=old',headers},{mode:'pure'}).out,{}));
test('capture Cookie and standalone Buvid without modifying request',()=>{for(const h of [headers,{BUVID:'device'}]){const o=run('tabulabili-capture',{url:web,headers:h});assert.deepEqual(o.out,{});assert.ok(o.store.tabulabili_fingerprint);assert.ok(!o.store.tabulabili_fingerprint.includes('SESSDATA'))}});
test('capture empty and store exception single done',()=>{assert.deepEqual(run('tabulabili-capture',{url:web}).out,{});assert.deepEqual(run('tabulabili-capture',{url:web,headers}, {}, {},undefined,true).out,{})});
function risk(code,items=[],arg={},s={}){return run('tabulabili-risk',{url:web},arg,s,JSON.stringify({code,data:{item:items}}))}
test('risk success silent unless debug enabled',()=>{assert.equal(risk(0,[{}]).logs.length,0);assert.ok(risk(0,[{}],{risk_debug:true}).logs.length);assert.equal(risk(0,[{}]).notes.length,0)});
test('risk notifications disabled',()=>{const o=risk(-352,[],{risk_notify:false});assert.equal(o.notes.length,0);assert.deepEqual(o.out,{})});
test('risk per-kind throttle even after alternating codes',()=>{const s={};assert.equal(risk(-352,[],{},s).notes.length,1);assert.equal(risk(0,[],{},s).notes.length,1);assert.equal(risk(-352,[],{},s).notes.length,0);for(const k of Object.keys(s))if(k.includes('last_notify_'))s[k]=String(Date.now()-31*60*1000);assert.equal(risk(-352,[],{},s).notes.length,1)});
test('risk business and nonJSON leave response unchanged',()=>{assert.deepEqual(risk(-400).out,{});for(const body of ['not JSON','',undefined]){const o=run('tabulabili-risk',{url:web},{},{},body);assert.deepEqual(o.out,{});assert.equal(o.notes.length,0)}});
test('no sensitive identity in logs',()=>{const o=r({url:app+'?appkey=unknown&access_key=private',headers},{mode:'refresh'});assert.ok(!o.logs.join('').includes('private'))});
console.log(`${tests} JS regression tests passed`);
