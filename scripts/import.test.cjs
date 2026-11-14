require('./register-local-ts.cjs');
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const Module = require('node:module');
const { parseImportJSON, getImportRowError } = require('../lib/admin/importParser.ts');
const { classify, isProtectedCategory, needsCategoryReview, prepareImport } = require('../lib/admin/classification.ts');
const { planImport } = require('../lib/admin/importPlan.ts');
const { parseCategoryResponse, buildCategoryPrompt, isLLMCandidate } = require('../lib/admin/llmCategories.ts');
const { classifyFoodKeywords } = require('../lib/admin/categoryKeywords.ts');
const { inferCategoryKey } = require('../lib/utils/categoryIcon.ts');
const row = { placeId: '123', name: '테스트', address: '서울 테스트로 1', lat: 37.5, lng: 127, category: '음식점', categoryCode: 'DINING' };
const raw = (path, code = 'DINING') => ({ originalCategory: { provider: 'naver', label: '음식점', code, cidPath: path.split('/') } });
test('generic dining remains Idle; detail takes precedence over Korean', () => {
  assert.equal(inferCategoryKey('음식점'), 'Idle');
  assert.equal(inferCategoryKey('음식점 > 한식 > 고기구이'), 'Meat');
  assert.equal(inferCategoryKey('한식 > 해산물'), 'Sea');
});
test('supported paths, specialized precedence, conflicts and unknown paths', () => {
  assert.equal(classify(raw('220036/220037/220055')).categoryKey, 'Korea');
  assert.equal(classify(raw('220036/220037/220075/220767/221540')).categoryKey, 'Meat');
  assert.equal(classify(raw('220036/220037/220053')).categoryKey, 'Korea');
  assert.equal(classify(raw('220036/220039/220091/220861')).categoryKey, 'China');
  assert.equal(classify(raw('999/888/777')).categoryKey, 'Idle');
  assert.equal(classify(raw('999/888/777', 'CAFE')).categoryKey, 'Cafe');
  assert.equal(classify(raw('999/888/777', 'BAR')).categoryKey, 'Beer');
});
test('actual nonfood Other and unresolved dining are distinct', () => {
  assert.equal(classify({ category: '공원' }).categoryKey, 'Other');
  assert.equal(classify({ category: '쇼핑', categoryCode: 'SHOPPING' }).categoryKey, 'Idle');
  assert.equal(needsCategoryReview({ categoryKey: 'Other', categoryCode: 'DINING' }), true);
  assert.equal(needsCategoryReview({ categoryKey: 'Other', category: '음식점' }), true);
  assert.equal(needsCategoryReview({ categoryKey: 'Other', classification: { source: 'manual' } }), false);
  assert.equal(needsCategoryReview({ categoryKey: 'Other', classification: { source: 'rule', needsReview: false } }), false);
});
test('parser preserves path, memo, original label and manual selection', () => {
  const rows = parseImportJSON(JSON.stringify({ bookmarkList: [{ sid: '123', name: '테스트', address: '서울', px: 127, py: 37, mcid: 'DINING', mcidName: '음식점', cidPath: ['220036','220037','220055'], memo: '메모' }] }));
  assert.deepEqual(rows[0].originalCategory.cidPath, ['220036','220037','220055']);
  assert.equal(rows[0].memo, '메모'); assert.equal(rows[0].categoryKey, 'Korea');
  assert.equal(rows[0].originalCategory.label, '음식점');
  assert.throws(() => parseImportJSON(JSON.stringify({ bookmarkList: [{sid:'x',cidPath:['not-a-code']}] })));
  assert.equal(prepareImport({ ...row, categoryKey: 'Japan', classification: { source: 'manual' } }).categoryKey, 'Japan');
  assert.equal(prepareImport({ ...row, categoryKey: 'Japan', classification: { source: 'rule' } }).categoryKey, 'Idle');
});
test('rejects invalid coordinates, IDs, categories, raw paths and provenance', () => {
  for (const patch of [{ lat: NaN }, { lng: Infinity }, { lat: 91 }, { placeId: '../x' }, { categoryKey: 'Bogus' }, { name: 1 }, { originalCategory: {provider:'naver',label:'a',code:'b',cidPath:[2]} }, { classification: {source:'llm'} }]) assert.ok(getImportRowError({ ...row, ...patch }));
  assert.equal(getImportRowError(row), undefined);
});
test('duplicate IDs invalid; cross-provider or numeric collision held for review', () => {
  assert.equal(planImport([row,row], [])[1].status, 'INVALID');
  const existing = [{ ...row, placeId: 'kakao1', mapProvider: 'kakao' }];
  assert.equal(planImport([row], existing)[0].matchKind, 'possible');
  assert.equal(planImport([row], [{...row,mapProvider:'kakao',name:'違う',address:'別'}])[0].matchKind, 'possible');
  assert.equal(planImport([row], [{...row,placeId:'canonical',naverPlaceId:'123',mapProvider:'kakao'}])[0].targetId, 'canonical');
});
test('manual and legacy categories are protected', () => {
  assert.ok(isProtectedCategory({ categoryKey: 'Other', classification: {source:'manual'} }));
  assert.ok(isProtectedCategory({ categoryKey: 'Korea' }));
  assert.ok(isProtectedCategory({ categoryKey: 'Other' }));
  assert.equal(isProtectedCategory({ categoryKey:'Other',categoryCode:'DINING' }), false);
});
const place = { ...row, originalCategory: raw('999/888/777').originalCategory, categoryKey: 'Idle' };
test('LLM includes address/raw path; rejects hallucinated IDs, invalid categories, duplicates and manual overwrites', () => {
  const prompt = buildCategoryPrompt([place]);
  assert.ok(prompt.includes(row.address)); assert.ok(prompt.includes('cidPath')); assert.ok(prompt.includes('Idle'));
  const valid = { placeId:'123',categoryKey:'Idle',reason:'정보 부족' };
  assert.equal(parseCategoryResponse(JSON.stringify([valid]), [place])[0].expectedCategoryKey, 'Idle');
  for(const list of [[{...valid,placeId:'unknown'}],[{...valid,categoryKey:'bad'}],[valid,valid],[{...valid,reason:''}]]) assert.throws(() => parseCategoryResponse(JSON.stringify(list),[place]));
  assert.throws(() => parseCategoryResponse(JSON.stringify([valid]),[{...place,classification:{source:'manual'}}]));
});
test('food keyword priorities cover compound dishes without guessing opaque brands', () => {
  const examples = {
    '고향순대국전문점':'Korea', '한우갈비탕':'Korea', '흑돼지 김치찌개':'Korea',
    '베트남 쌀국수':'Asian', '인도커리 탄두리':'Asian', '해물짬뽕':'China', '중화반점':'China',
    '장어덮밥':'Japan', '경양식 돈까스':'West', '왕돈까스':'Japan', '새우버거':'West',
    '판문점숯불갈비':'Meat', '우리 양다리 양꼬치':'Meat', '텍사스바베큐':'Meat',
    '삼양동 삼다도 아구탕':'Sea', '행복장어':'Sea', '새우만두':'Snack',
    '대창통닭':'Snack', '서울바베큐치킨':'Snack', '고향떡집':'Cafe', '비어펍':'Beer',
    '주공식육점':'Other', '주공식육식당':'Meat', '몽토랑산양목장&뷰카페':'Cafe',
    'Cafe Test':'Cafe', 'Fried Chicken':'Snack', 'BBQ House':'Meat',
  };
  for(const [name, key] of Object.entries(examples)) assert.equal(classifyFoodKeywords(name)?.key, key, name);
  for(const name of ['한일식당','천일식당','신한양 식당','산중식당','산야초밥상','행복집','행복식당','신발원','별천지','집','바','회','면','republic']) assert.equal(classifyFoodKeywords(name), undefined, name);
});
test('specific ingredients refine Korean paths; native cafe/bar and manual selections still win', () => {
  assert.equal(classify({...raw('220036/220037/220055'),name:'한우갈비'}).categoryKey,'Meat');
  assert.equal(classify({...raw('220036/220037/220055'),name:'장어구이'}).categoryKey,'Sea');
  assert.equal(classify({...raw('220036/220037/220075/220767/221540'),name:'갈비탕'}).categoryKey,'Korea');
  assert.equal(classify({...raw('220036/220037/220075/220767/221540'),name:'돈비어천가'}).categoryKey,'Meat');
  assert.equal(classify({...raw('220036/220037/220055','CAFE'),name:'한우카페'}).categoryKey,'Cafe');
  assert.equal(classify({...raw('220036/220037/220055','BAR'),name:'갈비포차'}).categoryKey,'Beer');
  assert.equal(prepareImport({...row,name:'한우갈비',categoryKey:'Sea',classification:{source:'manual'}}).categoryKey,'Sea');
});
test('only rule-unresolved places reach LLM; stale responses for rule-resolvable places are rejected', () => {
  const resolvable = {...place,name:'김밥집'};
  assert.equal(isLLMCandidate(resolvable),false);
  assert.equal(isLLMCandidate(place),true);
  assert.ok(!buildCategoryPrompt([resolvable]).includes('김밥집'));
  assert.throws(()=>parseCategoryResponse(JSON.stringify([{placeId:place.placeId,categoryKey:'Korea',reason:'guess'}]),[resolvable]));
});

