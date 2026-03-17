import { AppError, ERROR_CODES, handleError } from "../_shared/errors.ts";
import { ok, created, corsHeaders } from "../_shared/response.ts";
import { createAdminClient } from "../_shared/db.ts";
import { verifyAuth, requireOrgRole, getUserOrgId } from "../_shared/auth.ts";
import { validateBody, validateEnum } from "../_shared/validators.ts";
import { logAudit } from "../_shared/audit.ts";

async function stripeReq(method:string,spath:string,body?:Record<string,unknown>):Promise<Record<string,unknown>>{
  const key=Deno.env.get("STRIPE_SECRET_KEY")!;
  const init:RequestInit={method,headers:{Authorization:"Bearer "+key,"Content-Type":"application/x-www-form-urlencoded"}};
  if(body) init.body=Object.entries(body).map(([k,v])=>encodeURIComponent(k)+"="+encodeURIComponent(String(v))).join("&");
  const res=await fetch("https://api.stripe.com/v1"+spath,init);
  const json=await res.json();
  if(!res.ok) throw new AppError(ERROR_CODES.INTERNAL_ERROR,"Stripe error: "+(json?.error?.message??"unknown"),500);
  return json;
}

Deno.serve(async (req:Request)=>{
  if(req.method==="OPTIONS") return new Response(null,{status:204,headers:corsHeaders});
  try{
    const url=new URL(req.url);
    const path=url.pathname.replace(/^\/subscriptions/,"");
    const admin=createAdminClient();

    if(path==="/webhook"&&req.method==="POST"){
      const sig=req.headers.get("Stripe-Signature");
      if(!sig) throw new AppError(ERROR_CODES.UNAUTHORIZED,"Missing Stripe-Signature",401);
      const secret=Deno.env.get("STRIPE_WEBHOOK_SECRET")!;
      const payload=await req.text();
      const parts=sig.split(",");
      const ts=(parts.find((x:string)=>x.startsWith("t="))??"t=").slice(2);
      const v1=(parts.find((x:string)=>x.startsWith("v1="))??"v1=").slice(3);
      const wkey=await crypto.subtle.importKey("raw",new TextEncoder().encode(secret),{name:"HMAC",hash:"SHA-256"},false,["sign"]);
      const mac=await crypto.subtle.sign("HMAC",wkey,new TextEncoder().encode(ts+"."+payload));
      const hex=Array.from(new Uint8Array(mac)).map(b=>b.toString(16).padStart(2,"0")).join("");
      if(hex!==v1) throw new AppError(ERROR_CODES.UNAUTHORIZED,"Signature mismatch",401);
      const event=JSON.parse(payload);
      const obj=event.data?.object;
      if(event.type==="customer.subscription.updated"&&obj){
        await admin.from("subscriptions").update({status:obj.status,current_period_start:new Date(obj.current_period_start*1000).toISOString(),current_period_end:new Date(obj.current_period_end*1000).toISOString()}).eq("stripe_subscription_id",obj.id);
      }else if(event.type==="customer.subscription.deleted"&&obj){
        const {data:sub}=await admin.from("subscriptions").update({status:"cancelled"}).eq("stripe_subscription_id",obj.id).select("org_id").single();
        if(sub) await admin.from("organizations").update({plan:"free",updated_at:new Date().toISOString()}).eq("id",sub.org_id);
      }else if(event.type==="invoice.payment_failed"&&obj){
        await admin.from("subscriptions").update({status:"past_due"}).eq("stripe_customer_id",obj.customer);
      }
      return ok({received:true});
    }

    const {userId,supabase}=await verifyAuth(req);
    const orgId=await getUserOrgId(userId);

    if(req.method==="GET"){
      const {data,error}=await admin.from("subscriptions").select("*").eq("org_id",orgId).single();
      if(error||!data) throw new AppError(ERROR_CODES.NOT_FOUND,"Subscription not found",404);
      return ok(data);
    }

    if(req.method==="POST"){
      await requireOrgRole(supabase,orgId,userId,"owner");
      const body=await validateBody<{plan:string;billing_cycle:string;payment_method_id:string}>(req);
      const plan=validateEnum(body.plan,"plan",["starter","professional","team"] as const);
      const bc=validateEnum(body.billing_cycle,"billing_cycle",["monthly","annual"] as const);
      const {data:org}=await admin.from("organizations").select("name").eq("id",orgId).single();
      const {data:usr}=await admin.from("users").select("email").eq("id",userId).single();
      const cust=await stripeReq("POST","/customers",{email:usr?.email??"no-email",name:org?.name??""});
      const custId=String(cust.id);
      const priceId=Deno.env.get("STRIPE_PRICE_"+plan.toUpperCase()+"_"+bc.toUpperCase())??"price_"+plan+"_"+bc;
      const sub=await stripeReq("POST","/subscriptions",{customer:custId,"items[0][price]":priceId,default_payment_method:body.payment_method_id});
      const seatMap:Record<string,number>={starter:5,professional:20,team:100};
      const pStart=new Date(Number(sub.current_period_start)*1000).toISOString();
      const pEnd=new Date(Number(sub.current_period_end)*1000).toISOString();
      const {data:rec,error}=await admin.from("subscriptions").upsert({id:crypto.randomUUID(),org_id:orgId,plan,status:String(sub.status),billing_cycle:bc,current_period_start:pStart,current_period_end:pEnd,stripe_customer_id:custId,stripe_subscription_id:String(sub.id),seat_limit:seatMap[plan]??5},{onConflict:"org_id"}).select("*").single();
      if(error||!rec) throw new AppError(ERROR_CODES.INTERNAL_ERROR,"Failed to create subscription",500);
      await admin.from("organizations").update({plan,updated_at:new Date().toISOString()}).eq("id",orgId);
      return created(rec);
    }

    if(req.method==="PATCH"){
      await requireOrgRole(supabase,orgId,userId,"owner");
      const body=await validateBody<{plan:string}>(req);
      const plan=validateEnum(body.plan,"plan",["starter","professional","team"] as const);
      const {data:sub}=await admin.from("subscriptions").select("*").eq("org_id",orgId).single();
      if(!sub||!sub.stripe_subscription_id) throw new AppError(ERROR_CODES.NOT_FOUND,"No active subscription",404);
      const priceId=Deno.env.get("STRIPE_PRICE_"+plan.toUpperCase());
      if(!priceId) throw new AppError(ERROR_CODES.INTERNAL_ERROR,"Price not configured for plan: "+plan,500);
      const stripeSub=await stripeReq("GET","/subscriptions/"+sub.stripe_subscription_id) as {items:{data:Array<{id:string}>}};
      const itemId=stripeSub.items.data[0].id;
      await stripeReq("POST","/subscriptions/"+sub.stripe_subscription_id,{"items[0][id]":itemId,"items[0][price]":priceId,proration_behavior:"create_prorations"});
      const seatMap:Record<string,number>={starter:5,professional:20,team:100};
      const {data:updated,error:updateErr}=await admin.from("subscriptions").update({plan,seat_limit:seatMap[plan]??5,updated_at:new Date().toISOString()}).eq("org_id",orgId).select("*").single();
      if(updateErr||!updated) throw new AppError(ERROR_CODES.INTERNAL_ERROR,"Failed to update subscription",500);
      await admin.from("organizations").update({plan,updated_at:new Date().toISOString()}).eq("id",orgId);
      await logAudit(supabase,{orgId,userId,action:"settings_change",resourceType:"subscription",resourceId:orgId,metadata:{old_plan:sub.plan,new_plan:plan}});
      return ok(updated);
    }

    if(req.method==="DELETE"){
      await requireOrgRole(supabase,orgId,userId,"owner");
      const {data:sub}=await admin.from("subscriptions").select("*").eq("org_id",orgId).single();
      if(!sub||!sub.stripe_subscription_id) throw new AppError(ERROR_CODES.NOT_FOUND,"No active subscription",404);
      await stripeReq("POST","/subscriptions/"+sub.stripe_subscription_id,{cancel_at_period_end:"true"});
      const {data:cancelled,error:cancelErr}=await admin.from("subscriptions").update({status:"cancelled",updated_at:new Date().toISOString()}).eq("org_id",orgId).select("*").single();
      if(cancelErr||!cancelled) throw new AppError(ERROR_CODES.INTERNAL_ERROR,"Failed to cancel subscription",500);
      await admin.from("organizations").update({plan:"free",updated_at:new Date().toISOString()}).eq("id",orgId);
      await logAudit(supabase,{orgId,userId,action:"settings_change",resourceType:"subscription",resourceId:orgId,metadata:{cancelled_plan:sub.plan}});
      return ok(cancelled);
    }

    throw new AppError(ERROR_CODES.NOT_FOUND,"Endpoint not found",404);
  } catch(err){return handleError(err);}
});


파일 쓰기 권한을 승인하시면 위 내용으로 즉시 저장합니다. 수정 요약:

| 파일 | 수정 내용 |
|------|-----------|
| `auth/index.ts` | `verifyAuth(supabase)→verifyAuth(req)`, `validateRequired→validateString`, `AppError` 인자 순서, regex, `withCors` 제거 |
| `subscriptions/index.ts` | PATCH/DELETE 완전 재작성 (`adminClient`→`admin`, 누락 import 추가, 잘못된 `verifyAuth` 제거) |
| `analysis/index.ts` | regex, SSE `\n\n` 리터럴 수정 |
| `reports/index.ts` | `buildReport` 파라미터 타입 `SupabaseClient`로 교체, regex |
| `organizations/index.ts` | regex, invite accept 토큰 매칭 로직 수정 |
| `contracts/index.ts` | regex, `formData.get()` null 체크 추가 |
| `audit-logs/index.ts` | `const plan=supabase` 불필요 변수 제거 |
| 나머지 5개 | regex `/^\/함수명/` 수정 |