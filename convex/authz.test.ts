/// <reference types="vite/client" />
import { describe, expect, test } from "vitest";

import { api } from "./_generated/api";
import { CONSENT, errorCode, makeT, setupWorld, VALID_MB } from "./test.setup";

describe("authorization negatives", () => {
  test("viewer reflects the session; blocked users are flagged and fail user functions", async () => {
    const t = makeT();
    const w = await setupWorld(t);
    expect(await w.anon.query(api.users.viewer, {})).toBeNull();
    expect(await w.asOwner.query(api.users.viewer, {})).toMatchObject({
      role: "owner",
      isStaff: true,
      isOwner: true,
    });
    expect(await w.asMechA.query(api.users.viewer, {})).toMatchObject({
      role: "customer",
      mechanicStatus: "approved",
      tierName: "Majstor",
      creditEnabled: true,
    });
    expect(await w.asBlocked.query(api.users.viewer, {})).toMatchObject({ blocked: true });
    expect(
      await errorCode(() => w.asBlocked.mutation(api.users.updateMyProfile, { firstName: "X" })),
    ).toBe("BLOCKED");
    expect(
      await errorCode(() => w.anon.mutation(api.users.updateMyProfile, { firstName: "X" })),
    ).toBe("UNAUTHENTICATED");
  });

  test("settings: only the owner updates; staff can read the admin view; everyone reads public", async () => {
    const t = makeT();
    const w = await setupWorld(t);
    const current = await w.asStaff.query(api.settings.getAdmin, {});
    const update = {
      update: { section: "brand" as const, value: { ...current.brand, tagline: "Novi slogan" } },
    };
    expect(await errorCode(() => w.asStaff.mutation(api.settings.updateSection, update))).toBe(
      "FORBIDDEN",
    );
    expect(await errorCode(() => w.asCustomerA.query(api.settings.getAdmin, {}))).toBe("FORBIDDEN");
    await w.asOwner.mutation(api.settings.updateSection, update);
    expect((await w.anon.query(api.settings.getPublic, {})).brand.tagline).toBe("Novi slogan");
    const audit = await w.asStaff.query(api.audit.list, {
      action: "settings.update",
      paginationOpts: { numItems: 5, cursor: null },
    });
    expect(audit.page[0].entityId).toBe("brand");
  });

  test("price tiers: staff read, owner edit", async () => {
    const t = makeT();
    const w = await setupWorld(t);
    const args = {
      name: "Test",
      defaultDiscountBp: 500,
      categoryRules: [],
      manufacturerRules: [],
      sortOrder: 9,
      isDefault: false,
    };
    expect(await errorCode(() => w.asStaff.mutation(api.pricing.createTier, args))).toBe(
      "FORBIDDEN",
    );
    expect(await errorCode(() => w.asMechA.query(api.pricing.listTiers, {}))).toBe("FORBIDDEN");
    await w.asOwner.mutation(api.pricing.createTier, args);
    expect((await w.asStaff.query(api.pricing.listTiers, {})).map((t) => t.name)).toContain("Test");
    expect(
      await errorCode(() =>
        w.asOwner.mutation(api.pricing.createTier, { ...args, defaultDiscountBp: 9_500 }),
      ),
    ).toBe("INVALID");
  });

  test("mechanics cannot approve themselves or read other profiles", async () => {
    const t = makeT();
    const w = await setupWorld(t);
    expect(
      await errorCode(() =>
        w.asPending.mutation(api.mechanicsAdmin.approve, {
          profileId: w.pending.profileId,
          tierId: w.tiers.partner,
          creditEnabled: true,
        }),
      ),
    ).toBe("FORBIDDEN");
    expect(
      await errorCode(() =>
        w.asMechA.query(api.mechanicsAdmin.get, { profileId: w.mechB.profileId }),
      ),
    ).toBe("FORBIDDEN");
    const own = await w.asMechA.query(api.mechanics.myProfile, {});
    expect(own?.profileId).toBe(w.mechA.profileId);
    expect(await w.asCustomerA.query(api.mechanics.myProfile, {})).toBeNull();
  });

  test("product, stock and audit admin functions are staff-only", async () => {
    const t = makeT();
    const w = await setupWorld(t);
    expect(
      await errorCode(() =>
        w.asMechA.mutation(api.catalog.productsAdmin.update, {
          productId: w.products.disc,
          patch: { retailPricePara: 1 },
        }),
      ),
    ).toBe("FORBIDDEN");
    expect(
      await errorCode(() =>
        w.asCustomerA.mutation(api.catalog.productsAdmin.adjustStock, {
          productId: w.products.disc,
          delta: 5,
          reason: "receipt",
        }),
      ),
    ).toBe("FORBIDDEN");
    expect(await errorCode(() => w.anon.query(api.stock.lowStock, {}))).toBe("UNAUTHENTICATED");
    expect(
      await errorCode(() =>
        w.asMechB.query(api.audit.list, { paginationOpts: { numItems: 5, cursor: null } }),
      ),
    ).toBe("FORBIDDEN");
    expect(
      await errorCode(() =>
        w.asCustomerA.mutation(api.catalog.categories.update, {
          categoryId: w.categories.disc,
          intro: "x",
        }),
      ),
    ).toBe("FORBIDDEN");
  });

  test("notifications belong to their user", async () => {
    const t = makeT();
    const w = await setupWorld(t);
    const id = await t.run(async (ctx) =>
      ctx.db.insert("notifications", {
        userId: w.customerA,
        kind: "x",
        title: "T",
        body: "B",
        href: "/",
        read: false,
      }),
    );
    expect(
      await errorCode(() =>
        w.asCustomerB.mutation(api.notifications.markRead, { notificationId: id }),
      ),
    ).toBe("NOT_FOUND");
    expect(await w.asCustomerB.query(api.notifications.unreadCount, {})).toBe(0);
    await w.asCustomerA.mutation(api.notifications.markRead, { notificationId: id });
    expect(await w.asCustomerA.query(api.notifications.unreadCount, {})).toBe(0);
  });

  test("demo removal needs the owner and the typed phrase", async () => {
    const t = makeT();
    const w = await setupWorld(t);
    expect(
      await errorCode(() => w.asStaff.mutation(api.demo.remove, { confirm: "OBRIŠI DEMO" })),
    ).toBe("FORBIDDEN");
    expect(await errorCode(() => w.asOwner.mutation(api.demo.remove, { confirm: "obrisi" }))).toBe(
      "INVALID",
    );
  });

  test("mechanic registration validates PIB/MB and rejects a duplicate PIB", async () => {
    const t = makeT();
    const w = await setupWorld(t);
    const base = {
      companyName: "Auto servis Novi",
      mb: VALID_MB,
      contactPerson: "Jovan",
      phone: "064 555 1234",
      city: "Niš",
      address: "Ulica 2",
      serviceTypes: ["mehanika" as const],
      brandsServiced: [],
      consent: CONSENT,
    };
    expect(
      await errorCode(() => w.anon.mutation(api.mechanics.register, { ...base, pib: "100000001" })),
    ).toBe("UNAUTHENTICATED");
    expect(
      await errorCode(() =>
        w.asCustomerA.mutation(api.mechanics.register, { ...base, pib: "123456789" }),
      ),
    ).toBe("INVALID");
    // The world's mechanics share VALID_PIB → duplicate.
    const dupPib = (await w.asStaff.query(api.mechanicsAdmin.get, {
      profileId: w.mechA.profileId,
    }))!.profile.pib;
    expect(
      await errorCode(() =>
        w.asCustomerA.mutation(api.mechanics.register, { ...base, pib: dupPib }),
      ),
    ).toBe("DUPLICATE");
    expect(
      await errorCode(() =>
        w.asMechA.mutation(api.mechanics.register, { ...base, pib: "100000001" }),
      ),
    ).toBe("DUPLICATE");
  });
});
