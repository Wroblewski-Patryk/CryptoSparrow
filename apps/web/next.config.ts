import type { NextConfig } from "next";
import { createHash } from "node:crypto";
import { themeBootstrapScript } from "./src/security/themeBootstrap";

const themeBootstrapScriptSha256 = createHash("sha256")
  .update(themeBootstrapScript)
  .digest("base64");

const buildCsp = (nodeEnv: string | undefined) => {
  const isDev = nodeEnv === "development";
  const scriptSources = isDev
    ? "script-src 'self' 'unsafe-inline' 'unsafe-eval'"
    : `script-src 'self' 'unsafe-inline' 'sha256-${themeBootstrapScriptSha256}'`;
  const connectSources = isDev
    ? "connect-src 'self' http: https: ws: wss:"
    : "connect-src 'self' https: ws: wss:";

  return [
    "default-src 'self'",
    "base-uri 'self'",
    "frame-ancestors 'none'",
    "object-src 'none'",
    scriptSources,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob: https:",
    "font-src 'self' data:",
    connectSources,
    "form-action 'self'",
  ].join("; ");
};

const nextConfig: NextConfig = {
  async headers() {
    const csp = buildCsp(process.env.NODE_ENV);
    return [
      {
        source: "/:path*",
        headers: [
          { key: "Content-Security-Policy", value: csp },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=(), payment=()",
          },
        ],
      },
    ];
  },
};

export { buildCsp };
export { themeBootstrapScriptSha256 };
export default nextConfig;
