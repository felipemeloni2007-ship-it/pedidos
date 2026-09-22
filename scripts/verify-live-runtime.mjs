// Run against a local dev server with disposable Supabase Auth fixtures.
// Input JSON on stdin: {url, key, email, password, origin}. Never logs credentials.
import { createServerClient } from '@supabase/ssr';
process.stdin.setRawMode?.(true);
let input='';for await(const part of process.stdin){input+=part;if(/[\r\n]/.test(input))break;}
const config=JSON.parse(input);const jar=new Map();
const auth=createServerClient(config.url,config.key,{cookies:{getAll:()=>[...jar].map(([name,value])=>({name,value})),setAll:values=>values.forEach(c=>jar.set(c.name,c.value))}});
const login=await auth.auth.signInWithPassword({email:config.email,password:config.password});
if(login.error)throw Error('Fixture login failed: '+login.error.message);
const cookie=[...jar].map(([name,value])=>name+'='+value).join('; ');
async function request(path,body,signed=true){const r=await fetch(config.origin+path,{method:'POST',headers:{'Content-Type':'application/json',Origin:config.origin,...(signed?{Cookie:cookie}:{})},body:JSON.stringify(body),redirect:'manual'});const data=await r.json();if(!r.ok)throw Error(path+': '+r.status+' '+JSON.stringify(data));return data;}
const slug='verification-'+crypto.randomUUID().slice(0,8);
const created=await request('/api/onboarding',{tenantName:'Verificação temporária',tenantSlug:slug,storeName:'Loja temporária',storeSlug:slug});
const store=created.onboarding[0];
console.log(JSON.stringify({fixture:store}));
await request('/api/stores/'+store.created_store_id,{action:'category',name:'Refeições'});
const categories=await auth.from('categories').select('id').eq('store_id',store.created_store_id);
if(categories.error||categories.data.length!==1)throw Error('Category persistence failed');
await request('/api/stores/'+store.created_store_id,{action:'product',name:'Prato teste',description:'Produto temporário',category_id:categories.data[0].id,base_price:25,is_available:true});
await request('/api/stores/'+store.created_store_id,{action:'settings',accepting_orders:true,is_storefront_published:true,accepts_delivery:false,accepts_pickup:true,default_prep_minutes:20});
const catalog=await auth.rpc('get_storefront_catalog',{p_store_slug:slug});
const product=catalog.data?.categories?.[0]?.products?.[0];if(!product)throw Error('Published catalog unavailable');
const payload={slug,key:crypto.randomUUID(),mode:'pickup',customer:{name:'Cliente de teste',phone:'11988887777'},items:[{productId:product.id,quantity:2,selections:{}}]};
const order=await request('/api/checkout',payload,false);if(Number(order.total)!==50)throw Error('Incorrect total');
const repeated=await request('/api/checkout',payload,false);if(repeated.id!==order.id)throw Error('Duplicate order');
for(const status of ['confirmed','preparing','ready','delivered'])await request('/api/stores/'+store.created_store_id,{action:'order',id:order.id,status});
const tracking=await request('/api/tracking',{id:order.id,token:order.trackingToken},false);if(tracking.status!=='delivered')throw Error('Tracking not updated');
const blocked=await fetch(config.origin+'/api/stores/'+store.created_store_id,{method:'POST',headers:{Origin:config.origin,'Content-Type':'application/json'},body:JSON.stringify({action:'availability',id:product.id,is_available:false})});
if(blocked.status!==401)throw Error('Unauthenticated mutation accepted');
const storefront=await fetch(config.origin+'/loja/'+slug);if(!storefront.ok||!(await storefront.text()).includes('Prato teste'))throw Error('Storefront render failed');
await auth.auth.signOut();
console.log(JSON.stringify({result:'PASS',checks:['auth','onboarding','category persistence','product persistence','publish','guest checkout','canonical price','idempotency','kitchen lifecycle','tracking','unauthorized mutation rejected','storefront SSR'],tenant:store.created_tenant_id,store:store.created_store_id}));
