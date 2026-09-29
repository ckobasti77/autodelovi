/**
 * Cron jobs (UTC; local-time logic lives in the jobs — docs/NOTIFICATIONS.md §I3).
 * Step 18 adds reminders, the 08:00 digest, low-stock e-mails and nightly maintenance.
 */
import { cronJobs } from "convex/server";

import { internal } from "./_generated/api";

const crons = cronJobs();

crons.interval("retry due outbox events", { minutes: 1 }, internal.events.sweep, {});
crons.cron("expire quotes", "*/15 * * * *", internal.maintenance.expireQuotes, {});
crons.cron("auto-complete orders", "30 1 * * *", internal.maintenance.autoCompleteOrders, {});

export default crons;
