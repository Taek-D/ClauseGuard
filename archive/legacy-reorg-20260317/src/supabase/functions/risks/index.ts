import { AppError, ERROR_CODES, handleError } from "../_shared/errors.ts";
import { ok, corsHeaders } from "../_shared/response.ts";
import { createAdminClient } from "../_shared/db.ts";
import { verifyAuth, requireOrgRole } from "../_shared/auth.ts";
Deno.serve(async (req: Request) => {
  if (req.method==="OPTIONS") return new Response(null,{status:204,headers:corsHeaders});
  try {
    const url=new URL(req.url);
    const path=url.pathname.replace(/^\/risks/,"");
    const segs=path.split("/").filter(Boolean);
    const {userId,supabase}=await verifyAuth(req);
    const admin=createAdminClient();
    if (segs.length===0 && req.method==="GET") {
      const contractId=url.searchParams.get("contractId");
      if (!contractId) throw new AppError(ERROR_CODES.VALIDATION_ERROR,"contractId required",400);
      const {data:contract}=await admin.from("contracts").select("org_id").eq("id",contractId).single();
      if (!contract) throw new AppError(ERROR_CODES.NOT_FOUND,"Contract not found",404);
      await requireOrgRole(supabase,contract.org_id,userId,"viewer");
      let query=admin.from("risks").select("*").eq("contract_id",contractId);
      const severity=url.searchParams.get("severity");
      if (severity) query=query.eq("severity",severity);
      const {data,error}=await query.order("order_index",{ascending:true});
      if (error) throw new AppError(ERROR_CODES.INTERNAL_ERROR,"Failed to fetch risks",500);
      const sOrd:Record<string,number>={high:0,medium:1,low:2};
      const sorted=(data??[]).sort((a:Record<string,unknown>,b:Record<string,unknown>)=>{
        const sd=(sOrd[a.severity as string]??3)-(sOrd[b.severity as string]??3);
        return sd!==0?sd:(a.order_index as number)-(b.order_index as number);
      });
      return ok(sorted);
    }
    if (segs.length===1 && req.method==="GET") {
      const riskId=segs[0];
      const {data:risk,error}=await admin.from("risks").select("*,clauses(*)").eq("id",riskId).single();
      if (error||!risk) throw new AppError(ERROR_CODES.NOT_FOUND,"Risk not found",404);
      const {data:contract}=await admin.from("contracts").select("org_id").eq("id",risk.contract_id).single();
      if (!contract) throw new AppError(ERROR_CODES.NOT_FOUND,"Contract not found",404);
      await requireOrgRole(supabase,contract.org_id,userId,"viewer");
      return ok(risk);
    }
    throw new AppError(ERROR_CODES.NOT_FOUND,"Endpoint not found",404);
  } catch(err){return handleError(err);}
});