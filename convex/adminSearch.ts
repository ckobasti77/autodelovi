/**
 * Admin command palette search (⌘K): order and inquiry numbers, OEM / SKU / cross numbers,
 * product names, customer e-mail, phone, PIB. Every source is an index or search-index
 * lookup with a small `take`; results are grouped for the palette.
 */
import { v } from "convex/values";

import { normalizeCode } from "../lib/domain/codes";
import { foldForSearch } from "../lib/domain/search";
import { normalizePhone } from "../lib/format/phone";
import { staffQuery } from "./lib/functions";
import { inquiryStatusV, orderStatusV } from "./lib/validators";

const hitV = v.object({
  kind: v.union(
    v.literal("order"),
    v.literal("inquiry"),
    v.literal("product"),
    v.literal("customer"),
    v.literal("mechanic"),
  ),
  id: v.string(),
  title: v.string(),
  meta: v.string(),
  href: v.string(),
  orderStatus: v.optional(orderStatusV),
  inquiryStatus: v.optional(inquiryStatusV),
});

export const run = staffQuery({
  args: { q: v.string() },
  returns: v.array(hitV),
  handler: async (ctx, { q }) => {
    const query = q.trim().slice(0, 100);
    if (query.length < 2) return [];
    const hits: (typeof hitV.type)[] = [];
    const seen = new Set<string>();
    const push = (hit: typeof hitV.type) => {
      const key = `${hit.kind}:${hit.id}`;
      if (seen.has(key)) return;
      seen.add(key);
      hits.push(hit);
    };

    const upper = query.toUpperCase().replace(/\s+/g, "");
    // Exact document numbers first (SK-2026-000187, UP-2026-000045).
    if (/^[A-Z]{1,4}-\d{4}-\d{1,6}$/.test(upper)) {
      const [prefix, year, seq] = upper.split("-") as [string, string, string];
      const number = `${prefix}-${year}-${seq.padStart(6, "0")}`;
      const order = await ctx.db
        .query("orders")
        .withIndex("by_number", (x) => x.eq("number", number))
        .unique();
      if (order) {
        push({
          kind: "order",
          id: order._id,
          title: order.number,
          meta: `${order.contact.firstName} ${order.contact.lastName}`,
          href: `/admin/porudzbine/${order.number}`,
          orderStatus: order.status,
        });
      }
      const inquiry = await ctx.db
        .query("inquiries")
        .withIndex("by_number", (x) => x.eq("number", number))
        .unique();
      if (inquiry) {
        push({
          kind: "inquiry",
          id: inquiry._id,
          title: inquiry.number,
          meta: inquiry.contact.name,
          href: `/admin/upiti/${inquiry.number}`,
          inquiryStatus: inquiry.status,
        });
      }
    }

    // E-mail → account and mechanic profile.
    if (query.includes("@")) {
      const email = query.toLowerCase();
      for (const candidate of new Set([query, email])) {
        const users = await ctx.db
          .query("users")
          .withIndex("email", (x) => x.eq("email", candidate))
          .take(3);
        for (const u of users) {
          push({
            kind: "customer",
            id: u._id,
            title: u.name ?? u.email ?? "Kupac",
            meta: u.email ?? "",
            href: `/admin/kupci/${u._id}`,
          });
        }
      }
    }

    // PIB (9 digits) → mechanic profile.
    if (/^\d{9}$/.test(query)) {
      const profiles = await ctx.db
        .query("mechanicProfiles")
        .withIndex("by_pib", (x) => x.eq("pib", query))
        .take(3);
      for (const p of profiles) {
        push({
          kind: "mechanic",
          id: p._id,
          title: p.companyName,
          meta: `PIB ${p.pib} · ${p.city}`,
          href: `/admin/majstori/${p._id}`,
        });
      }
    }

    // Part numbers (OEM, cross, SKU, MPN, EAN).
    const code = normalizeCode(query);
    if (code.length >= 3 && /\d/.test(code)) {
      const rows = await ctx.db
        .query("productCodes")
        .withIndex("by_code", (x) => x.eq("code", code))
        .take(8);
      for (const row of rows) {
        const p = await ctx.db.get("products", row.productId);
        if (!p) continue;
        push({
          kind: "product",
          id: p._id,
          title: p.name,
          meta: `${p.sku} · ${row.kind.toUpperCase()} ${row.raw}`,
          href: `/admin/proizvodi/${p._id}`,
        });
      }
    }

    // Phone → orders / inquiries (searchText stores the folded E.164 digits).
    const phone = normalizePhone(query);
    const folded = phone ? phone.replace(/\D/g, "") : foldForSearch(query);
    if (folded) {
      const orders = await ctx.db
        .query("orders")
        .withSearchIndex("search_orders", (x) => x.search("searchText", folded))
        .take(5);
      for (const o of orders) {
        push({
          kind: "order",
          id: o._id,
          title: o.number,
          meta: `${o.company?.name ?? `${o.contact.firstName} ${o.contact.lastName}`} · ${o.contact.phone}`,
          href: `/admin/porudzbine/${o.number}`,
          orderStatus: o.status,
        });
      }
      const inquiries = await ctx.db
        .query("inquiries")
        .withSearchIndex("search_inquiries", (x) => x.search("searchText", folded))
        .take(4);
      for (const i of inquiries) {
        push({
          kind: "inquiry",
          id: i._id,
          title: i.number,
          meta: `${i.contact.name}${i.vin ? ` · ${i.vin}` : ""}`,
          href: `/admin/upiti/${i.number}`,
          inquiryStatus: i.status,
        });
      }
      if (!phone) {
        const products = await ctx.db
          .query("products")
          .withSearchIndex("search_products", (x) => x.search("searchText", folded))
          .take(6);
        for (const p of products) {
          push({
            kind: "product",
            id: p._id,
            title: p.name,
            meta: `${p.sku} · ${p.manufacturerName}`,
            href: `/admin/proizvodi/${p._id}`,
          });
        }
      }
    }
    return hits.slice(0, 24);
  },
});
