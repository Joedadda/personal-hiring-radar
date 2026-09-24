import { betterAuth } from "better-auth";
import { sendDigestEmail } from "./email";
import { getPool } from "./postgres";

function createAuth() {
  const googleId = process.env.GOOGLE_CLIENT_ID;
  const googleSecret = process.env.GOOGLE_CLIENT_SECRET;
  return betterAuth({
      secret: process.env.BETTER_AUTH_SECRET,
      baseURL: process.env.BETTER_AUTH_URL,
      trustedOrigins: [process.env.BETTER_AUTH_URL, process.env.APP_URL, "http://localhost:3000", "http://127.0.0.1:3000"].filter(
        (origin): origin is string => Boolean(origin)
      ),
      database: getPool(),
      emailAndPassword: {
        enabled: true,
        sendResetPassword: async ({ user, url }) => {
          const result = await sendDigestEmail({
            to: user.email,
            subject: "Reset your Hiring Radar password",
            text: `Choose a new password: ${url}`,
            html: `<p>Choose a new password for Hiring Radar.</p><p><a href="${url}">Reset password</a></p>`,
          });
          if (!result.sent) throw new Error(result.reason || "Could not send the reset email.");
        },
      },
      socialProviders:
        googleId && googleSecret
          ? {
              google: {
                clientId: googleId,
                clientSecret: googleSecret,
              },
            }
          : undefined,
      account: {
        accountLinking: {
          enabled: true,
          trustedProviders: ["google"],
          requireLocalEmailVerified: false,
        },
      },
    });
}

let auth: ReturnType<typeof createAuth> | undefined;

export function getAuth() {
  if (!auth) auth = createAuth();
  return auth;
}
