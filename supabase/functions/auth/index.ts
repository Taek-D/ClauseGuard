import { createAdminClient } from "../_shared/db.ts";
import { AppError, ERROR_CODES, handleError } from "../_shared/errors.ts";
import { ok, created, noContent, preflight } from "../_shared/response.ts";
import { validateBody, validateEmail, validateString, validateRequired } from "../_shared/validators.ts";
import { logAudit } from "../_shared/audit.ts";
import { verifyAuth } from "../_shared/auth.ts";

const B32 = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";

function genSecret(bytes = 20): string {
  const raw = crypto.getRandomValues(new Uint8Array(bytes));
  let r = "";
  for (let i = 0; i < raw.length; i += 5) {
    const c = [raw[i], raw[i+1]??0, raw[i+2]??0, raw[i+3]??0, raw[i+4]??0];
    r += B32[c[0]>>3] + B32[((c[0]&7)<<2)|(c[1]>>6)] + B32[(c[1]>>1)&31];
    r += B32[((c[1]&1)<<4)|(c[2]>>4)] + B32[((c[2]&15)<<1)|(c[3]>>7)];
    r += B32[(c[3]>>2)&31] + B32[((c[3]&3)<<3)|(c[4]>>5)] + B32[c[4]&31];
  }
  return r.slice(0, 32);
}

function b32Decode(input: string): Uint8Array {
  const s = input.toUpperCase().replace(/=+$/, "");
  const bytes: number[] = [];
  let buf = 0, bits = 0;
  for (const ch of s) {
    const v = B32.indexOf(ch);
    if (v === -1) continue;
    buf = (buf << 5) | v;
    bits += 5;
    if (bits >= 8) { bits -= 8; bytes.push((buf >> bits) & 0xff); }
  }
  return new Uint8Array(bytes);
}

async function genTOTP(secret: string, counter?: number): Promise<string> {
  const t = counter ?? Math.floor(Date.now() / 1000 / 30);
  const cb = new Uint8Array(8);
  let tmp = t;
  for (let i = 7; i >= 0; i--) { cb[i] = tmp & 0xff; tmp >>= 8; }
  const key = await crypto.subtle.importKey("raw", b32Decode(secret), { name: "HMAC", hash: "SHA-1" }, false, ["sign"]);
  const hmac = new Uint8Array(await crypto.subtle.sign("HMAC", key, cb));
  const off = hmac[19] & 0xf;
  const code = (((hmac[off]&0x7f)<<24)|((hmac[off+1]&0xff)<<16)|((hmac[off+2]&0xff)<<8)|(hmac[off+3]&0xff)) % 1_000_000;
  return code.toString().padStart(6, "0");
}

