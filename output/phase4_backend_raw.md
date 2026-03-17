파일 쓰기 권한이 필요합니다. 모든 수정된 코드를 출력합니다 — 권한 승인 후 바로 적용 가능합니다.

=== FILE: supabase/functions/auth/index.ts ===
```
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders, ok, created } from "../_shared/response.ts";
import { AppError, ERROR_CODES, handleError } from "../_shared/errors.ts";
import { createAdminClient, createUserClient } from "../_shared/db.ts";
import { verifyAuth } from "../_shared/auth.ts";
import { validateBody, validateString, validateEmail } from "../_shared/validators.ts";

function generateBase32Secret(length = 20): string {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
  const bytes = crypto.getRandomValues(new Uint8Array(length));
  let result = "";
  for (let i = 0; i < bytes.length; i++) {
    result += chars[bytes[i] % 32];
  }
  return result;
}

function base32Decode(input: string): Uint8Array {
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
  let bits = 0;
  let value = 0;
  const result: number[] = [];
  const clean = input.toUpperCase().replace(/=+$/, "");
  for (let i = 0; i < clean.length; i++) {
    const idx = alphabet.indexOf(clean[i]);
    if (idx === -1) continue;
    value = (value << 5) | idx;
    bits += 5;
    if (bits >= 8) {
      result.push((value >>> (bits - 8)) & 255);
      bits -= 8;
    }
  }
  return new Uint8Array(result);
}

async function verifyTOTP(secret: string, token: string): Promise<boolean> {
  const keyData = base32Decode(secret);
  const key = await crypto.subtle.importKey(
    "raw", keyData,
    { name: "HMAC", hash: "SHA-1" },
    false, ["sign"]
  );
  const counter = Math.floor(Date.now() / 1000 / 30);
  for (let drift = -1; drift <= 1; drift++) {
    const c = counter + drift;
    const buf = new ArrayBuffer(8);
    const view = new DataView(buf);
    view.setUint32(4, c, false);
    const sig = await crypto.subtle.sign("HMAC", key, buf);
    const hash = new Uint8Array(sig);
    const offset = hash[19] & 0xf;
    const otp = (
      ((hash[offset] & 0x7f) << 24) |
      ((hash[offset + 1] & 0xff) << 16) |
      ((hash[offset + 2] & 0xff) << 8) |
      (hash[offset + 3] & 0xff)
    ) % 1000000;
    if (otp.toString().padStart(6, "0") === token.trim()) return true;
  }
  return false;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const url = new URL(req.url);
  const path = url.pathname.replace(/^\/auth/, "");

  try {
    const adminClient = createAdminClient();

    if (path === "/register" && req.method === "POST") {
      const body = await validateBody<{ email: string; password: string; full_name: string }>(req);
      const email = validateEmail(body.email, "email");
      const password = validateString(body.password, "password", { min: 8, max: 128 });
      const fullName = validateString(body.full_name, "full_name", { min: 1, max: 200 });

      const { data, error } = await adminClient.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: { full_name: fullName },
      });
      if (error || !data.user) {
        throw new AppError(ERROR_CODES.VALIDATION_ERROR, error?.message ?? "Registration failed", 400);
      }

      await adminClient.from("user_profiles").insert({
        id: data.user.id,
        email,
        full_name: fullName,
      });

      return created({ user: { id: data.user.id, email, full_name: fullName } });
    }

    if (path === "/login" && req.method === "POST") {
      const body = await validateBody<{ email: string; password: string }>(req);
      const email = validateEmail(body.email, "email");
      const password = validateString(body.password, "password", { min: 1 });

      const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
      const anonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
      const anonClient = createClient(supabaseUrl, anonKey);

      const { data, error } = await anonClient.auth.signInWithPassword({ email, password });
      if (error || !data.user) {
        throw new AppError(ERROR_CODES.UNAUTHORIZED, "Invalid credentials", 401);
      }

      const { data: profile } = await adminClient
        .from("user_profiles")
        .select("mfa_enabled, mfa_secret")
        .eq("id", data.user.id)
        .single();

      if (profile?.mfa_enabled) {
        return ok({
          mfa_required: true,
          session_token: data.session.access_token,
        });
      }

      return ok({
        access_token: data.session.access_token,
        refresh_token: data.session.refresh_token,
        expires_at: data.session.expires_at,
        user: { id: data.user.id, email: data.user.email },
      });
    }

    if (path === "/logout" && req.method === "POST") {
      const authHeader = req.headers.get("Authorization") ?? "";
      const supabase = createUserClient(authHeader);
      await supabase.auth.signOut();
      return ok({ message: "Logged out" });
    }

    if (path === "/refresh" && req.method === "POST") {
      const body = await validateBody<{ refresh_token: string }>(req);
      const refreshToken = validateString(body.refresh_token, "refresh_token", { min: 1 });

      const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
      const anonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
      const anonClient = createClient(supabaseUrl, anonKey);

      const { data, error } = await anonClient.auth.refreshSession({ refresh_token: refreshToken });
      if (error || !data.session) {
        throw new AppError(ERROR_CODES.UNAUTHORIZED, "Invalid refresh token", 401);
      }

      return ok({
        access_token: data.session.access_token,
        refresh_token: data.session.refresh_token,
        expires_at: data.session.expires_at,
      });
    }

    if (path === "/mfa/setup" && req.method === "POST") {
      const { userId } = await verifyAuth(req);
      const { data: authUser } = await adminClient.auth.admin.getUserById(userId);
      const email = authUser.user?.email ?? "";

      const secret = generateBase32Secret();
      const issuer = "ClauseGuard";
      const otpauthUrl =
        "otpauth://totp/" + issuer + ":" + encodeURIComponent(email) +
        "?secret=" + secret + "&issuer=" + issuer + "&algorithm=SHA1&digits=6&period=30";

      await adminClient
        .from("user_profiles")
        .update({ mfa_secret: secret, mfa_enabled: false })
        .eq("id", userId);

      return ok({ secret, otpauth_url: otpauthUrl });
    }

    if (path === "/mfa/verify" && req.method === "POST") {
      const { userId } = await verifyAuth(req);
      const body = await validateBody<{ token: string }>(req);
      const token = validateString(body.token, "token", { min: 6, max: 6 });

      const { data: profile } = await adminClient
        .from("user_profiles")
        .select("mfa_secret, mfa_enabled")
        .eq("id", userId)
        .single();

      if (!profile?.mfa_secret) {
        throw new AppError(ERROR_CODES.VALIDATION_ERROR, "MFA not set up", 400);
      }

      const valid = await verifyTOTP(profile.mfa_secret, token);
      if (!valid) throw new AppError(ERROR_CODES.INVALID_MFA_CODE, "Invalid TOTP token", 401);

      await adminClient.from("user_profiles").update({ mfa_enabled: true }).eq("id", userId);

      return ok({ mfa_enabled: true });
    }

    if (path === "/mfa/disable" && req.method === "POST") {
      const { userId } = await verifyAuth(req);
      const body = await validateBody<{ token: string }>(req);
      const token = validateString(body.token, "token", { min: 6, max: 6 });

      const { data: profile } = await adminClient
        .from("user_profiles")
        .select("mfa_secret, mfa_enabled")
        .eq("id", userId)
        .single();

      if (!profile?.mfa_enabled) {
        throw new AppError(ERROR_CODES.VALIDATION_ERROR, "MFA not enabled", 400);
      }

      const valid = await verifyTOTP(profile.mfa_secret, token);
      if (!valid) throw new AppError(ERROR_CODES.INVALID_MFA_CODE, "Invalid TOTP token", 401);

      await adminClient
        .from("user_profiles")
        .update({ mfa_enabled: false, mfa_secret: null })
        .eq("id", userId);

      return ok({ mfa_enabled: false });
    }

    throw new AppError(ERROR_CODES.NOT_FOUND, "Endpoint not found", 404);
  } catch (err) {
    return handleError(err);
  }
});
```

=== FILE: supabase/functions/users/index.ts ===
```
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
```

=== FILE: supabase/functions/organizations/index.ts ===
```
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
```

=== FILE: supabase/functions/contracts/index.ts ===
```
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
```

=== FILE: supabase/functions/analysis/index.ts ===
```
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
```

=== FILE: supabase/functions/risks/index.ts ===
```
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
```

=== FILE: supabase/functions/suggestions/index.ts ===
```
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
```

=== FILE: supabase/functions/reports/index.ts ===
```
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
```

=== FILE: supabase/functions/templates/index.ts ===
```
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
```

=== FILE: supabase/functions/audit-logs/index.ts ===
```
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
```

=== FILE: supabase/functions/subscriptions/index.ts ===
```
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
```

---

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