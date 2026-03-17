import { AppError, ERROR_CODES, handleError } from "../_shared/errors.ts";
import { ok, corsHeaders } from "../_shared/response.ts";
import { createAdminClient } from "../_shared/db.ts";
import { verifyAuth, requireOrgRole, getUserOrgId } from "../_shared/auth.ts";
Deno.serve(async (req: Request) => {
  if (req.method==="OPTIONS") return new Response(null,{status:204,headers:corsHeaders});
  try {
    const url=new URL(req.url);
    const {userId,supabase}=await verifyAuth(req);
    const orgId=await getUserOrgId(userId);
    await requireOrgRole(supabase,orgId,userId,"admin");
    const admin=createAdminClient();
    const {data:org}=await admin.from("organizations").select("plan").eq("id",orgId).single();
    const orgPlan=org?.plan??"free";
    if (orgPlan==="free"||orgPlan==="starter") throw new AppError(ERROR_CODES.PLAN_LIMIT_EXCEEDED,"Audit logs require Professional or Team plan",403);
    const page=Math.max(1,parseInt(url.searchParams.get("page")??"1"));
    const limit=Math.min(100,Math.max(1,parseInt(url.searchParams.get("limit")??"20")));
    const offset=(page-1)*limit;
    const action=url.searchParams.get("action");
    const filterUserId=url.searchParams.get("user_id");
    const from=url.searchParams.get("from");
    const to=url.searchParams.get("to");
    const maxDays=orgPlan==="team"?365:90;
    const cutoff=new Date(Date.now()-maxDays*24*60*60*1000).toISOString();
    let query=admin.from("audit_logs").select("*",{count:"exact"}).eq("org_id",orgId).gte("created_at",cutoff);
    if (action) query=query.eq("action",action);
    if (filterUserId) query=query.eq("user_id",filterUserId);
    if (from) query=query.gte("created_at",from);
    if (to) query=query.lte("created_at",to);
    const {data,error,count}=await query.order("created_at",{ascending:false}).range(offset,offset+limit-1);
    if (error) throw new AppError(ERROR_CODES.INTERNAL_ERROR,"Failed to fetch audit logs",500);
    return ok({data:data??[],total:count??0,page,limit});
  } catch(err){return handleError(err);}
});