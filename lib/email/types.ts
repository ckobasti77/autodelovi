/**
 * Template data shapes. Convex loaders (`convex/lib/emailData.ts`) build them from documents;
 * the registry (`samples.ts`) holds a realistic sample of each for previews and tests.
 * Money is in para; dates are epoch ms (formatted in Belgrade time by the templates).
 */
import type { OrderStatus } from "../domain/orderStateMachine";

export type EmailLine = {
  name: string;
  sku?: string;
  manufacturer?: string;
  quantity: number;
  unitPricePara: number;
  lineTotalPara: number;
  /** Shown as a note: „Po porudžbini, 3–5 dana“ etc. */
  availabilityNote?: string;
};

export type EmailBankDetails = {
  recipient: string;
  accounts: readonly { bank: string; account: string }[];
  reference: string;
  amountPara: number;
};

export type OrderEmailData = {
  number: string;
  statusUrl: string;
  status: OrderStatus;
  createdAt: number;
  firstName: string;
  customerType: "guest" | "customer" | "mechanic";
  lines: readonly EmailLine[];
  /** Lines not listed (message shows the first 25). */
  moreLines: number;
  totals: {
    itemsRetailPara: number;
    discountPara: number;
    itemsPara: number;
    deliveryPara: number;
    totalPara: number;
    vatPara: number;
  };
  delivery: {
    method: "pickup" | "courier";
    label: string;
    address?: string;
    courierName?: string;
    trackingNumber?: string;
    trackingUrl?: string;
  };
  payment: {
    method: "cod" | "pickup_cash" | "pickup_card" | "bank_transfer" | "deferred";
    label: string;
    instructions: string;
    reference: string;
    dueAt?: number;
  };
  company?: { name: string; pib: string };
  hasBackorder: boolean;
  cancelReason?: string;
  /** Present for bank transfer (predračun data). */
  bank?: EmailBankDetails;
  /** Printable predračun on the site (bank transfer). */
  proformaUrl?: string;
  /** Legal pages for the delivered e-mail. */
  complaintsUrl: string;
  termsUrl: string;
};

export type QuoteEmailData = {
  version: number;
  validUntil: number;
  lines: readonly EmailLine[];
  totalPara: number;
  deliveryNote?: string;
};

export type InquiryEmailData = {
  number: string;
  statusUrl: string;
  name: string;
  createdAt: number;
  vehicleLabel?: string;
  vin?: string;
  messageExcerpt: string;
  requestedCodes: readonly string[];
  photoCount: number;
  preferredChannel: "phone" | "viber" | "whatsapp" | "email";
  quote?: QuoteEmailData;
};

export type BackInStockEmailData = {
  productName: string;
  sku: string;
  manufacturer: string;
  pricePara: number;
  stockLabel: string;
  productUrl: string;
  unsubscribeUrl: string;
};

export type MechanicEmailData = {
  companyName: string;
  contactPerson: string;
  email: string;
  tierName?: string;
  discountLabel?: string;
  creditEnabled?: boolean;
  paymentTermsDays?: number;
  reason?: string;
  portalUrl: string;
  loginUrl: string;
  registrationUrl: string;
};

export type PasswordResetEmailData = {
  code: string;
  expiresAt: number;
  resetUrl: string;
};

export type StaffInviteEmailData = {
  inviteUrl: string;
  role: "staff" | "owner";
  expiresAt: number;
  invitedBy?: string;
};

export type StaffOrderEmailData = {
  number: string;
  adminUrl: string;
  customerName: string;
  customerType: "guest" | "customer" | "mechanic";
  companyName?: string;
  tierName?: string;
  phone: string;
  email: string;
  totalPara: number;
  itemCount: number;
  lines: readonly EmailLine[];
  moreLines: number;
  deliveryLabel: string;
  paymentLabel: string;
  note?: string;
  hasBackorder: boolean;
  source: string;
};

export type StaffInquiryEmailData = {
  number: string;
  adminUrl: string;
  name: string;
  phone?: string;
  email?: string;
  preferredChannel: "phone" | "viber" | "whatsapp" | "email";
  vehicleLabel?: string;
  vin?: string;
  categoryLabels: readonly string[];
  messageExcerpt: string;
  requestedCodes: readonly string[];
  photoCount: number;
  isMechanic: boolean;
};

export type StaffMechanicEmailData = {
  companyName: string;
  pib: string;
  city: string;
  contactPerson: string;
  phone: string;
  email: string;
  serviceTypes: readonly string[];
  adminUrl: string;
};

export type StaffQuoteEmailData = {
  number: string;
  adminUrl: string;
  customerName: string;
  orderNumber?: string;
  totalPara?: number;
};

export type StaffLowStockEmailData = {
  items: readonly { sku: string; name: string; qty: number; url: string }[];
  total: number;
  adminUrl: string;
};

export type StaffDigestEmailData = {
  day: number;
  orders: { count: number; valuePara: number; cancelled: number };
  inquiriesReceived: number;
  registrations: number;
  openOrders: readonly { number: string; ageLabel: string; url: string }[];
  openOrderCount: number;
  openInquiries: readonly { number: string; ageLabel: string; url: string }[];
  openInquiryCount: number;
  pendingMechanics: readonly { companyName: string; url: string }[];
  lowStockCount: number;
  outOfStockCount: number;
  zeroSearches: readonly { query: string; count: number }[];
  dashboardUrl: string;
  stockUrl: string;
  searchesUrl: string;
};

export type StaffReminderEmailData = {
  target: "order" | "inquiry";
  number: string;
  level: number;
  ageLabel: string;
  customerName: string;
  url: string;
};

export type TestEmailData = {
  sentBy: string;
  mode: "log" | "test" | "live";
};
