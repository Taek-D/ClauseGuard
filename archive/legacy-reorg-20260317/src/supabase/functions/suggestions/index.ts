import { AppError, ERROR_CODES, handleError } from "../_shared/errors.ts";
import { ok, corsHeaders } from "../_shared/response.ts";
import { createAdminClient } from "../_shared/db.ts";
import { verifyAuth, requireOrgRole } from "../_shared/auth.ts";
import { validateBody } from "../_shared/validators.ts";
Deno.serve(async (req: Request) => {
  if (req.method==="OPTIONS") return new Response(null,{status:204,headers:corsHeaders});
  try {
    const url=new URL(req.url);
    const path=url.pathname.replace(/^\/suggestions/,"");
    const segs=path.split("/").filter(Boolean);
    const {userId,supabase}=await verifyAuth(req);
    const admin=createAdminClient();
    if (segs.length===1 && req.method==="GET") {
      const riskId=segs[0];
      const {data:risk}=await admin.from("risks").select("contract_id").eq("id",riskId).single();
      if (!risk) throw new AppError(ERROR_CODES.NOT_FOUND,"Risk not found",404);
      const {data:contract}=await admin.from("contracts").select("org_id").eq("id",risk.contract_id).single();
      if (!contract) throw new AppError(ERROR_CODES.NOT_FOUND,"Contract not found",404);
      await requireOrgRole(supabase,contract.org_id,userId,"viewer");
      const {data,error}=await admin.from("suggestions").select("*").eq("risk_id",riskId);
      if (error) throw new AppError(ERROR_CODES.INTERNAL_ERROR,"Failed to fetch suggestions",500);
      return ok(data??[]);
    }
    if (segs.length===2 && segs[1]==="feedback" && req.method==="PATCH") {
      const suggestionId=segs[0];
      const body=await validateBody<{accepted:boolean}>(req);
      if (typeof body.accepted!=="boolean") throw new AppError(ERROR_CODES.VALIDATION_ERROR,"accepted must be boolean",400);
      const {data:suggestion}=await admin.from("suggestions").select("risk_id").eq("id",suggestionId).single();
      if (!suggestion) throw new AppError(ERROR_CODES.NOT_FOUND,"Suggestion not found",404);
      const {data:risk}=await admin.from("risks").select("contract_id").eq("id",suggestion.risk_id).single();
      if (!risk) throw new AppError(ERROR_CODES.NOT_FOUND,"Risk not found",404);
      const {data:contract}=await admin.from("contracts").select("org_id").eq("id",risk.contract_id).single();
      if (!contract) throw new AppError(ERROR_CODES.NOT_FOUND,"Contract not found",404);
      await requireOrgRole(supabase,contract.org_id,userId,"viewer");
      const {data,error}=await admin.from("suggestions").update({accepted:body.accepted}).eq("id",suggestionId).select("*").single();
      if (error||!data) throw new AppError(ERROR_CODES.INTERNAL_ERROR,"Failed to update",500);
      return ok(data);
    }
    throw new AppError(ERROR_CODES.NOT_FOUND,"Endpoint not found",404);
  } catch(err){return handleError(err);}
});