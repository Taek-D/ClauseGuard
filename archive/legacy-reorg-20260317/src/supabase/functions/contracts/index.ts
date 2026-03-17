import { AppError, ERROR_CODES, handleError } from "../_shared/errors.ts";
import { ok, created, noContent, corsHeaders } from "../_shared/response.ts";
import { createAdminClient } from "../_shared/db.ts";
import { verifyAuth, requireOrgRole, getUserOrgId } from "../_shared/auth.ts";
import { validateEnum } from "../_shared/validators.ts";
import { logAudit } from "../_shared/audit.ts";
const MAX_FILE_SIZE=52428800;
const ALLOWED_TYPES=["pdf","docx","hwp"] as const;
Deno.serve(async (req: Request) => {
  if (req.method==="OPTIONS") return new Response(null,{status:204,headers:corsHeaders});
  try {
    const url=new URL(req.url);
    const path=url.pathname.replace(/^\/contracts/,"");
    const segs=path.split("/").filter(Boolean);
    const {userId,supabase}=await verifyAuth(req);
    const admin=createAdminClient();
    if (segs.length===0 && req.method==="GET") {
      const orgId=await getUserOrgId(userId);
      await requireOrgRole(supabase,orgId,userId,"viewer");
      const page=Math.max(1,parseInt(url.searchParams.get("page")??"1"));
      const limit=Math.min(100,Math.max(1,parseInt(url.searchParams.get("limit")??"20")));
      const offset=(page-1)*limit;
      let query=admin.from("contracts").select("*",{count:"exact"}).eq("org_id",orgId).is("deleted_at",null);
      const industry=url.searchParams.get("industry");
      const riskLevel=url.searchParams.get("risk_level");
      const contractType=url.searchParams.get("contract_type");
      const search=url.searchParams.get("search");
      if (industry) query=query.eq("industry",industry);
      if (riskLevel) query=query.eq("risk_level",riskLevel);
      if (contractType) query=query.eq("contract_type",contractType);
      if (search) query=query.ilike("file_name","%"+search+"%");
      const {data,error,count}=await query.order("created_at",{ascending:false}).range(offset,offset+limit-1);
      if (error) throw new AppError(ERROR_CODES.INTERNAL_ERROR,"Failed to fetch contracts",500);
      return ok({data:data??[],total:count??0,page,limit});
    }
    if (segs.length===0 && req.method==="POST") {
      const orgId=await getUserOrgId(userId);
      await requireOrgRole(supabase,orgId,userId,"member");
      const formData=await req.formData();
      const file=formData.get("file") as File|null;
      if (!file) throw new AppError(ERROR_CODES.VALIDATION_ERROR,"file is required",400);
      if (file.size>MAX_FILE_SIZE) throw new AppError(ERROR_CODES.FILE_TOO_LARGE,"File exceeds 50MB",400);
      const ext=file.name.split(".").pop()?.toLowerCase()??"";
      if (!ALLOWED_TYPES.includes(ext as typeof ALLOWED_TYPES[number])) throw new AppError(ERROR_CODES.INVALID_FILE_TYPE,"Invalid file type",400);
      const industryVal=formData.get("industry");
      const contractTypeVal=formData.get("contract_type");
      const partyPositionVal=formData.get("party_position");
      const industry=validateEnum(typeof industryVal==="string"?industryVal:"","industry",["saas","manufacturing","realestate","service","other"] as const);
      const contractType=validateEnum(typeof contractTypeVal==="string"?contractTypeVal:"","contract_type",["subscription","nda","service","partnership","lease","other"] as const);
      const partyPosition=validateEnum(typeof partyPositionVal==="string"?partyPositionVal:"","party_position",["provider","consumer"] as const);
      const templateId=formData.get("template_id") as string|null;
      const focusAreasRaw=formData.get("focus_areas") as string|null;
      const contractId=crypto.randomUUID();
      const storageKey="contracts/"+orgId+"/"+contractId+"/"+file.name;
      const {error:storageError}=await admin.storage.from("contracts").upload(storageKey,await file.arrayBuffer(),{contentType:file.type});
      if (storageError) throw new AppError(ERROR_CODES.INTERNAL_ERROR,"Upload failed",500);
      const expiresAt=new Date(Date.now()+90*24*60*60*1000).toISOString();
      const {data:contract,error:dbError}=await admin.from("contracts").insert({id:contractId,org_id:orgId,uploaded_by:userId,file_name:file.name,file_type:ext,file_size_bytes:file.size,file_storage_key:storageKey,industry,contract_type:contractType,party_position:partyPosition,status:"uploaded",template_id:templateId??null,expires_at:expiresAt,created_at:new Date().toISOString()}).select("*").single();
      if (dbError||!contract) throw new AppError(ERROR_CODES.INTERNAL_ERROR,"Failed to save contract",500);
      await admin.from("analyses").insert({id:crypto.randomUUID(),contract_id:contractId,status:"parsing",progress_pct:0,started_at:new Date().toISOString(),model_version:"v1",focus_areas:focusAreasRaw?JSON.parse(focusAreasRaw):null});
      await logAudit(supabase,{orgId,userId,action:"upload",resourceType:"contract",resourceId:contractId});
      return created(contract);
    }
    if (segs.length===1) {
      const contractId=segs[0];
      if (req.method==="GET") {
        const {data:contract,error}=await admin.from("contracts").select("*").eq("id",contractId).is("deleted_at",null).single();
        if (error||!contract) throw new AppError(ERROR_CODES.NOT_FOUND,"Contract not found",404);
        const tokenParam=url.searchParams.get("token");
        if (tokenParam) {
          const {data:link}=await admin.from("share_links").select("*").eq("token",tokenParam).eq("contract_id",contractId).single();
          if (!link) throw new AppError(ERROR_CODES.FORBIDDEN,"Invalid token",403);
          if (new Date(link.expires_at)<new Date()) throw new AppError(ERROR_CODES.SHARE_LINK_EXPIRED,"Link expired",403);
        } else { await requireOrgRole(supabase,contract.org_id,userId,"viewer"); }
        const {data:analysis}=await admin.from("analyses").select("*").eq("contract_id",contractId).order("started_at",{ascending:false}).limit(1).single();
        return ok({...contract,analysis:analysis??null});
      }
      if (req.method==="DELETE") {
        const {data:contract,error}=await admin.from("contracts").select("*").eq("id",contractId).is("deleted_at",null).single();
        if (error||!contract) throw new AppError(ERROR_CODES.NOT_FOUND,"Contract not found",404);
        await requireOrgRole(supabase,contract.org_id,userId,"member");
        await admin.from("contracts").update({deleted_at:new Date().toISOString()}).eq("id",contractId);
        await admin.storage.from("contracts").remove([contract.file_storage_key]);
        await logAudit(supabase,{orgId:contract.org_id,userId,action:"delete",resourceType:"contract",resourceId:contractId});
        return noContent();
      }
    }
    throw new AppError(ERROR_CODES.NOT_FOUND,"Endpoint not found",404);
  } catch(err){return handleError(err);}
});