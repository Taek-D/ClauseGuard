import { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import { AppError, ERROR_CODES, handleError } from "../_shared/errors.ts";
import { ok, created, corsHeaders } from "../_shared/response.ts";
import { createAdminClient } from "../_shared/db.ts";
import { verifyAuth, requireOrgRole, requirePlan, getUserOrgId } from "../_shared/auth.ts";
import { validateBody, validateEnum } from "../_shared/validators.ts";
import { logAudit } from "../_shared/audit.ts";
import type { FullReport, Risk } from "../_shared/types.ts";

async function buildReport(admin: SupabaseClient, contractId: string, scopeFilter?: string): Promise<FullReport> {
  const {data:contract}=await admin.from("contracts").select("*").eq("id",contractId).single();
  const {data:analysis}=await admin.from("analyses").select("*").eq("contract_id",contractId).order("started_at",{ascending:false}).limit(1).single();
  let risksQuery=admin.from("risks").select("*").eq("contract_id",contractId);
  if (scopeFilter==="high_risk_only") risksQuery=risksQuery.eq("severity","high");
  const {data:risks}=await risksQuery.order("order_index",{ascending:true});
  const enriched=await Promise.all((risks??[]).map(async(risk: Risk)=>{
    const {data:clause}=await admin.from("clauses").select("*").eq("id",risk.clause_id).single();
    const {data:suggestion}=await admin.from("suggestions").select("*").eq("risk_id",risk.id).limit(1).single();
    return {...risk,clause:clause??null,suggestion:suggestion??null};
  }));
  const allRisks=risks??[];
  return {contract,analysis:analysis??null,risks:enriched,summary:{
    high_count:allRisks.filter((r:Risk)=>r.severity==="high").length,
    medium_count:allRisks.filter((r:Risk)=>r.severity==="medium").length,
    low_count:allRisks.filter((r:Risk)=>r.severity==="low").length,
    overall_score:contract?.overall_risk_score??null
  }};
}

Deno.serve(async (req: Request) => {
  if (req.method==="OPTIONS") return new Response(null,{status:204,headers:corsHeaders});
  try {
    const url=new URL(req.url);
    const path=url.pathname.replace(/^\/reports/,"");
    const segs=path.split("/").filter(Boolean);
    const admin=createAdminClient();
    if (segs[0]==="shared" && segs[1] && req.method==="GET") {
      const token=segs[1];
      const {data:link,error:linkErr}=await admin.from("share_links").select("*").eq("token",token).single();
      if (linkErr||!link) throw new AppError(ERROR_CODES.NOT_FOUND,"Share link not found",404);
      if (new Date(link.expires_at)<new Date()) throw new AppError(ERROR_CODES.SHARE_LINK_EXPIRED,"Link expired",403);
      await admin.from("share_links").update({accessed_at:new Date().toISOString()}).eq("id",link.id);
      const report=await buildReport(admin,link.contract_id,link.scope);
      return ok(report);
    }
    if (segs.length===1 && req.method==="GET") {
      const contractId=segs[0];
      const tokenParam=url.searchParams.get("token");
      if (tokenParam) {
        const {data:link}=await admin.from("share_links").select("*").eq("token",tokenParam).eq("contract_id",contractId).single();
        if (!link) throw new AppError(ERROR_CODES.FORBIDDEN,"Invalid token",403);
        if (new Date(link.expires_at)<new Date()) throw new AppError(ERROR_CODES.SHARE_LINK_EXPIRED,"Expired",403);
      } else {
        const {userId,supabase}=await verifyAuth(req);
        const {data:c}=await admin.from("contracts").select("org_id").eq("id",contractId).single();
        if (!c) throw new AppError(ERROR_CODES.NOT_FOUND,"Contract not found",404);
        await requireOrgRole(supabase,c.org_id,userId,"viewer");
      }
      const report=await buildReport(admin,contractId);
      return ok(report);
    }
    if (segs.length===2 && segs[1]==="export" && req.method==="POST") {
      const contractId=segs[0];
      const {userId,supabase}=await verifyAuth(req);
      const {data:c}=await admin.from("contracts").select("org_id").eq("id",contractId).single();
      if (!c) throw new AppError(ERROR_CODES.NOT_FOUND,"Contract not found",404);
      await requireOrgRole(supabase,c.org_id,userId,"member");
      await requirePlan(supabase,c.org_id,"starter");
      const body=await validateBody<{format:string;language?:string;scope?:string}>(req);
      const html="<html><body><h1>Contract Report</h1><p>ID: "+contractId+"</p></body></html>";
      const pdfBytes=new TextEncoder().encode(html);
      const exportKey="exports/"+contractId+"/report-"+Date.now()+".html";
      await admin.storage.from("contracts").upload(exportKey,pdfBytes,{contentType:"text/html"});
      const {data:signedData}=await admin.storage.from("contracts").createSignedUrl(exportKey,3600);
      const expiresAt=new Date(Date.now()+3600*1000).toISOString();
      const orgId=await getUserOrgId(userId);
      await logAudit(supabase,{orgId,userId,action:"export",resourceType:"contract",resourceId:contractId,metadata:{format:body.format}});
      return ok({url:signedData?.signedUrl??null,expires_at:expiresAt});
    }
    if (segs.length===2 && segs[1]==="share" && req.method==="POST") {
      const contractId=segs[0];
      const {userId,supabase}=await verifyAuth(req);
      const {data:c}=await admin.from("contracts").select("org_id").eq("id",contractId).single();
      if (!c) throw new AppError(ERROR_CODES.NOT_FOUND,"Contract not found",404);
      await requireOrgRole(supabase,c.org_id,userId,"member");
      await requirePlan(supabase,c.org_id,"professional");
      const body=await validateBody<{recipient_email?:string;scope:string;expires_in_days?:number}>(req);
      const scope=validateEnum(body.scope,"scope",["full_report","high_risk_only"] as const);
      const expiresInDays=body.expires_in_days??7;
      const expiresAt=new Date(Date.now()+expiresInDays*24*60*60*1000).toISOString();
      const token=crypto.randomUUID();
      const {data:link,error}=await admin.from("share_links").insert({id:crypto.randomUUID(),contract_id:contractId,created_by:userId,token,recipient_email:body.recipient_email??null,scope,expires_at:expiresAt}).select("*").single();
      if (error||!link) throw new AppError(ERROR_CODES.INTERNAL_ERROR,"Failed to create share link",500);
      await logAudit(supabase,{orgId:c.org_id,userId,action:"share",resourceType:"contract",resourceId:contractId,metadata:{scope,token}});
      return created(link);
    }
    throw new AppError(ERROR_CODES.NOT_FOUND,"Endpoint not found",404);
  } catch(err){return handleError(err);}
});