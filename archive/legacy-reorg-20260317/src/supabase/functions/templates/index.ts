import { AppError, ERROR_CODES, handleError } from "../_shared/errors.ts";
import { ok, created, corsHeaders } from "../_shared/response.ts";
import { createAdminClient } from "../_shared/db.ts";
import { verifyAuth, requireOrgRole, requirePlan, getUserOrgId } from "../_shared/auth.ts";
import { validateBody, validateString, validateEnum } from "../_shared/validators.ts";
import type { TemplateRuleInput } from "../_shared/types.ts";
Deno.serve(async (req: Request) => {
  if (req.method==="OPTIONS") return new Response(null,{status:204,headers:corsHeaders});
  try {
    const url=new URL(req.url);
    const path=url.pathname.replace(/^\/templates/,"");
    const segs=path.split("/").filter(Boolean);
    const {userId,supabase}=await verifyAuth(req);
    const admin=createAdminClient();
    const orgId=await getUserOrgId(userId);
    if (segs.length===0 && req.method==="GET") {
      const industry=url.searchParams.get("industry");
      const contractType=url.searchParams.get("contract_type");
      const isSystem=url.searchParams.get("is_system");
      let query=admin.from("templates").select("*");
      if (isSystem==="true") { query=query.eq("is_system",true); }
      else if (isSystem==="false") { query=query.eq("org_id",orgId).eq("is_system",false); }
      else { query=query.or("is_system.eq.true,org_id.eq."+orgId); }
      if (industry) query=query.eq("industry",industry);
      if (contractType) query=query.eq("contract_type",contractType);
      const {data,error}=await query.order("created_at",{ascending:false});
      if (error) throw new AppError(ERROR_CODES.INTERNAL_ERROR,"Failed to fetch templates",500);
      return ok(data??[]);
    }
    if (segs.length===0 && req.method==="POST") {
      await requirePlan(supabase,orgId,"professional");
      const body=await validateBody<{name:string;industry:string;contract_type:string;base_template_id?:string;rules:TemplateRuleInput[]}>(req);
      const name=validateString(body.name,"name",{min:1,max:200});
      const industry=validateEnum(body.industry,"industry",["saas","manufacturing","realestate","service","other"] as const);
      const contractType=validateEnum(body.contract_type,"contract_type",["subscription","nda","service","partnership","lease","other"] as const);
      const templateId=crypto.randomUUID();
      const {data:template,error:tErr}=await admin.from("templates").insert({id:templateId,org_id:orgId,name,industry,contract_type:contractType,is_system:false,base_template_id:body.base_template_id??null,rule_count:(body.rules??[]).length,created_at:new Date().toISOString(),updated_at:new Date().toISOString()}).select("*").single();
      if (tErr||!template) throw new AppError(ERROR_CODES.INTERNAL_ERROR,"Failed to create template",500);
      const rules=(body.rules??[]).map((r:TemplateRuleInput,i:number)=>({id:crypto.randomUUID(),template_id:templateId,clause_category:r.clause_category,rule_description:r.rule_description,severity_if_violated:r.severity_if_violated,benchmark_text:r.benchmark_text??null,order_index:r.order_index??i}));
      if (rules.length>0) await admin.from("template_rules").insert(rules);
      const {data:ruleData}=await admin.from("template_rules").select("*").eq("template_id",templateId).order("order_index",{ascending:true});
      return created({...template,rules:ruleData??[]});
    }
    if (segs.length===1) {
      const templateId=segs[0];
      if (req.method==="GET") {
        const {data:template,error}=await admin.from("templates").select("*").eq("id",templateId).single();
        if (error||!template) throw new AppError(ERROR_CODES.NOT_FOUND,"Template not found",404);
        if (!template.is_system && template.org_id!==orgId) throw new AppError(ERROR_CODES.FORBIDDEN,"Access denied",403);
        const {data:rules}=await admin.from("template_rules").select("*").eq("template_id",templateId).order("order_index",{ascending:true});
        return ok({...template,rules:rules??[]});
      }
      if (req.method==="PATCH") {
        await requirePlan(supabase,orgId,"professional");
        const {data:template}=await admin.from("templates").select("*").eq("id",templateId).single();
        if (!template) throw new AppError(ERROR_CODES.NOT_FOUND,"Template not found",404);
        if (template.is_system) throw new AppError(ERROR_CODES.FORBIDDEN,"Cannot modify system template",403);
        if (template.org_id!==orgId) throw new AppError(ERROR_CODES.FORBIDDEN,"Access denied",403);
        const body=await validateBody<{name?:string;rules?:TemplateRuleInput[]}>(req);
        const updates:Record<string,unknown>={updated_at:new Date().toISOString()};
        if (body.name!==undefined) updates.name=validateString(body.name,"name",{min:1,max:200});
        if (body.rules!==undefined) {
          await admin.from("template_rules").delete().eq("template_id",templateId);
          const rules=body.rules.map((r:TemplateRuleInput,i:number)=>({id:crypto.randomUUID(),template_id:templateId,clause_category:r.clause_category,rule_description:r.rule_description,severity_if_violated:r.severity_if_violated,benchmark_text:r.benchmark_text??null,order_index:r.order_index??i}));
          if (rules.length>0) await admin.from("template_rules").insert(rules);
          updates.rule_count=rules.length;
        }
        const {data:updated,error}=await admin.from("templates").update(updates).eq("id",templateId).select("*").single();
        if (error||!updated) throw new AppError(ERROR_CODES.INTERNAL_ERROR,"Failed to update",500);
        const {data:ruleData}=await admin.from("template_rules").select("*").eq("template_id",templateId).order("order_index",{ascending:true});
        return ok({...updated,rules:ruleData??[]});
      }
      if (req.method==="DELETE") {
        const {data:template}=await admin.from("templates").select("*").eq("id",templateId).single();
        if (!template) throw new AppError(ERROR_CODES.NOT_FOUND,"Template not found",404);
        if (template.is_system) throw new AppError(ERROR_CODES.FORBIDDEN,"Cannot delete system template",403);
        if (template.org_id!==orgId) throw new AppError(ERROR_CODES.FORBIDDEN,"Access denied",403);
        await admin.from("template_rules").delete().eq("template_id",templateId);
        await admin.from("templates").delete().eq("id",templateId);
        return new Response(null,{status:204,headers:corsHeaders});
      }
    }
    throw new AppError(ERROR_CODES.NOT_FOUND,"Endpoint not found",404);
  } catch(err){return handleError(err);}
});