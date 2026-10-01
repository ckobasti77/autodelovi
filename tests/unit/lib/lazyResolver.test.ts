import type { ResolverOptions } from "react-hook-form";
import { describe, expect, it, vi } from "vitest";

import { inquiryResolver } from "@/lib/validation/inquiryResolver";
import type { InquiryValues } from "@/lib/validation/inquiry";
import { lazyResolver } from "@/lib/validation/lazyResolver";

const options = {
  fields: {},
  shouldUseNativeValidation: false,
} as unknown as ResolverOptions<InquiryValues>;

const empty: InquiryValues = {
  vin: "",
  brandSlug: "",
  modelSlug: "",
  generationSlug: "",
  year: "",
  message: "",
  name: "",
  phone: "",
  email: "",
  channel: "phone",
  consent: false,
};

describe("lazyResolver (on-demand form validation, PERF-01)", () => {
  it("imports once and validates with the loaded resolver", async () => {
    const load = vi.fn(() => Promise.resolve(inquiryResolver));
    const { resolver, preload } = lazyResolver(load);
    expect(load).not.toHaveBeenCalled();
    await preload();
    const result = await resolver(empty, undefined, options);
    expect(load).toHaveBeenCalledTimes(1);
    expect(Object.keys(result.errors).sort()).toEqual(["consent", "message", "name", "phone"]);
    await resolver({ ...empty, message: "Turbina za Golf" }, undefined, options);
    expect(load).toHaveBeenCalledTimes(1);
  });

  it("a validation before the import finished waits for it", async () => {
    let finish: (r: typeof inquiryResolver) => void = () => {};
    const { resolver } = lazyResolver(
      () => new Promise<typeof inquiryResolver>((r) => (finish = r)),
    );
    const pending = resolver(empty, undefined, options);
    finish(inquiryResolver);
    expect(Object.keys((await pending).errors)).toContain("message");
  });

  it("a failed import rejects (a submit never passes unvalidated) and is retried next time", async () => {
    const load = vi
      .fn<() => Promise<typeof inquiryResolver>>()
      .mockRejectedValueOnce(new Error("ChunkLoadError"))
      .mockResolvedValue(inquiryResolver);
    const { resolver } = lazyResolver(load);
    await expect(resolver(empty, undefined, options)).rejects.toThrow("ChunkLoadError");
    const result = await resolver(empty, undefined, options);
    expect(load).toHaveBeenCalledTimes(2);
    expect(Object.keys(result.errors)).toContain("name");
  });
});
