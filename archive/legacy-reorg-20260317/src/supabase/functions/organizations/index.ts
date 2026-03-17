import { AppError, ERROR_CODES, handleError } from "../_shared/errors.ts";
import { ok, noContent, corsHeaders } from "../_shared/response.ts";
import { createAdminClient } from "../_shared/db.ts";
import { verifyAuth, requireOrgRole } from "../_shared/auth.ts";
import { validateBody, validateString, validateEnum, validateEmail } from "../_shared/validators.ts";
import { logAudit } from "../_shared/audit.ts";
Deno.serve(async (req: Request) => {
  if (req.method==="OPTIONS") return new Response(null,{status:204,headers:corsHeaders});
  try {
    const url=new URL(req.url); const path=url.pathname.replace(/^\/organizations/,"");
    const segs=path.split("/").filter(Boolean); const orgId=segs[0];
    if (!orgId) throw new AppError(ERROR_CODES.NOT_FOUND,"Endpoint not found",404);
    const {userId,supabase}=await verifyAuth(req); const admin=createAdminClient();
    if (segs.length===1 && req.method==="GET") {
      await requireOrgRole(supabase,orgId,userId,"viewer");
      const {data,error}=await admin.from("organizations").select("*").eq("id",orgId).single();
      if (error||!data) throw new AppError(ERROR_CODES.NOT_FOUND,"Org not found",404);
      return ok(data);
    }
    if (segs.length===1 && req.method==="PATCH") {
      await requireOrgRole(supabase,orgId,userId,"admin");
      const body=await validateBody<{name?:string;industry?:string}>(req);
      const updates:Record<string,unknown>={updated_at:new Date().toISOString()};
      if (body.name!==undefined) updates.name=validateString(body.name,"name",{min:1,max:200});
      if (body.industry!==undefined) updates.industry=validateEnum(body.industry,"industry",["saas","manufacturing","realestate","service","other"] as const);
      const {data,error}=await admin.from("organizations").update(updates).eq("id",orgId).select("*").single();
      if (error||!data) throw new AppError(ERROR_CODES.INTERNAL_ERROR,"Failed",500);
      return ok(data);
    }
    if (segs[1]==="members" && segs.length===2 && req.method==="GET") {
      await requireOrgRole(supabase,orgId,userId,"viewer");
      const {data,error}=await admin.from("org_members").select("*").eq("org_id",orgId);
      if (error) throw new AppError(ERROR_CODES.INTERNAL_ERROR,"Failed",500);
      return ok(data??[]);
    }
    if (segs[1]==="invite" && segs.length===2 && req.method==="POST") {
      await requireOrgRole(supabase,orgId,userId,"admin");
      const body=await validateBody<{email:string;role:string}>(req);
      const email=validateEmail(body.email,"email");
      const role=validateEnum(body.role,"role",["admin","member","viewer"] as const);
      const {data:org}=await admin.from("organizations").select("plan").eq("id",orgId).single();
      if (org?.plan==="team") {
        const {data:sub}=await admin.from("subscriptions").select("seat_limit").eq("org_id",orgId).eq("status","active").single();
        if (sub?.seat_limit) {
          const {count}=await admin.from("org_members").select("id",{count:"exact",head:true}).eq("org_id",orgId).eq("status","active");
          if ((count??0)>=sub.seat_limit) throw new AppError(ERROR_CODES.ORG_SEAT_LIMIT,"Seat limit reached",403);
        }
      }
      const inviteToken=crypto.randomUUID(); const memberId=crypto.randomUUID();
      const {data:member,error}=await admin.from("org_members").insert({id:memberId,org_id:orgId,user_id:crypto.randomUUID(),role,invited_at:new Date().toISOString(),joined_at:null,status:"pending",invite_token:inviteToken}).select("*").single();
      if (error) throw new AppError(ERROR_CODES.INTERNAL_ERROR,"Failed to invite",500);
      await logAudit(supabase,{orgId,userId,action:"invite",resourceType:"org_member",resourceId:memberId,metadata:{email,role}});
      return ok({member,invite_token:inviteToken});
    }
    if (segs[1]==="invite" && segs[2]==="accept" && req.method==="POST") {
      const body=await validateBody<{token:string}>(req);
      if (!body.token) throw new AppError(ERROR_CODES.VALIDATION_ERROR,"token required",400);
      const {data:member,error}=await admin.from("org_members").update({joined_at:new Date().toISOString(),status:"active",user_id:userId}).eq("org_id",orgId).eq("invite_token",body.token).eq("status","pending").select("*").single();
      if (error||!member) throw new AppError(ERROR_CODES.NOT_FOUND,"Invite not found",404);
      return ok(member);
    }
    if (segs[1]==="members" && segs[2] && segs.length===3) {
      const memberId=segs[2];
      if (req.method==="PATCH") {
        await requireOrgRole(supabase,orgId,userId,"admin");
        const body=await validateBody<{role:string}>(req);
        const role=validateEnum(body.role,"role",["admin","member","viewer"] as const);
        const {data:ex}=await admin.from("org_members").select("role").eq("id",memberId).eq("org_id",orgId).single();
        if (ex?.role==="owner") throw new AppError(ERROR_CODES.FORBIDDEN,"Cannot change owner",403);
        const {data,error}=await admin.from("org_members").update({role}).eq("id",memberId).eq("org_id",orgId).select("*").single();
        if (error||!data) throw new AppError(ERROR_CODES.NOT_FOUND,"Not found",404);
        await logAudit(supabase,{orgId,userId,action:"role_change",resourceType:"org_member",resourceId:memberId,metadata:{new_role:role}});
        return ok(data);
      }
      if (req.method==="DELETE") {
        await requireOrgRole(supabase,orgId,userId,"admin");
        const {data:ex}=await admin.from("org_members").select("role").eq("id",memberId).eq("org_id",orgId).single();
        if (ex?.role==="owner") throw new AppError(ERROR_CODES.FORBIDDEN,"Cannot remove owner",403);
        const {error}=await admin.from("org_members").update({status:"deactivated"}).eq("id",memberId).eq("org_id",orgId);
        if (error) throw new AppError(ERROR_CODES.NOT_FOUND,"Not found",404);
        return noContent();
      }
    }
    throw new AppError(ERROR_CODES.NOT_FOUND,"Endpoint not found",404);
  } catch(err){return handleError(err);}
});