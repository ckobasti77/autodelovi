import rateLimiter from "@convex-dev/rate-limiter/convex.config";
import resend from "@convex-dev/resend/convex.config";
import { defineApp } from "convex/server";

const app = defineApp();
app.use(rateLimiter);
// Installed now, used from step 18 (EMAIL_MODE=log never calls it).
app.use(resend);

export default app;
