import { test as base, expect, type APIRequestContext, type Page } from "@playwright/test";
import { ipHeaders, randomIp, shareSession, signedInApi } from "./api.js";
import { createOwner, type OwnerCredentials } from "./owners.js";

type Fixtures = {
  /**
   * This test's made-up client IP. Every browser request of the test (and
   * page.request / request) sends it as X-Forwarded-For, so the backend's
   * per-IP login limits count each test separately.
   */
  clientIp: string;
  /** A fresh owner account, made for this test only. */
  owner: OwnerCredentials;
  /** API client signed in as `owner`, for setting up data quickly. */
  ownerApi: APIRequestContext;
  /**
   * The test's page, already signed in as `owner` (same session as ownerApi,
   * so logging out in the browser logs ownerApi out too).
   */
  ownerPage: Page;
};

export const test = base.extend<Fixtures>({
  clientIp: async ({}, use) => {
    await use(randomIp());
  },

  extraHTTPHeaders: async ({ clientIp }, use) => {
    await use(ipHeaders(clientIp));
  },

  owner: async ({}, use) => {
    await use(await createOwner());
  },

  ownerApi: async ({ playwright, owner, clientIp }, use) => {
    const api = await signedInApi(playwright, owner, clientIp);
    await use(api);
    await api.dispose();
  },

  ownerPage: async ({ page, context, ownerApi }, use) => {
    await shareSession(ownerApi, context);
    await use(page);
  },
});

export { expect };
