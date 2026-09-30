/**
 * Cron jobs (docs/NOTIFICATIONS.md §I3). Convex cron times are UTC; local-time rules
 * (working hours, the 08:00 digest) live in the jobs and are DST-safe (`lib/domain/time`).
 */
import { cronJobs } from "convex/server";

import { internal } from "./_generated/api";

const crons = cronJobs();

crons.interval("retry due outbox events", { minutes: 1 }, internal.events.sweep, {});
crons.cron("reminders (working hours)", "*/15 * * * *", internal.automations.runReminders, {});
crons.cron("daily digest (Belgrade digestHour)", "0 * * * *", internal.automations.runDigest, {});
crons.cron("expire quotes", "*/15 * * * *", internal.maintenance.expireQuotes, {});
crons.cron("quotes expiring in 24 h", "7,22,37,52 * * * *", internal.automations.quoteExpiringSweep, {});
crons.cron("low stock e-mail batch", "5 * * * *", internal.automations.lowStockSweep, {});
crons.cron("back in stock safety sweep", "10 * * * *", internal.automations.backInStockSweep, {});
crons.cron("auto-complete orders", "30 1 * * *", internal.maintenance.autoCompleteOrders, {});
crons.cron("nightly maintenance and retention", "40 1 * * *", internal.automations.nightly, {});

export default crons;
