import { expect, test } from "@playwright/test";

test.describe("mock MVP flow", () => {
  test("completes auth, upload, analysis, and report review", async ({ page }) => {
    await page.addInitScript(() => {
      window.localStorage.clear();
      window.sessionStorage.clear();
    });

    await page.goto("/");
    await expect(page.getByRole("heading", { name: "ClauseGuard is now organized as a runnable contract review MVP." })).toBeVisible();
    await expect(page.getByText("Mock Workspace", { exact: true })).toBeVisible();

    await page.goto("/auth");
    await expect(page.getByRole("heading", { name: "ClauseGuard 인증" })).toBeVisible();

    await page.getByRole("button", { name: "데모 워크스페이스 열기" }).click();
    await page.waitForURL("**/dashboard");
    await expect(page.getByRole("heading", { name: "ClauseGuard 루트 워크스페이스" })).toBeVisible();

    await page.getByRole("link", { name: "계약서 업로드", exact: true }).click();
    await page.waitForURL("**/dashboard/upload");

    await page.setInputFiles('input[type="file"]', {
      name: "demo-contract.hwp",
      mimeType: "application/octet-stream",
      buffer: Buffer.from("ClauseGuard demo contract for end-to-end smoke testing."),
    });

    await page.getByRole("button", { name: "분석 시작" }).click();
    await page.waitForURL(/\/dashboard\/contracts\/[^/]+\/analysis$/);
    await expect(page.getByRole("heading", { name: "demo-contract" })).toBeVisible();
    await expect(page.getByText("Analysis Progress")).toBeVisible();

    await expect(page.getByRole("button", { name: "리스크 리포트 보기" })).toBeVisible({
      timeout: 20_000,
    });
    await page.getByRole("button", { name: "리스크 리포트 보기" }).click();

    await page.waitForURL(/\/dashboard\/contracts\/[^/]+$/);
    await expect(page.getByText("Risk Report")).toBeVisible();
    await expect(page.getByText("Overall Risk Score")).toBeVisible();
    await expect(page.getByRole("button", { name: "High", exact: true })).toBeVisible();
  });
});