// Firebase adapter is replaced before any route import. No credentials/network/production DB.
let records = new Map(); let requests = new Map(); let writes = 0; let sequence = 0;
const makeDoc = id => ({ id, ref: ref(id), exists: records.has(id), data: () => records.get(id) });
const ref = id => ({ id, get: async () => makeDoc(id) });
const query = { get: async () => ({ docs: [...records.keys()].map(makeDoc) }), where: () => query };
const db = { collection: name => name === 'users' ? { doc: () => ({ get: async () => ({data: () => ({role:'owner'})}) }) } : name === 'requests' ? {doc: id => ({get: async () => ({exists:requests.has(id),data:()=>requests.get(id)}),update:async value=>{writes++;requests.set(id,{...requests.get(id),...value});}})} : name === 'places' ? { ...query, doc: id => ref(id) } : { doc: () => ({id:`log${++sequence}`}), add: async () => {writes++;} },
  runTransaction: async fn => {
    const ops=[];
    const result=await fn({get: async r => makeDoc(r.id), getAll: async (...refs) => refs.map(r => makeDoc(r.id)),
      update: (r,v) => ops.push([r,v,false]),create:(r,v) => ops.push([r,v,true])});
    for(const [r,v,create] of ops){ writes++; if(!r.id.startsWith('log')) records.set(r.id,create?v:{...records.get(r.id),...v}); }
    return result;
  } };
