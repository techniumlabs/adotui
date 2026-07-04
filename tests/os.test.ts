import { expect, test, describe, mock, afterEach } from "bun:test";
import { openInBrowser } from "../src/app/utils";

describe("OS Specific Logic - openInBrowser", () => {
  // Store original platform property descriptor to restore it later
  const originalPlatform = Object.getOwnPropertyDescriptor(process, "platform");
  
  // Mock Bun.spawn so it doesn't actually try to run commands during tests
  const originalSpawn = Bun.spawn;

  afterEach(() => {
    // Restore platform and spawn after each test
    if (originalPlatform) {
      Object.defineProperty(process, "platform", originalPlatform);
    }
    Bun.spawn = originalSpawn;
  });

  const mockPlatform = (platform: string) => {
    Object.defineProperty(process, "platform", {
      value: platform,
      configurable: true,
    });
  };

  test("uses 'open' on macOS (darwin)", () => {
    mockPlatform("darwin");
    
    let executedCmd: string[] = [];
    Bun.spawn = mock(({ cmd }: any) => {
      executedCmd = cmd;
      return { stdout: "ignore", stderr: "ignore" } as any;
    });

    openInBrowser("https://example.com");
    
    expect(executedCmd).toEqual(["open", "https://example.com"]);
  });

  test("uses 'cmd /c start' on Windows (win32)", () => {
    mockPlatform("win32");
    
    let executedCmd: string[] = [];
    Bun.spawn = mock(({ cmd }: any) => {
      executedCmd = cmd;
      return { stdout: "ignore", stderr: "ignore" } as any;
    });

    openInBrowser("https://example.com");
    
    expect(executedCmd).toEqual(["cmd", "/c", "start", "", "https://example.com"]);
  });

  test("uses 'xdg-open' on Linux (linux)", () => {
    mockPlatform("linux");
    
    let executedCmd: string[] = [];
    Bun.spawn = mock(({ cmd }: any) => {
      executedCmd = cmd;
      return { stdout: "ignore", stderr: "ignore" } as any;
    });

    openInBrowser("https://example.com");
    
    expect(executedCmd).toEqual(["xdg-open", "https://example.com"]);
  });
});