async function checkTOTP(secret: string, code: string): Promise<boolean> {
  const t = Math.floor(Date.now() / 1000 / 30);
  for (const d of [-1, 0, 1]) { if (await genTOTP(secret, t + d) === code) return true; }
  return false;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return preflight();
  const url = new URL(req.url);
  const segs = url.pathname.replace(/^\/functions\/v1\/auth/, "").split("/").filter(Boolean);
  const path = "/" + segs.join("/");

  try {
    const admin = createAdminClient();

    if (req.method === "POST" && path === "/register") {
      const body = await validateBody<{ email: string; password: string; name: string }>(req);
      const email = validateEmail(body.email, "email");
      const password = validateString(body.password, "password", { min: 8, max: 128 });
      const name = validateString(body.name, "name", { min: 1, max: 100 });
      const { data, error } = await admin.auth.admin.createUser({ email, password, email_confirm: true, user_metadata: { name } });
      if (error) {
        if (error.message?.includes("already registered")) throw new AppError(ERROR_CODES.CONFLICT, "Email already in use");
        throw new AppError(ERROR_CODES.INTERNAL_ERROR, error.message);
      }
      const userId = data.user.id;
      await admin.from("users").upsert({ id: userId, email, name, auth_provider: "email", language: "ko" });
      const { data: org } = await admin.from("organizations").insert({ name: name + " Organization", industry: "other", plan: "free" }).select().single();
      if (org) {
        const now = new Date().toISOString();
        await admin.from("org_members").insert({ org_id: org.id, user_id: userId, role: "owner", status: "active", invited_at: now, joined_at: now });
        await admin.from("subscriptions").insert({ org_id: org.id, plan: "free", status: "active", billing_cycle: "monthly", current_period_start: now, current_period_end: new Date(Date.now() + 30*86400000).toISOString(), stripe_customer_id: "", stripe_subscription_id: "", seat_limit: 1, api_call_limit: null });
      }
      const { data: sess, error: sErr } = await admin.auth.signInWithPassword({ email, password });
      if (sErr) throw new AppError(ERROR_CODES.INTERNAL_ERROR, sErr.message);
      return created({ user: data.user, session: sess.session });
    }

    if (req.method === "POST" && path === "/login") {
      const body = await validateBody<{ email: string; password: string }>(req);
      const email = validateEmail(body.email, "email");
      const password = validateString(body.password, "password", { min: 1, max: 128 });
      const { createClient } = await import("https://esm.sh/@supabase/supabase-js@2");
      const anon = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!);
      const { data, error } = await anon.auth.signInWithPassword({ email, password });
      if (error) throw new AppError(ERROR_CODES.UNAUTHORIZED, "Invalid email or password");
      const { data: ud } = await admin.from("users").select("mfa_enabled").eq("id", data.user.id).single();
      if (ud?.mfa_enabled) return ok({ mfa_required: true, user_id: data.user.id });
      await admin.from("users").update({ last_login_at: new Date().toISOString() }).eq("id", data.user.id);
      const { data: mem } = await admin.from("org_members").select("org_id").eq("user_id", data.user.id).eq("status", "active").limit(1).single();
      if (mem?.org_id) await logAudit(admin, { orgId: mem.org_id, userId: data.user.id, action: "login", resourceType: "user", resourceId: data.user.id });
      return ok({ user: data.user, session: data.session });
    }

    if (req.method === "POST" && path === "/logout") {
      const { supabase } = await verifyAuth(req);
      await supabase.auth.signOut();
      return noContent();
    }

    if (req.method === "POST" && path === "/refresh") {
      const body = await validateBody<{ refresh_token: string }>(req);
      validateRequired(body.refresh_token, "refresh_token");
      const { createClient } = await import("https://esm.sh/@supabase/supabase-js@2");
      const anon = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!);
      const { data, error } = await anon.auth.refreshSession({ refresh_token: body.refresh_token });
      if (error) throw new AppError(ERROR_CODES.UNAUTHORIZED, "Invalid or expired refresh token");
      return ok({ session: data.session });
    }

    if (req.method === "POST" && path === "/mfa/setup") {
      const { userId } = await verifyAuth(req);
      const secret = genSecret();
      const { data: ud } = await admin.from("users").select("email").eq("id", userId).single();
      await admin.from("users").update({ mfa_secret: secret }).eq("id", userId);
      const label = encodeURIComponent(ud?.email ?? "");
      return ok({ secret, qr_uri: "otpauth://totp/ClauseGuard:" + label + "?secret=" + secret + "&issuer=ClauseGuard" });
    }

    if (req.method === "POST" && path === "/mfa/verify") {
      const { userId } = await verifyAuth(req);
      const body = await validateBody<{ code: string }>(req);
      const code = validateString(body.code, "code", { min: 6, max: 6 });
      const { data: ud } = await admin.from("users").select("mfa_secret").eq("id", userId).single();
      if (!ud?.mfa_secret) throw new AppError(ERROR_CODES.VALIDATION_ERROR, "MFA not set up");
      if (!(await checkTOTP(ud.mfa_secret, code))) throw new AppError(ERROR_CODES.INVALID_MFA_CODE, "Invalid MFA code");
      await admin.from("users").update({ mfa_enabled: true }).eq("id", userId);
      return ok({ success: true });
    }

    if (req.method === "POST" && path === "/mfa/disable") {
      const { userId } = await verifyAuth(req);
      const body = await validateBody<{ code: string }>(req);
      const code = validateString(body.code, "code", { min: 6, max: 6 });
      const { data: ud } = await admin.from("users").select("mfa_secret").eq("id", userId).single();
      if (!ud?.mfa_secret) throw new AppError(ERROR_CODES.VALIDATION_ERROR, "MFA not configured");
      if (!(await checkTOTP(ud.mfa_secret, code))) throw new AppError(ERROR_CODES.INVALID_MFA_CODE, "Invalid MFA code");
      await admin.from("users").update({ mfa_enabled: false, mfa_secret: null }).eq("id", userId);
      return ok({ success: true });
    }

    throw new AppError(ERROR_CODES.NOT_FOUND, "Route not found: " + req.method + " " + path);
  } catch (err) {
    return handleError(err);
  }
});
