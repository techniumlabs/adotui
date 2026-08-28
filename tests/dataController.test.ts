import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { resolvePrRef, resolvePrRefFromParts } from "../src/app/dataController";
import type { PullRequest } from "../src/domain/types";

const parts = {
  organizationUrl: "https://dev.azure.com/acme",
  project: "core",
  repository: "web",
  prId: 42,
};

// Other test files set ADOTUI_MOCK globally; save and restore around each test.
let savedMock: string | undefined;
beforeEach(() => {
  savedMock = process.env.ADOTUI_MOCK;
  delete process.env.ADOTUI_MOCK;
});
afterEach(() => {
  if (savedMock === undefined) delete process.env.ADOTUI_MOCK;
  else process.env.ADOTUI_MOCK = savedMock;
});

describe("resolvePrRefFromParts", () => {
  test("builds a PrRef from complete routing parts", () => {
    expect(resolvePrRefFromParts(parts)).toEqual({
      organization: parts.organizationUrl,
      project: "core",
      repository: "web",
      prId: 42,
    });
  });

  test("returns null when routing info is missing", () => {
    expect(resolvePrRefFromParts({ ...parts, repository: "" })).toBeNull();
    expect(resolvePrRefFromParts({ ...parts, organizationUrl: "" })).toBeNull();
    expect(resolvePrRefFromParts({ ...parts, prId: 0 })).toBeNull();
  });

  test("returns null in mock mode (no live target)", () => {
    process.env.ADOTUI_MOCK = "1";
    expect(resolvePrRefFromParts(parts)).toBeNull();
  });
});

describe("resolvePrRef", () => {
  test("reads routing info from the PR itself", () => {
    const pr = {
      organizationUrl: parts.organizationUrl,
      project: "core",
      repository: "web",
      id: 42,
    } as PullRequest;
    expect(resolvePrRef(pr)).toEqual({
      organization: parts.organizationUrl,
      project: "core",
      repository: "web",
      prId: 42,
    });
  });
});
