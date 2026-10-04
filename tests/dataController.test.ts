import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { applyConfigPat, resolvePrRef, resolvePrRefFromParts } from "../src/app/dataController";
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

describe("applyConfigPat", () => {
  let savedPat: string | undefined;
  beforeEach(() => {
    savedPat = process.env.AZURE_DEVOPS_EXT_PAT;
    delete process.env.AZURE_DEVOPS_EXT_PAT;
  });
  afterEach(() => {
    applyConfigPat(undefined); // drop module state so tests do not leak into each other
    if (savedPat === undefined) delete process.env.AZURE_DEVOPS_EXT_PAT;
    else process.env.AZURE_DEVOPS_EXT_PAT = savedPat;
  });

  test("the config's PAT is exported for the requests to use", () => {
    applyConfigPat("cfg-pat");
    expect(process.env.AZURE_DEVOPS_EXT_PAT).toBe("cfg-pat");
  });

  test("a PAT deleted from the config leaves the environment on the next load (so az login is used)", () => {
    applyConfigPat("cfg-pat");
    applyConfigPat(undefined);
    expect(process.env.AZURE_DEVOPS_EXT_PAT).toBeUndefined();
  });

  test("a changed PAT replaces the old one", () => {
    applyConfigPat("old");
    applyConfigPat("new");
    expect(process.env.AZURE_DEVOPS_EXT_PAT).toBe("new");
    applyConfigPat(undefined);
    expect(process.env.AZURE_DEVOPS_EXT_PAT).toBeUndefined();
  });

  test("a PAT the user exported is restored, not deleted, when the config drops its own", () => {
    process.env.AZURE_DEVOPS_EXT_PAT = "mine";
    applyConfigPat("cfg-pat");
    expect(process.env.AZURE_DEVOPS_EXT_PAT).toBe("cfg-pat");
    applyConfigPat(undefined);
    expect(process.env.AZURE_DEVOPS_EXT_PAT).toBe("mine");
  });

  test("without a config PAT ever applied, the user's own PAT is never touched", () => {
    process.env.AZURE_DEVOPS_EXT_PAT = "mine";
    applyConfigPat(undefined);
    expect(process.env.AZURE_DEVOPS_EXT_PAT).toBe("mine");
  });

  test("a PAT changed by someone else in the meantime is not ours to undo", () => {
    applyConfigPat("cfg-pat");
    process.env.AZURE_DEVOPS_EXT_PAT = "rotated-elsewhere";
    applyConfigPat(undefined);
    expect(process.env.AZURE_DEVOPS_EXT_PAT).toBe("rotated-elsewhere");
  });
});

