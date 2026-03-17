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