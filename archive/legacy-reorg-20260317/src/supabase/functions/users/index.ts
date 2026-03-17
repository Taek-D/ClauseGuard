import { AppError, ERROR_CODES, handleError } from "../_shared/errors.ts";
import { ok, noContent, corsHeaders } from "../_shared/response.ts";
import { createAdminClient } from "../_shared/db.ts";
import { verifyAuth, getUserOrgId, requirePlan } from "../_shared/auth.ts";
import { validateBody, validateString, validateEnum } from "../_shared/validators.ts";
Deno.serve(async (req: Request) => {
  if (req.method==="OPTIONS") return new Response(null,{status:204,headers:corsHeaders});
  try {
    const url=new URL(req.url);
    const path=url.pathname.replace(/^\/users/,"");
    if (path==="/me" && req.method==="GET") {
      const {userId}=await verifyAuth(req);
      const admin=createAdminClient();
      const {data,error}=await admin.from("users").select("id,email,name,auth_provider,role_preference,mfa_enabled,language,created_at,last_login_at").eq("id",userId).single();
      if (error||!data) throw new AppError(ERROR_CODES.NOT_FOUND,"User not found",404);
      return ok(data);
    }
    if (path==="/me" && req.method==="PATCH") {
      const {userId}=await verifyAuth(req);
      const body=await validateBody<{name?:string;language?:string;role_preference?:string}>(req);
      const updates: Record<string,unknown>={};
      if (body.name!==undefined) updates.name=validateString(body.name,"name",{min:1,max:100});
      if (body.language!==undefined) updates.language=validateEnum(body.language,"language",["ko","en"] as const);
      if (body.role_preference!==undefined) updates.role_preference=validateEnum(body.role_preference,"role_preference",["executive","legal","sales","freelancer"] as const);
      if (Object.keys(updates).length===0) throw new AppError(ERROR_CODES.VALIDATION_ERROR,"No valid fields to update",400);
      const admin=createAdminClient();
      const {data,error}=await admin.from("users").update(updates).eq("id",userId).select("id,email,name,auth_provider,role_preference,mfa_enabled,language,created_at,last_login_at").single();
      if (error||!data) throw new AppError(ERROR_CODES.INTERNAL_ERROR,"Failed to update user",500);
      return ok(data);
    }
    if (path==="/me" && req.method==="DELETE") {
      const {userId}=await verifyAuth(req);
      const body=await validateBody<{confirm:string}>(req);
      if (body.confirm!=="DELETE") throw new AppError(ERROR_CODES.VALIDATION_ERROR,"confirm must be DELETE",400);
      const admin=createAdminClient();
      const {error}=await admin.auth.admin.deleteUser(userId);
      if (error) throw new AppError(ERROR_CODES.INTERNAL_ERROR,"Failed to delete user",500);
      return noContent();
    }
    if (path==="/me/api-key" && req.method==="GET") {
      const {userId,supabase}=await verifyAuth(req);
      const orgId=await getUserOrgId(userId);
      await requirePlan(supabase,orgId,"professional");
      const admin=createAdminClient();
      const {data}=await admin.from("api_keys").select("key,created_at").eq("user_id",userId).single();
      return ok({key:data?.key??null,created_at:data?.created_at??null});
    }
    if (path==="/me/api-key" && req.method==="POST") {
      const {userId,supabase}=await verifyAuth(req);
      const orgId=await getUserOrgId(userId);
      await requirePlan(supabase,orgId,"professional");
      const key="cg_live_"+crypto.randomUUID().replace(/-/g,"");
      const admin=createAdminClient();
      await admin.from("api_keys").upsert({user_id:userId,key,created_at:new Date().toISOString()},{onConflict:"user_id"});
      return ok({key});
    }
    throw new AppError(ERROR_CODES.NOT_FOUND,"Endpoint not found",404);
  } catch(err){return handleError(err);}
});