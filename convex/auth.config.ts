/**
 * Convex Auth issues its own JWTs; Convex verifies them against this deployment's site URL.
 * Missing or wrong = every request silently unauthenticated (docs/SECURITY.md §D1).
 */
const authConfig = {
  providers: [
    {
      domain: process.env.CONVEX_SITE_URL,
      applicationID: "convex",
    },
  ],
};

export default authConfig;
