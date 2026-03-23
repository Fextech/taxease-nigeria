import NextAuth from "next-auth";
import Google from "next-auth/providers/google";
import Credentials from "next-auth/providers/credentials";
import { PrismaAdapter } from "@auth/prisma-adapter";
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter: PrismaAdapter(prisma),
  providers: [
    Google({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
      allowDangerousEmailAccountLinking: true,
    }),
    Credentials({
      name: "Email",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) {
          return null;
        }

        const user = await prisma.user.findUnique({
          where: { email: credentials.email as string },
          select: {
            id: true,
            email: true,
            name: true,
            image: true,
            password: true,
            isSuspended: true,
            deletedAt: true,
          },
        });

        if (!user || !user.password) {
          return null;
        }

        const isValid = await bcrypt.compare(
          credentials.password as string,
          user.password
        );

        if (!isValid) {
          return null;
        }

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          image: user.image,
        };
      },
    }),
  ],
  debug: process.env.NODE_ENV === "development",
  secret: process.env.AUTH_SECRET,
  session: {
    strategy: "jwt",
  },
  pages: {
    signIn: "/sign-in",
  },
  callbacks: {
    async signIn({ user, account, profile }) {
      if (!user.email) {
        return false;
      }

      if (account?.provider === "google") {
        const emailVerified =
          typeof profile === "object" &&
          profile !== null &&
          "email_verified" in profile
            ? Boolean((profile as { email_verified?: boolean }).email_verified)
            : false;

        if (!emailVerified) {
          return "/sign-in?error=GoogleEmailNotVerified";
        }

        const linkedAccount = await prisma.account.findUnique({
          where: {
            provider_providerAccountId: {
              provider: account.provider,
              providerAccountId: account.providerAccountId,
            },
          },
          include: {
            user: {
              select: {
                id: true,
                email: true,
                isSuspended: true,
                deletedAt: true,
              },
            },
          },
        });

        if (linkedAccount && !linkedAccount.user) {
          return "/sign-in?error=AccessDenied";
        }

        if (
          linkedAccount?.user &&
          linkedAccount.user.email.toLowerCase() !== user.email.toLowerCase()
        ) {
          return "/sign-in?error=GoogleAccountMismatch";
        }

        if (
          linkedAccount?.user &&
          (linkedAccount.user.isSuspended ||
            linkedAccount.user.deletedAt !== null)
        ) {
          return "/sign-in?error=AccountSuspended";
        }

        const existingUser = await prisma.user.findFirst({
          where: {
            email: {
              equals: user.email,
              mode: "insensitive",
            },
          },
          select: {
            isSuspended: true,
            deletedAt: true,
          },
        });

        if (existingUser?.isSuspended || existingUser?.deletedAt !== null) {
          return "/sign-in?error=AccountSuspended";
        }

        return true;
      }

      const dbUser = await prisma.user.findFirst({
        where: {
          email: {
            equals: user.email,
            mode: "insensitive",
          },
        },
        select: { isSuspended: true, deletedAt: true },
      });

      if (dbUser && (dbUser.isSuspended || dbUser.deletedAt !== null)) {
        return "/sign-in?error=AccountSuspended";
      }

      return true;
    },
    async redirect({ url, baseUrl }) {
      // After sign-in, go to overview instead of homepage
      if (url === baseUrl || url === baseUrl + "/") {
        return `${baseUrl}/overview`;
      }
      // Allow relative callback URLs
      if (url.startsWith("/")) return `${baseUrl}${url}`;
      // Allow callback URLs on the same origin
      if (new URL(url).origin === baseUrl) return url;
      return `${baseUrl}/overview`;
    },
    async jwt({ token, user, account, trigger, session }) {
      // On initial sign-in, attach user info
      if (user) {
        token.userId = user.id;
        token.authProvider = account?.provider ?? token.authProvider;

        // Check if user has MFA enabled
        const dbUser = await prisma.user.findUnique({
          where: { id: user.id },
          select: { mfaEnabled: true },
        });
        token.mfaEnabled = dbUser?.mfaEnabled ?? false;
        token.mfaVerified = false;
      }

      // On every token refresh, re-check account standing
      // This invalidates sessions for suspended/deleted users without waiting for token expiry
      if (token.userId) {
        const dbUser = await prisma.user.findUnique({
          where: { id: token.userId as string },
          select: { isSuspended: true, deletedAt: true, forceLogoutAt: true },
        });

        if (!dbUser || dbUser.isSuspended || dbUser.deletedAt !== null) {
          // Returning null-like token will cause the session to be invalidated
          token.invalid = true;
        } else if (dbUser.forceLogoutAt && token.iat) {
          // Invalidate tokens issued before the force logout timestamp
          // token.iat is in seconds, forceLogoutAt.getTime() is in milliseconds
          if ((token.iat as number) * 1000 < dbUser.forceLogoutAt.getTime()) {
            token.invalid = true;
          }
        }
      }

      // Allow updating the token from client-side (e.g., after MFA verification)
      if (trigger === "update" && session) {
        if (typeof session.mfaVerified === "boolean") {
          token.mfaVerified = session.mfaVerified;
        }
      }

      return token;
    },
    async session({ session, token }) {
      // Reject sessions for invalidated tokens (suspended/deleted users)
      if ((token as { invalid?: boolean }).invalid) {
        // Return an empty session object to force re-authentication
        return { ...session, user: undefined as unknown as typeof session.user };
      }
      if (session.user) {
        session.user.id = token.userId as string;
        (session as unknown as { mfaEnabled: boolean }).mfaEnabled = token.mfaEnabled as boolean;
        (session as unknown as { mfaVerified: boolean }).mfaVerified = token.mfaVerified as boolean;
        (session as unknown as { authProvider?: string }).authProvider =
          token.authProvider as string | undefined;
      }
      return session;
    },
  },
});
