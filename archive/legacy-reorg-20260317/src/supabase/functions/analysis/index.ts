import { AppError, ERROR_CODES, handleError } from "../_shared/errors.ts";
import { ok, corsHeaders } from "../_shared/response.ts";
import { createAdminClient } from "../_shared/db.ts";
import { verifyAuth, requireOrgRole } from "../_shared/auth.ts";
import { validateBody } from "../_shared/validators.ts";
Deno.serve(async (req: Request) => {
  if (req.method==="OPTIONS") return new Response(null,{status:204,headers:corsHeaders});
  try {
    const url=new URL(req.url);
    const path=url.pathname.replace(/^\/analysis/,"");
    const segs=path.split("/").filter(Boolean);
    const admin=createAdminClient();
    if (segs.length===2 && segs[1]==="progress" && req.method==="PATCH") {
      if (req.headers.get("X-Internal-Key")!==Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")) throw new AppError(ERROR_CODES.UNAUTHORIZED,"Invalid key",401);
      const body=await validateBody<{status:string;progress_pct:number;error_message?:string}>(req);
      const updates:Record<string,unknown>={status:body.status,progress_pct:body.progress_pct};
      if (body.error_message!==undefined) updates.error_message=body.error_message;
      if (body.status==="completed") updates.completed_at=new Date().toISOString();
      const {data:analysis,error}=await admin.from("analyses").update(updates).eq("id",segs[0]).select("*").single();
      if (error||!analysis) throw new AppError(ERROR_CODES.NOT_FOUND,"Analysis not found",404);
      if (body.status==="completed") await admin.from("contracts").update({status:"completed"}).eq("id",analysis.contract_id);
      else if (body.status==="failed") await admin.from("contracts").update({status:"failed"}).eq("id",analysis.contract_id);
      return ok(analysis);
    }
    if (segs.length===2 && segs[1]==="start" && req.method==="POST") {
      const contractId=segs[0];
      const {userId,supabase}=await verifyAuth(req);
      const {data:contract}=await admin.from("contracts").select("org_id,status").eq("id",contractId).single();
      if (!contract) throw new AppError(ERROR_CODES.NOT_FOUND,"Contract not found",404);
      await requireOrgRole(supabase,contract.org_id,userId,"member");
      if (contract.status==="analyzing"||contract.status==="parsing") throw new AppError(ERROR_CODES.ANALYSIS_IN_PROGRESS,"Already in progress",409);
      const {data:ex}=await admin.from("analyses").select("status").eq("contract_id",contractId).order("started_at",{ascending:false}).limit(1).single();
      if (ex?.status==="completed") throw new AppError(ERROR_CODES.ANALYSIS_IN_PROGRESS,"Already completed",409);
      const {data:analysis,error}=await admin.from("analyses").update({status:"parsing",progress_pct:0}).eq("contract_id",contractId).select("*").single();
      if (error||!analysis) throw new AppError(ERROR_CODES.INTERNAL_ERROR,"Failed",500);
      await admin.from("contracts").update({status:"parsing"}).eq("id",contractId);
      return ok(analysis);
    }
    if (segs.length===2 && segs[1]==="stream" && req.method==="GET") {
      const contractId=segs[0];
      const {userId,supabase}=await verifyAuth(req);
      const {data:contract}=await admin.from("contracts").select("org_id").eq("id",contractId).single();
      if (!contract) throw new AppError(ERROR_CODES.NOT_FOUND,"Contract not found",404);
      await requireOrgRole(supabase,contract.org_id,userId,"viewer");
      const stream=new ReadableStream({async start(controller){
        const enc=new TextEncoder();
        let ls="",lp=-1,it=0;
        while(it<120){
          it++;
          await new Promise(r=>setTimeout(r,2000));
          const {data:a}=await admin.from("analyses").select("status,progress_pct").eq("contract_id",contractId).order("started_at",{ascending:false}).limit(1).single();
          if(!a) break;
          if(a.status!==ls||a.progress_pct!==lp){
            ls=a.status; lp=a.progress_pct;
            controller.enqueue(enc.encode("data: "+JSON.stringify({status:a.status,progress_pct:a.progress_pct})+"\n\n"));
          }
          if(a.status==="completed"||a.status==="failed"){
            controller.enqueue(enc.encode("data: "+JSON.stringify({done:true})+"\n\n"));
            break;
          }
        }
        controller.close();
      }});
      return new Response(stream,{headers:{...corsHeaders,"Content-Type":"text/event-stream","Cache-Control":"no-cache","Connection":"keep-alive"}});
    }
    if (segs.length===1 && req.method==="GET") {
      const contractId=segs[0];
      const {userId,supabase}=await verifyAuth(req);
      const {data:contract}=await admin.from("contracts").select("org_id").eq("id",contractId).single();
      if (!contract) throw new AppError(ERROR_CODES.NOT_FOUND,"Contract not found",404);
      await requireOrgRole(supabase,contract.org_id,userId,"viewer");
      const {data:analysis,error}=await admin.from("analyses").select("*").eq("contract_id",contractId).order("started_at",{ascending:false}).limit(1).single();
      if (error||!analysis) throw new AppError(ERROR_CODES.NOT_FOUND,"Analysis not found",404);
      return ok(analysis);
    }
    throw new AppError(ERROR_CODES.NOT_FOUND,"Endpoint not found",404);
  } catch(err){return handleError(err);}
});