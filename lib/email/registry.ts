/**
 * Template registry: key → Serbian label, audience group, renderer and a realistic sample
 * (admin gallery previews, „Pošalji probnu poruku“, snapshot tests). Keys are stored in
 * `emailLog.templateKey` and `notificationDeliveries.templateKey` — never rename one.
 */
import {
  isTemplateKey,
  TEMPLATE_GROUP_LABEL,
  TEMPLATE_INFO,
  TEMPLATE_KEYS,
  type TemplateGroup,
  type TemplateKey,
} from "./catalog";
import type { EmailContext } from "./context";
import type { RenderedEmail } from "./html";
import { SAMPLES } from "./samples";
import {
  backInStock,
  inquiryReceived,
  mechanicApproved,
  mechanicRegistrationReceived,
  mechanicRejected,
  mechanicSuspended,
  passwordResetCode,
  quoteExpiring,
  quoteReady,
  staffInvite,
} from "./templates/customer";
import {
  orderBackordered,
  orderCancelled,
  orderConfirmed,
  orderDelivered,
  orderReadyPickup,
  orderReceived,
  orderShipped,
} from "./templates/order";
import {
  staffDailyDigest,
  staffInquiryNew,
  staffLowStock,
  staffMechanicNew,
  staffOrderNew,
  staffQuoteAccepted,
  staffQuoteRenewal,
  staffReminder,
} from "./templates/staff";
import type {
  BackInStockEmailData,
  InquiryEmailData,
  MechanicEmailData,
  OrderEmailData,
  PasswordResetEmailData,
  StaffDigestEmailData,
  StaffInquiryEmailData,
  StaffInviteEmailData,
  StaffLowStockEmailData,
  StaffMechanicEmailData,
  StaffOrderEmailData,
  StaffQuoteEmailData,
  StaffReminderEmailData,
} from "./types";

export type TemplateDataMap = {
  order_received: OrderEmailData;
  order_confirmed: OrderEmailData;
  order_backordered: OrderEmailData;
  order_ready_pickup: OrderEmailData;
  order_shipped: OrderEmailData;
  order_delivered: OrderEmailData;
  order_cancelled: OrderEmailData;
  inquiry_received: InquiryEmailData;
  quote_ready: InquiryEmailData;
  quote_expiring: InquiryEmailData;
  back_in_stock: BackInStockEmailData;
  mechanic_registration_received: MechanicEmailData;
  mechanic_approved: MechanicEmailData;
  mechanic_rejected: MechanicEmailData;
  mechanic_suspended: MechanicEmailData;
  password_reset_code: PasswordResetEmailData;
  staff_invite: StaffInviteEmailData;
  staff_order_new: StaffOrderEmailData;
  staff_inquiry_new: StaffInquiryEmailData;
  staff_mechanic_new: StaffMechanicEmailData;
  staff_quote_accepted: StaffQuoteEmailData;
  staff_quote_renewal: StaffQuoteEmailData;
  staff_low_stock: StaffLowStockEmailData;
  staff_daily_digest: StaffDigestEmailData;
  staff_reminder: StaffReminderEmailData;
};

export type { TemplateGroup, TemplateKey };

export type TemplateDef<K extends TemplateKey> = {
  key: K;
  label: string;
  group: TemplateGroup;
  /** When it is sent (Serbian, one line for the gallery). */
  trigger: string;
  render: (data: TemplateDataMap[K], ctx: EmailContext) => RenderedEmail;
  sample: (siteUrl: string) => TemplateDataMap[K];
};

type Registry = { [K in TemplateKey]: TemplateDef<K> };

// Every catalogue key needs a data type (compile-time check).
type _Complete = [TemplateKey] extends [keyof TemplateDataMap]
  ? [keyof TemplateDataMap] extends [TemplateKey]
    ? true
    : never
  : never;
const _complete: _Complete = true;
void _complete;

