import { httpRouter } from "convex/server";

import { auth } from "./auth";

const http = httpRouter();

// Convex Auth: OIDC discovery, JWKS and OAuth callback routes.
auth.addHttpRoutes(http);

export default http;
