import { describe, expect, it } from "vitest";

import { buildCsp, createNonce, staticSecurityHeaders } from "@/lib/security/headers";

const directive = (csp: string, name: string) =>
  csp
    .split("; ")
    .find((d) => d.startsWith(`${name} `))
    ?.split(" ")
    .slice(1) ?? [];

describe("buildCsp", () => {
  const csp = buildCsp({
    nonce: "abc123==",
    dev: false,
    https: true,
    convexUrl: "https://tame-impala-374.convex.cloud",
    convexSiteUrl: "https://tame-impala-374.convex.site",
    siteUrl: "https://sklop.rs",
  });

  it("allows only nonced scripts (plus what they load) and WebAssembly for the 3D decoder", () => {
    expect(directive(csp, "script-src")).toEqual([
      "'self'",
      "'nonce-abc123=='",
      "'strict-dynamic'",
      "'wasm-unsafe-eval'",
    ]);
    expect(csp).not.toContain("'unsafe-eval'");
  });

  it("forbids framing, plugins and foreign form targets", () => {
    expect(directive(csp, "frame-ancestors")).toEqual(["'none'"]);
    expect(directive(csp, "object-src")).toEqual(["'none'"]);
    expect(directive(csp, "form-action")).toEqual(["'self'"]);
    expect(directive(csp, "base-uri")).toEqual(["'self'"]);
    expect(csp.endsWith("upgrade-insecure-requests")).toBe(true);
  });

  it("lets the app reach exactly its Convex deployment (https + websocket)", () => {
    const connect = directive(csp, "connect-src");
    expect(connect).toContain("https://tame-impala-374.convex.cloud");
    expect(connect).toContain("wss://tame-impala-374.convex.cloud");
    expect(connect).toContain("https://tame-impala-374.convex.site");
    expect(connect).not.toContain("wss://*.convex.cloud");
    expect(directive(csp, "img-src")).toContain("https://tame-impala-374.convex.cloud");
  });

  it("allows the Google tag and the Meta Pixel endpoints", () => {
    const connect = directive(csp, "connect-src");
    expect(connect).toContain("https://*.google-analytics.com");
    expect(connect).toContain("https://connect.facebook.net");
    expect(directive(csp, "img-src")).toContain("https://www.facebook.com");
    expect(directive(csp, "frame-src")).toContain("https://td.doubleclick.net");
    expect(directive(csp, "worker-src")).toEqual(["'self'", "blob:"]);
  });

  it("adds eval only in development and upgrade-insecure-requests only over https", () => {
    const dev = buildCsp({ nonce: "n", dev: true, https: false });
    expect(directive(dev, "script-src")).toContain("'unsafe-eval'");
    expect(dev).not.toContain("upgrade-insecure-requests");
    expect(directive(dev, "connect-src")).toContain("wss://*.convex.cloud");
  });
});

describe("createNonce", () => {
  it("is 128-bit base64 and unique per call", () => {
    const a = createNonce();
    expect(a).toMatch(/^[A-Za-z0-9+/]{22}==$/);
    expect(createNonce()).not.toBe(a);
  });
});

describe("staticSecurityHeaders", () => {
  it("sets HSTS only for production builds", () => {
    const keys = (production: boolean) => staticSecurityHeaders(production).map((h) => h.key);
    expect(keys(true)).toContain("Strict-Transport-Security");
    expect(keys(false)).not.toContain("Strict-Transport-Security");
    expect(keys(false)).toEqual(
      expect.arrayContaining([
        "X-Content-Type-Options",
        "X-Frame-Options",
        "Referrer-Policy",
        "Permissions-Policy",
        "Cross-Origin-Opener-Policy",
      ]),
    );
  });
});