/** Mutable on purpose: tests replace a renderer to simulate failures (see notify.test.ts). */
export const TEMPLATES: Registry = {
  order_received: {
    key: "order_received",
    ...TEMPLATE_INFO.order_received,
    render: orderReceived,
    sample: SAMPLES.orderCourierCod,
  },
  order_confirmed: {
    key: "order_confirmed",
    ...TEMPLATE_INFO.order_confirmed,
    render: orderConfirmed,
    sample: SAMPLES.orderBankTransfer,
  },
  order_backordered: {
    key: "order_backordered",
    ...TEMPLATE_INFO.order_backordered,
    render: orderBackordered,
    sample: SAMPLES.orderBackorder,
  },
  order_ready_pickup: {
    key: "order_ready_pickup",
    ...TEMPLATE_INFO.order_ready_pickup,
    render: orderReadyPickup,
    sample: SAMPLES.orderPickup,
  },
  order_shipped: {
    key: "order_shipped",
    ...TEMPLATE_INFO.order_shipped,
    render: orderShipped,
    sample: SAMPLES.orderShipped,
  },
  order_delivered: {
    key: "order_delivered",
    ...TEMPLATE_INFO.order_delivered,
    render: orderDelivered,
    sample: SAMPLES.orderDelivered,
  },
  order_cancelled: {
    key: "order_cancelled",
    ...TEMPLATE_INFO.order_cancelled,
    render: orderCancelled,
    sample: SAMPLES.orderCancelled,
  },
  inquiry_received: {
    key: "inquiry_received",
    ...TEMPLATE_INFO.inquiry_received,
    render: inquiryReceived,
    sample: SAMPLES.inquiry,
  },
  quote_ready: {
    key: "quote_ready",
    ...TEMPLATE_INFO.quote_ready,
    render: quoteReady,
    sample: SAMPLES.inquiryWithQuote,
  },
  quote_expiring: {
    key: "quote_expiring",
    ...TEMPLATE_INFO.quote_expiring,
    render: quoteExpiring,
    sample: SAMPLES.inquiryWithQuote,
  },
  back_in_stock: {
    key: "back_in_stock",
    ...TEMPLATE_INFO.back_in_stock,
    render: backInStock,
    sample: SAMPLES.backInStock,
  },
  mechanic_registration_received: {
    key: "mechanic_registration_received",
    ...TEMPLATE_INFO.mechanic_registration_received,
    render: mechanicRegistrationReceived,
    sample: SAMPLES.mechanic,
  },
  mechanic_approved: {
    key: "mechanic_approved",
    ...TEMPLATE_INFO.mechanic_approved,
    render: mechanicApproved,
    sample: SAMPLES.mechanicApproved,
  },
  mechanic_rejected: {
    key: "mechanic_rejected",
    ...TEMPLATE_INFO.mechanic_rejected,
    render: mechanicRejected,
    sample: SAMPLES.mechanicRejected,
  },
  mechanic_suspended: {
    key: "mechanic_suspended",
    ...TEMPLATE_INFO.mechanic_suspended,
    render: mechanicSuspended,
    sample: SAMPLES.mechanic,
  },
  password_reset_code: {
    key: "password_reset_code",
    ...TEMPLATE_INFO.password_reset_code,
    render: passwordResetCode,
    sample: SAMPLES.passwordReset,
  },
  staff_invite: {
    key: "staff_invite",
    ...TEMPLATE_INFO.staff_invite,
    render: staffInvite,
    sample: SAMPLES.staffInvite,
  },
  staff_order_new: {
    key: "staff_order_new",
    ...TEMPLATE_INFO.staff_order_new,
    render: staffOrderNew,
    sample: SAMPLES.staffOrder,
  },
  staff_inquiry_new: {
    key: "staff_inquiry_new",
    ...TEMPLATE_INFO.staff_inquiry_new,
    render: staffInquiryNew,
    sample: SAMPLES.staffInquiry,
  },
  staff_mechanic_new: {
    key: "staff_mechanic_new",
    ...TEMPLATE_INFO.staff_mechanic_new,
    render: staffMechanicNew,
    sample: SAMPLES.staffMechanic,
  },
  staff_quote_accepted: {
    key: "staff_quote_accepted",
    ...TEMPLATE_INFO.staff_quote_accepted,
    render: staffQuoteAccepted,
    sample: SAMPLES.staffQuoteAccepted,
  },
  staff_quote_renewal: {
    key: "staff_quote_renewal",
    ...TEMPLATE_INFO.staff_quote_renewal,
    render: staffQuoteRenewal,
    sample: SAMPLES.staffQuoteRenewal,
  },
  staff_low_stock: {
    key: "staff_low_stock",
    ...TEMPLATE_INFO.staff_low_stock,
    render: staffLowStock,
    sample: SAMPLES.staffLowStock,
  },
  staff_daily_digest: {
    key: "staff_daily_digest",
    ...TEMPLATE_INFO.staff_daily_digest,
    render: staffDailyDigest,
    sample: SAMPLES.staffDigest,
  },
  staff_reminder: {
    key: "staff_reminder",
    ...TEMPLATE_INFO.staff_reminder,
    render: staffReminder,
    sample: SAMPLES.staffReminder,
  },
};

export { isTemplateKey, TEMPLATE_GROUP_LABEL, TEMPLATE_KEYS };

/** Renders a template with typed data (the only entry point used by Convex). */
export function renderTemplate<K extends TemplateKey>(
  key: K,
  data: TemplateDataMap[K],
  ctx: EmailContext,
): RenderedEmail {
  const def = TEMPLATES[key] as TemplateDef<K>;
  return def.render(data, ctx);
}

/**
 * Renders a template with its sample data (gallery, test send). Predračun data comes from the
 * real settings when they exist, so the owner previews the account numbers customers will see.
 */
export function renderSample(key: TemplateKey, ctx: EmailContext): RenderedEmail {
  const def = TEMPLATES[key] as TemplateDef<typeof key>;
  let data = def.sample(ctx.siteUrl) as TemplateDataMap[TemplateKey];
  if ("bank" in data && data.bank) {
    const recipient = ctx.company.legalName.trim() || ctx.company.displayName?.trim();
    data = {
      ...data,
      bank: {
        ...data.bank,
        ...(recipient ? { recipient } : {}),
        ...(ctx.company.bankAccounts.length ? { accounts: ctx.company.bankAccounts } : {}),
      },
    };
  }
  return (def.render as (d: unknown, c: EmailContext) => RenderedEmail)(data, ctx);
}
