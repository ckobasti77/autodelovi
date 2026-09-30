import { describe, expect, it } from "vitest";

import { fetchableUrl, isForbiddenHost } from "@/lib/import/remoteUrl";

/** The host exactly as the WHATWG parser hands it to the fetcher. */
const host = (url: string) => new URL(url).hostname;

describe("isForbiddenHost", () => {
  it.each([
    "http://localhost/a.jpg",
    "http://localhost./a.jpg",
    "http://metadata.google.internal./x",
    "http://printer.local/x",
    "http://127.0.0.1/x",
    "http://2130706433/x", // decimal 127.0.0.1
    "http://0x7f.1/x",
    "http://10.1.2.3/x",
    "http://172.20.0.1/x",
    "http://192.168.1.10/x",
    "http://169.254.169.254/latest/meta-data",
    "http://100.100.0.1/x",
    "http://0.0.0.0/x",
    "http://224.0.0.1/x",
    "http://[::1]/x",
    "http://[::]/x",
    "http://[::ffff:127.0.0.1]/x",
    "http://[::ffff:169.254.169.254]/x",
    "http://[::127.0.0.1]/x",
    "http://[fc00::1]/x",
    "http://[fd12:3456::1]/x",
    "http://[fe80::1]/x",
    "http://[fec0::1]/x",
    "http://[64:ff9b::7f00:1]/x",
    "http://[2002:7f00:1::]/x",
  ])("refuses %s", (url) => {
    expect(isForbiddenHost(host(url))).toBe(true);
  });

  it.each([
    "https://cdn.example.com/a.jpg",
    "https://fdn.example.com/a.jpg",
    "https://fcdn.shop.rs/a.jpg",
    "https://93.184.216.34/a.jpg",
    "https://[2606:4700::6810:84e5]/a.jpg",
  ])("allows %s", (url) => {
    expect(isForbiddenHost(host(url))).toBe(false);
  });
});

describe("fetchableUrl", () => {
  it("accepts public http(s) URLs and resolves redirects relative to the current URL", () => {
    expect(fetchableUrl("https://cdn.example.com/a.jpg")?.href).toBe("https://cdn.example.com/a.jpg");
    const base = new URL("https://cdn.example.com/dir/a.jpg");
    expect(fetchableUrl("../b.jpg", base)?.href).toBe("https://cdn.example.com/b.jpg");
  });

  it("refuses other schemes, credentials and private redirect targets", () => {
    expect(fetchableUrl("file:///etc/passwd")).toBeNull();
    expect(fetchableUrl("ftp://cdn.example.com/a.jpg")).toBeNull();
    expect(fetchableUrl("https://user:pw@cdn.example.com/a.jpg")).toBeNull();
    expect(fetchableUrl("not a url")).toBeNull();
    const base = new URL("https://cdn.example.com/a.jpg");
    expect(fetchableUrl("http://169.254.169.254/", base)).toBeNull();
    expect(fetchableUrl("//localhost/x", base)).toBeNull();
  });
});
