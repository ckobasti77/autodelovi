/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as account from "../account.js";
import type * as adminSearch from "../adminSearch.js";
import type * as audit from "../audit.js";
import type * as auth from "../auth.js";
import type * as authEmails from "../authEmails.js";
import type * as backInStock from "../backInStock.js";
import type * as carts from "../carts.js";
import type * as catalog_categories from "../catalog/categories.js";
import type * as catalog_categoriesAdmin from "../catalog/categoriesAdmin.js";
import type * as catalog_codes from "../catalog/codes.js";
import type * as catalog_manufacturers from "../catalog/manufacturers.js";
import type * as catalog_manufacturersAdmin from "../catalog/manufacturersAdmin.js";
import type * as catalog_products from "../catalog/products.js";
import type * as catalog_productsAdmin from "../catalog/productsAdmin.js";
import type * as catalog_vehicles from "../catalog/vehicles.js";
import type * as catalog_vehiclesAdmin from "../catalog/vehiclesAdmin.js";
import type * as content from "../content.js";
import type * as crons from "../crons.js";
import type * as customersAdmin from "../customersAdmin.js";
import type * as dashboard from "../dashboard.js";
import type * as demo from "../demo.js";
import type * as emailsAdmin from "../emailsAdmin.js";
import type * as events from "../events.js";
import type * as files from "../files.js";
import type * as http from "../http.js";
import type * as inquiries from "../inquiries.js";
import type * as inquiriesAdmin from "../inquiriesAdmin.js";
import type * as lib_audit from "../lib/audit.js";
import type * as lib_authz from "../lib/authz.js";
import type * as lib_carts from "../lib/carts.js";
import type * as lib_catalog from "../lib/catalog.js";
import type * as lib_counters from "../lib/counters.js";
import type * as lib_docs from "../lib/docs.js";
import type * as lib_env from "../lib/env.js";
import type * as lib_errors from "../lib/errors.js";
import type * as lib_events from "../lib/events.js";
import type * as lib_functions from "../lib/functions.js";
import type * as lib_inquiries from "../lib/inquiries.js";
import type * as lib_mechanics from "../lib/mechanics.js";
import type * as lib_orders from "../lib/orders.js";
import type * as lib_pricing from "../lib/pricing.js";
import type * as lib_productWriter from "../lib/productWriter.js";
import type * as lib_rateLimits from "../lib/rateLimits.js";
import type * as lib_searchLog from "../lib/searchLog.js";
import type * as lib_settings from "../lib/settings.js";
import type * as lib_settingsSchema from "../lib/settingsSchema.js";
import type * as lib_stats from "../lib/stats.js";
import type * as lib_tokens from "../lib/tokens.js";
import type * as lib_validators from "../lib/validators.js";
import type * as maintenance from "../maintenance.js";
import type * as mechanicPortal from "../mechanicPortal.js";
import type * as mechanics from "../mechanics.js";
import type * as mechanicsAdmin from "../mechanicsAdmin.js";
import type * as notifications from "../notifications.js";
import type * as orders from "../orders.js";
import type * as ordersAdmin from "../ordersAdmin.js";
import type * as pricing from "../pricing.js";
import type * as search from "../search.js";
import type * as seed from "../seed.js";
import type * as seedData_categories from "../seedData/categories.js";
import type * as seedData_content from "../seedData/content.js";
import type * as seedData_manufacturers from "../seedData/manufacturers.js";
import type * as seedData_products from "../seedData/products.js";
import type * as seedData_vehicles from "../seedData/vehicles.js";
import type * as settings from "../settings.js";
import type * as staff from "../staff.js";
import type * as stock from "../stock.js";
import type * as testing from "../testing.js";
import type * as users from "../users.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  account: typeof account;
  adminSearch: typeof adminSearch;
  audit: typeof audit;
  auth: typeof auth;
  authEmails: typeof authEmails;
  backInStock: typeof backInStock;
  carts: typeof carts;
  "catalog/categories": typeof catalog_categories;
  "catalog/categoriesAdmin": typeof catalog_categoriesAdmin;
  "catalog/codes": typeof catalog_codes;
  "catalog/manufacturers": typeof catalog_manufacturers;
  "catalog/manufacturersAdmin": typeof catalog_manufacturersAdmin;
  "catalog/products": typeof catalog_products;
  "catalog/productsAdmin": typeof catalog_productsAdmin;
  "catalog/vehicles": typeof catalog_vehicles;
  "catalog/vehiclesAdmin": typeof catalog_vehiclesAdmin;
  content: typeof content;
  crons: typeof crons;
  customersAdmin: typeof customersAdmin;
  dashboard: typeof dashboard;
  demo: typeof demo;
  emailsAdmin: typeof emailsAdmin;
  events: typeof events;
  files: typeof files;
  http: typeof http;
  inquiries: typeof inquiries;
  inquiriesAdmin: typeof inquiriesAdmin;
  "lib/audit": typeof lib_audit;
  "lib/authz": typeof lib_authz;
  "lib/carts": typeof lib_carts;
  "lib/catalog": typeof lib_catalog;
  "lib/counters": typeof lib_counters;
  "lib/docs": typeof lib_docs;
  "lib/env": typeof lib_env;
  "lib/errors": typeof lib_errors;
  "lib/events": typeof lib_events;
  "lib/functions": typeof lib_functions;
  "lib/inquiries": typeof lib_inquiries;
  "lib/mechanics": typeof lib_mechanics;
  "lib/orders": typeof lib_orders;
  "lib/pricing": typeof lib_pricing;
  "lib/productWriter": typeof lib_productWriter;
  "lib/rateLimits": typeof lib_rateLimits;
  "lib/searchLog": typeof lib_searchLog;
  "lib/settings": typeof lib_settings;
  "lib/settingsSchema": typeof lib_settingsSchema;
  "lib/stats": typeof lib_stats;
  "lib/tokens": typeof lib_tokens;
  "lib/validators": typeof lib_validators;
  maintenance: typeof maintenance;
  mechanicPortal: typeof mechanicPortal;
  mechanics: typeof mechanics;
  mechanicsAdmin: typeof mechanicsAdmin;
  notifications: typeof notifications;
  orders: typeof orders;
  ordersAdmin: typeof ordersAdmin;
  pricing: typeof pricing;
  search: typeof search;
  seed: typeof seed;
  "seedData/categories": typeof seedData_categories;
  "seedData/content": typeof seedData_content;
  "seedData/manufacturers": typeof seedData_manufacturers;
  "seedData/products": typeof seedData_products;
  "seedData/vehicles": typeof seedData_vehicles;
  settings: typeof settings;
  staff: typeof staff;
  stock: typeof stock;
  testing: typeof testing;
  users: typeof users;
}>;

/**
 * A utility for referencing Convex functions in your app's public API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = api.myModule.myFunction;
 * ```
 */
export declare const api: FilterApi<
  typeof fullApi,
  FunctionReference<any, "public">
>;

/**
 * A utility for referencing Convex functions in your app's internal API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = internal.myModule.myFunction;
 * ```
 */
export declare const internal: FilterApi<
  typeof fullApi,
  FunctionReference<any, "internal">
>;

export declare const components: {
  rateLimiter: import("@convex-dev/rate-limiter/_generated/component.js").ComponentApi<"rateLimiter">;
  resend: import("@convex-dev/resend/_generated/component.js").ComponentApi<"resend">;
};
