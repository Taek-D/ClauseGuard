import { createAdminClient } from "../_shared/db.ts";
import { AppError, ERROR_CODES, handleError } from "../_shared/errors.ts";
import { ok, created, noContent, preflight } from "../_shared/response.ts";
import { validateBody, validateEnum, validateString } from "../_shared/validators.ts";
import { verifyAuth, getUserOrgId, requireOrgRole } from "../_shared/auth.ts";
import { PlanType, BillingCycle } from "../_shared/types.ts";

const PLANS: readonly PlanType[] = ["starter", "professional", "team"];
const CYCLES: readonly BillingCycle[] = ["monthly", "annual"];
const PLAN_PRICES: Record<string, Record<string, number>> = {
  starter: { monthly: 9900, annual: 95040 },
  professional: { monthly: 24900, annual: 239040 },
  team: { monthly: 49900, annual: 479040 },
};
const SEAT_LIMITS: Record<string, number> = { free: 1, starter: 1, professional: 1, team: 10 };
const API_LIMITS: Record<string, number | null> = { free: null, starter: null, professional: 1000, team: 5000 };

async function stripePost(path: string, params: Record<string, string>): Promise<Record<string, unknown>> {
  const key = Deno.env.get("STRIPE_SECRET_KEY") ?? "";
  const body = Object.entries(params).map(([k, v]) => k + "=" + encodeURIComponent(v)).join("&");
  const res = await fetch("https://api.stripe.com/v1" + path, {
    method: "POST",
    headers: { "Authorization": "Bearer " + key, "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });
  const data = await res.json() as Record<string, unknown>;
  if (!res.ok) throw new AppError(ERROR_CODES.INTERNAL_ERROR, "Stripe error: " + (data.error as { message?: string } | undefined)?.message);
  return data;
}

async function stripeGet(path: string): Promise<Record<string, unknown>> {
  const key = Deno.env.get("STRIPE_SECRET_KEY") ?? "";
  const res = await fetch("https://api.stripe.com/v1" + path, {
    headers: { "Authorization": "Bearer " + key },
  });
  const data = await res.json() as Record<string, unknown>;
  if (!res.ok) throw new AppError(ERROR_CODES.INTERNAL_ERROR, "Stripe error: " + (data.error as { message?: string } | undefined)?.message);
  return data;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return preflight();
  const url = new URL(req.url);
  const rawPath = url.pathname.replace(/^\/functions\/v1\/subscriptions/, "") || "/";

  try {
    const admin = createAdminClient();

    if (req.method === "POST" && rawPath === "/webhook") {
      const sig = req.headers.get("stripe-signature") ?? "";
      const webhookSecret = Deno.env.get("STRIPE_WEBHOOK_SECRET") ?? "";
      const body = await req.text();
      if (!sig || !webhookSecret) throw new AppError(ERROR_CODES.UNAUTHORIZED, "Missing webhook signature");
      let event: Record<string, unknown>;
      try {
        event = JSON.parse(body) as Record<string, unknown>;
      } catch {
        throw new AppError(ERROR_CODES.VALIDATION_ERROR, "Invalid JSON");
      }
      const evType = event.type as string;
      const evData = (event.data as { object: Record<string, unknown> }).object;
      if (evType === "customer.subscription.updated") {
        const stripeSubId = evData.id as string;
        const status = evData.status as string;
        const planId = ((evData.items as { data: Array<{ price: { nickname: string } }> }).data[0]?.price?.nickname ?? "").toLowerCase();
        const mappedPlan = PLANS.includes(planId as PlanType) ? planId : null;
        const upd: Record<string, unknown> = { status: status === "active" ? "active" : status === "past_due" ? "past_due" : "cancelled" };
        if (mappedPlan) upd.plan = mappedPlan;
        await admin.from("subscriptions").update(upd).eq("stripe_subscription_id", stripeSubId);
        if (mappedPlan) await admin.from("subscriptions").select("org_id").eq("stripe_subscription_id", stripeSubId).single().then(({ data }) => { if (data?.org_id) return admin.from("organizations").update({ plan: mappedPlan }).eq("id", data.org_id); });
      }
      if (evType === "customer.subscription.deleted") {
        const stripeSubId = evData.id as string;
        const { data: sub } = await admin.from("subscriptions").select("org_id").eq("stripe_subscription_id", stripeSubId).single();
        await admin.from("subscriptions").update({ status: "cancelled" }).eq("stripe_subscription_id", stripeSubId);
        if (sub?.org_id) await admin.from("organizations").update({ plan: "free" }).eq("id", sub.org_id);
      }
      if (evType === "invoice.payment_failed") {
        const custId = evData.customer as string;
        await admin.from("subscriptions").update({ status: "past_due" }).eq("stripe_customer_id", custId);
      }
      return ok({ received: true });
    }

    const { userId, adminClient } = await verifyAuth(req);
    const orgId = await getUserOrgId(adminClient, userId);

    if (req.method === "GET" && rawPath === "/") {
      const { data, error } = await admin.from("subscriptions").select("*").eq("org_id", orgId).single();
      if (error || !data) throw new AppError(ERROR_CODES.NOT_FOUND, "Subscription not found");
      return ok(data);
    }

    if (req.method === "POST" && rawPath === "/") {
      await requireOrgRole(admin, orgId, userId, "owner");
      const body = await validateBody<{ plan: string; billing_cycle: string; payment_method_id: string; email?: string }>(req);
      const plan = validateEnum(body.plan, "plan", PLANS);
      const billing_cycle = validateEnum(body.billing_cycle, "billing_cycle", CYCLES);
      const payment_method_id = validateString(body.payment_method_id, "payment_method_id", { min: 1 });

      const { data: orgData } = await admin.from("organizations").select("name").eq("id", orgId).single();
      const { data: existing } = await admin.from("subscriptions").select("stripe_customer_id").eq("org_id", orgId).maybeSingle();

      let customerId = existing?.stripe_customer_id;
      if (!customerId) {
        const customer = await stripePost("/customers", { description: orgData?.name ?? orgId, metadata: JSON.stringify({ org_id: orgId }) });
        customerId = customer.id as string;
      }

      await stripePost("/payment_methods/" + payment_method_id + "/attach", { customer: customerId });
      await stripePost("/customers/" + customerId, { "invoice_settings[default_payment_method]": payment_method_id });

      const priceAmount = PLAN_PRICES[plan][billing_cycle];
      const interval = billing_cycle === "annual" ? "year" : "month";
      const priceData = await stripePost("/prices", { unit_amount: String(priceAmount), currency: "usd", "recurring[interval]": interval, "product_data[name]": "ClauseGuard " + plan, nickname: plan });

      const sub = await stripePost("/subscriptions", { customer: customerId, "items[0][price]": priceData.id as string });

      const now = new Date().toISOString();
      const periodEnd = new Date(((sub.current_period_end as number) ?? 0) * 1000).toISOString();
      const { data, error } = await admin.from("subscriptions").upsert({
        org_id: orgId, plan, status: "active", billing_cycle,
        current_period_start: now, current_period_end: periodEnd,
        stripe_customer_id: customerId, stripe_subscription_id: sub.id as string,
        seat_limit: SEAT_LIMITS[plan], api_call_limit: API_LIMITS[plan],
      }).select().single();
      if (error) throw new AppError(ERROR_CODES.INTERNAL_ERROR, error.message);
      await admin.from("organizations").update({ plan }).eq("id", orgId);
      return created(data);
    }

    if (req.method === "PATCH" && rawPath === "/") {
      await requireOrgRole(admin, orgId, userId, "owner");
      const body = await validateBody<{ plan: string }>(req);
      const plan = validateEnum(body.plan, "plan", PLANS);
      const { data: subData } = await admin.from("subscriptions").select("stripe_subscription_id").eq("org_id", orgId).single();
      if (!subData?.stripe_subscription_id) throw new AppError(ERROR_CODES.NOT_FOUND, "No active subscription");
      const stripeSub = await stripeGet("/subscriptions/" + subData.stripe_subscription_id);
      const itemId = ((stripeSub.items as { data: Array<{ id: string }> }).data[0]?.id);
      const priceData = await stripePost("/prices", { unit_amount: String(PLAN_PRICES[plan]["monthly"]), currency: "usd", "recurring[interval]": "month", "product_data[name]": "ClauseGuard " + plan, nickname: plan });
      await stripePost("/subscriptions/" + subData.stripe_subscription_id, { "items[0][id]": itemId, "items[0][price]": priceData.id as string, proration_behavior: "create_prorations" });
      const { data, error } = await admin.from("subscriptions").update({ plan, seat_limit: SEAT_LIMITS[plan], api_call_limit: API_LIMITS[plan] }).eq("org_id", orgId).select().single();
      if (error) throw new AppError(ERROR_CODES.INTERNAL_ERROR, error.message);
      await admin.from("organizations").update({ plan }).eq("id", orgId);
      return ok(data);
    }

    if (req.method === "DELETE" && rawPath === "/") {
      await requireOrgRole(admin, orgId, userId, "owner");
      const { data: subData } = await admin.from("subscriptions").select("stripe_subscription_id").eq("org_id", orgId).single();
      if (!subData?.stripe_subscription_id) throw new AppError(ERROR_CODES.NOT_FOUND, "No active subscription");
      await stripePost("/subscriptions/" + subData.stripe_subscription_id, { cancel_at_period_end: "true" });
      const { data, error } = await admin.from("subscriptions").update({ status: "cancelled" }).eq("org_id", orgId).select().single();
      if (error) throw new AppError(ERROR_CODES.INTERNAL_ERROR, error.message);
      return ok(data);
    }

    throw new AppError(ERROR_CODES.NOT_FOUND, "Route not found: " + req.method + " " + rawPath);
  } catch (err) {
    return handleError(err);
  }
});
