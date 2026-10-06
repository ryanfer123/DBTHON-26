// Operator smoke check: creates a synthetic pending account; never resets data.
const path=require('node:path');
const {chromium,expect}=require(require.resolve('@playwright/test',{paths:[path.resolve(__dirname,'../apps/web')]}));
const frontend=process.env.DBTHON_FRONTEND_ORIGIN;
const apiBase=process.env.DBTHON_API_BASE_URL;
if(process.env.DBTHON_LIVE_SMOKE!=='create-synthetic-account'||!frontend||!apiBase){
 console.error('Set DBTHON_LIVE_SMOKE=create-synthetic-account, DBTHON_FRONTEND_ORIGIN and DBTHON_API_BASE_URL.'); process.exit(1);
}
const {randomUUID,randomBytes}=require('node:crypto');
(async()=>{
 const browser=await chromium.launch({channel:'chrome',headless:true});
 const context=await browser.newContext({viewport:{width:390,height:844}});
 const page=await context.newPage(); page.setDefaultTimeout(30000);
 const api=apiBase.replace(/\/+$/,'');
 const password=randomBytes(24).toString('base64url'), email=`connection-${randomUUID()}@example.com`;
 try {
  await page.goto(frontend+'/register',{waitUntil:'networkidle'});
  await expect(page.locator('#zone')).toBeVisible({timeout:30000});
  await page.locator('#name').fill('Synthetic connection verification');
  await page.locator('#phone').fill('+120255501'+String(randomBytes(1)[0]%99).padStart(2,'0'));
  await page.locator('#email').fill(email); await page.locator('#password').fill(password);
  await page.locator('#zone').selectOption('1');
  await page.locator('#latitude').fill('12.975091'); await page.locator('#longitude').fill('79.165917');
  const registration=page.waitForResponse(r=>r.url()===api+'/auth/register');
  await page.getByRole('button',{name:'Create account',exact:true}).click();
  const registered=await registration; if(registered.status()!==201){ const error=await registered.json().catch(()=>({})); throw Error('Registration failed '+registered.status()+' '+(error.error?.code||'')+' '+(error.error?.message||'')); }
  await expect(page).toHaveURL(/\/sign-in$/);
  await page.locator('#password').fill(password);
  const login=page.waitForResponse(r=>r.url()===api+'/auth/login');
  await page.getByRole('button',{name:'Sign in',exact:true}).click();
  if((await login).status()!==200)throw Error('Login failed');
  await expect(page).toHaveURL(/\/dashboard$/);
  await expect(page.getByRole('heading',{name:'Your dashboard'})).toBeVisible();
  await expect(page.getByText('Your requested roles are awaiting review. Keep your details current and check your verification status.',{exact:true})).toBeVisible();
  await page.reload({waitUntil:'networkidle'});
  await expect(page.getByRole('heading',{name:'Your dashboard'})).toBeVisible();
  const cookies=await context.cookies(api);
  const cookie=cookies.find(c=>c.httpOnly);
  if(!cookie||!cookie.secure||cookie.sameSite!=='None')throw Error('Production session cookie flags failed');
  const result=await page.evaluate(async base=>{
   const get=await fetch(base+'/auth/me',{credentials:'include'});
   const overview=await fetch(base+'/workspace/overview',{credentials:'include'});
   const denied=await fetch(base+'/auth/logout',{method:'POST',credentials:'include',headers:{'Content-Type':'application/json','X-Requested-With':'SecondTable'},body:'{}'});
   return {me:get.status,overview:overview.status,csrf:denied.status};
  },api);
  if(result.me!==200||result.overview!==200||result.csrf!==403)throw Error('Private session/CSRF checks failed '+JSON.stringify(result));
  await page.goto(frontend+'/account',{waitUntil:'networkidle'});
  await expect(page.getByRole('heading',{name:'Your account'})).toBeVisible();
  const overflow=await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth);
  if(overflow)throw Error('390px account overflow');
  const logout=page.waitForResponse(r=>r.url()===api+'/auth/logout');
  await page.getByRole('button',{name:'Sign out',exact:true}).click();
  if((await logout).status()!==204)throw Error('Sign out failed');
  console.log(JSON.stringify({registration:201,login:200,dashboard:true,reload_session:true,secure_http_only_same_site_none:true,...result,mobile_overflow:false,logout:204,synthetic_account_created:true}));
 } finally {await browser.close()}
})().catch(e=>{console.error(e.message);process.exitCode=1});
