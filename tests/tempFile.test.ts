import { describe, expect, test } from "bun:test";
import { withTempFile } from "../src/data/tempFile";

describe("withTempFile", () => {
  test("provides a readable temp file and removes it afterwards", async () => {
    let seenPath = "";
    const result = await withTempFile(
      "hello",
      async (path) => {
        seenPath = path;
        expect(await Bun.file(path).text()).toBe("hello");
        return 42;
      },
      { prefix: "adotui-test", suffix: ".json" },
    );
    expect(result).toBe(42);
    expect(seenPath.endsWith(".json")).toBe(true);
    expect(await Bun.file(seenPath).exists()).toBe(false);
  });

  test("cleans up even when fn throws", async () => {
    let seenPath = "";
    await expect(
      withTempFile("x", async (path) => {
        seenPath = path;
        throw new Error("boom");
      }),
    ).rejects.toThrow("boom");
    expect(await Bun.file(seenPath).exists()).toBe(false);
  });
});