const load = Module._load;
Module._load = function(name, parent, main) { if(name === '@/lib/firebase/admin') return { adminDb:db,adminAuth:{verifyIdToken:async()=>({uid:'owner'})},admin:{firestore:{FieldValue:{serverTimestamp:()=> 'timestamp'}}} }; return load.call(this,name,parent,main); };
const importRoute = require('../app/api/admin/import/route.ts');
const categories = require('../app/api/admin/places/categories/route.ts');
const listing = require('../app/api/admin/places/route.ts');
const requestRoute = require('../app/api/requests/[requestId]/route.ts');
const request = body => ({ headers:new Headers({authorization:'Bearer test'}), json:async()=>body });
test('import API dry-run never writes and validates server-side', async () => {
  records=new Map(); writes=0;
  let response = await importRoute.POST(request({rows:[row],dryRun:true}));
  assert.equal(response.status,200);assert.equal(writes,0);
  response=await importRoute.POST(request({rows:[{...row,categoryKey:'bad'}]}));assert.equal(response.status,400);assert.equal(writes,0);
  response=await importRoute.POST(request({rows:[row],duplicatePolicy:'anything'}));assert.equal(response.status,400);
});
test('import SKIP default, UPDATE retains canonical ID, manual category and linked fields',async()=>{
  const old = {...row, mapProvider:'naver',categoryKey:'Meat',category:'직접 분류',categoryCode:'DINING', classification:{source:'manual',reason:'직접 선택'}, reviews:['r1'],avgTier:'S',photos:['p1'],createdBy:'original',createdAt:'original-time',status:'active'};
  records=new Map([['123',old]]);writes=0;
  await importRoute.POST(request({rows:[{...row,name:'변경'}]}));assert.equal(records.get('123').name,row.name);
  await importRoute.POST(request({rows:[{...row,name:'변경'}],duplicatePolicy:'UPDATE'}));
  const updated=records.get('123'); assert.equal(updated.name,'변경');
  for(const key of ['categoryKey','category','classification','reviews','avgTier','photos','createdBy','createdAt']) assert.deepEqual(updated[key],old[key]);
  assert.deepEqual([...records.keys()],['123']);
});
test('cross-provider possible duplicates skipped even with UPDATE; new owner bound to token',async()=>{
  records=new Map([['k1',{...row,placeId:'k1',mapProvider:'kakao',createdBy:'old'}]]);
  const r = await (await importRoute.POST(request({rows:[row],duplicatePolicy:'UPDATE'}))).json();assert.equal(r.skipped,1);assert.equal(records.size,1);
  records=new Map();await importRoute.POST(request({rows:[row],ownerUid:'spoof'}));assert.equal(records.get('123').createdBy,'owner');assert.equal(records.get('123').naverPlaceId,'123');
});
test('category mutation preserves raw codes, validates IDs, allows Idle, prevents automatic manual overwrite',async()=>{
  records=new Map([['123',{...row,categoryKey:'Other',status:'active'}]]);writes=0;
  let r=await categories.PATCH(request({updates:[{placeId:'123',categoryKey:'Idle',expectedCategoryKey:'Other'}]}));assert.equal(r.status,200);
  assert.equal(records.get('123').categoryCode,'DINING');assert.equal(records.get('123').originalCategory.code,'DINING');
  r=await categories.PATCH(request({source:'llm',updates:[{placeId:'123',categoryKey:'Korea',expectedCategoryKey:'Idle',reason:'x'}]}));assert.equal(r.status,409);
  r=await categories.PATCH(request({updates:[{placeId:'not-found',categoryKey:'Korea',expectedCategoryKey:'Idle'}]}));assert.equal(r.status,409);
  r=await categories.PATCH(request({updates:[{placeId:'123',categoryKey:'bad',expectedCategoryKey:'Idle'}]}));assert.equal(r.status,400);
});
test('category API rejects LLM updates for places that current rules can resolve',async()=>{
  records=new Map([['123',{...row,name:'김밥집',categoryKey:'Idle',status:'active'}]]);
  let response=await categories.PATCH(request({source:'llm',updates:[{placeId:'123',categoryKey:'Korea',expectedCategoryKey:'Idle',reason:'추정'}]}));
  assert.equal(response.status,409);assert.equal(records.get('123').categoryKey,'Idle');
  response=await categories.PATCH(request({source:'rule',updates:[{placeId:'123',categoryKey:'Snack',expectedCategoryKey:'Idle'}]}));
  assert.equal(response.status,200);assert.equal(records.get('123').classification.source,'rule');
  records=new Map([['123',{...row,categoryKey:'Idle',status:'active'}]]);
  response=await categories.PATCH(request({source:'llm',updates:[{placeId:'123',categoryKey:'Idle',expectedCategoryKey:'Idle',reason:'정보 부족'}]}));
  assert.equal(response.status,200);assert.equal(records.get('123').classification.source,'llm');assert.equal(records.get('123').classification.needsReview,true);
});
test('rules preview and obsolete cleanup do not write; stale manual preview rejected',async()=>{
  records=new Map([['123',{...row,categoryKey:'Other',status:'active'}]]);writes=0;
  let r=await categories.POST(request({action:'preview'}));const body=await r.json();assert.equal(body.proposals.length,1);assert.equal(writes,0);
  r=await categories.POST(request({action:'cleanup'}));assert.equal(r.status,400);assert.equal(writes,0);
  records.get('123').categoryKey='Meat';records.get('123').classification={source:'manual'};
  r=await categories.PATCH(request({source:'rule',updates:[{placeId:'123',categoryKey:'Idle',expectedCategoryKey:'Other'}]}));assert.equal(r.status,409);assert.equal(writes,0);
});
test('listing and total use same predicate, include missing key and legacy Other, exclude actual Other',async()=>{
  records=new Map([['1',{...row,categoryKey:'Other',status:'active'}],['2',{...row,categoryKey:'Idle',status:'active'}],['3',{...row,status:'active'}],['4',{...row,categoryKey:'Other',classification:{source:'manual'},status:'active'}]]);
  const req=request();req.nextUrl=new URL('https://local/api/admin/places?filter=idle&limit=2');
  const body=await (await listing.GET(req)).json();assert.equal(body.pagination.total,3);assert.equal(body.places.length,2);assert.equal(body.pagination.hasMore,true);
});
test('approved user category requests mark manual provenance and keep raw category',async()=>{
  records=new Map([['123',{...row,categoryKey:'Idle',classification:{source:'rule'},status:'active'}]]);
  requests=new Map([['req1',{status:'open',type:'place_edit',placeId:'123',payload:{categoryKey:'Sea',category:'spoof',categoryCode:'erase'}}]]);
  const response=await requestRoute.PATCH(request({action:'approve'}),{params:Promise.resolve({requestId:'req1'})});
  assert.equal(response.status,200);assert.equal(records.get('123').classification.source,'manual');assert.equal(records.get('123').categoryCode,'DINING');
  assert.equal(records.get('123').originalCategory.code,'DINING');assert.equal(records.get('123').category,'해산물/횟집');
  assert.ok(isProtectedCategory(records.get('123')));
});
