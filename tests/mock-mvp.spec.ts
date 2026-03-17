import { expect, test } from "@playwright/test";

test.describe("mock MVP flow", () => {
  test("supports upload, review decisions, copy summary, and archive filters", async ({ page }) => {
    await page.context().grantPermissions(["clipboard-read", "clipboard-write"]);

    await page.addInitScript(() => {
      window.localStorage.clear();
      window.sessionStorage.clear();
    });

    await page.goto("/");
    await expect(
      page.getByRole("heading", { name: "ClauseGuard is now organized as a runnable contract review MVP." }),
    ).toBeVisible();
    await expect(page.getByText("Mock Workspace", { exact: true })).toBeVisible();

    await page.goto("/auth");
    await page.locator("form").getByRole("button").first().click();
    await page.waitForURL("**/dashboard");

    await page.locator('a[href="/dashboard/upload"]').first().click();
    await page.waitForURL("**/dashboard/upload");

    await page.setInputFiles('input[type="file"]', {
      name: "demo-contract.hwp",
      mimeType: "application/octet-stream",
      buffer: Buffer.from("ClauseGuard demo contract for end-to-end smoke testing."),
    });

    await page.getByRole("button", { name: "분석 시작" }).click();
    await page.waitForURL(/\/dashboard\/contracts\/[^/]+\/analysis$/);
    await expect(page.getByText("Analysis Progress")).toBeVisible();

    await expect(page.getByRole("button", { name: "리스크 리포트 보기" })).toBeVisible({
      timeout: 20_000,
    });
    await page.getByRole("button", { name: "리스크 리포트 보기" }).click();

    await page.waitForURL(/\/dashboard\/contracts\/[^/]+$/);
    await expect(page.getByText("Risk Report")).toBeVisible();
    await expect(page.getByText("Overall Risk Score")).toBeVisible();

    await page.getByTestId("copy-summary").click();
    await expect(page.getByRole("button", { name: "Summary copied" })).toBeVisible();

    await page.getByTestId("risk-card-toggle").first().click();
    await page.getByTestId("accept-suggestion").first().click();
    await expect(page.getByTestId("suggestion-decision-badge").first()).toHaveText("Accepted");

    await page.getByRole("link", { name: "Back to archive" }).click();
    await page.waitForURL("**/dashboard/contracts");

    await page.getByLabel("Search").fill("demo-contract");
    await page.getByRole("button", { name: "Apply filters" }).click();
    await expect(page.getByRole("heading", { name: "demo-contract" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "master-service-agreement" })).toHaveCount(0);

    await page.getByRole("button", { name: "Reset filters" }).click();
    await expect(page.getByRole("heading", { name: "master-service-agreement" })).toBeVisible();
  });
});
