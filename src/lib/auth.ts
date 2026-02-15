import { AuthOptions } from 'next-auth';
import { prisma } from '@/lib/prisma';
import { signIn } from "next-auth/react";

export const authOptions: AuthOptions = {
  debug: true,
  providers: [
    {
      id: "central-auth",
      name: "Central Account",
      type: "oauth",
      wellKnown: `${process.env.CENTRAL_AUTH_URL}/oidc/.well-known/openid-configuration`,
      authorization: { params: { scope: "openid email profile" } },
      idToken: true,
      client: {
        id_token_signed_response_alg: "HS256",
      },
      checks: ["pkce", "state"],
      clientId: process.env.CENTRAL_CLIENT_ID,
      clientSecret: process.env.CENTRAL_CLIENT_SECRET,
      profile(profile) {
        return {
          id: profile.sub,
          name: profile.name,
          email: profile.email,
          image: profile.picture,
          role: profile.role, // Syncing role from Central Service
        };
      },
    },
  ],
  callbacks: {
    // src/lib/auth.ts
    async signIn({ user }) {
      if (!user.email) return false;

      try {
        const existingUser = await prisma.user.findUnique({
          where: { email: user.email }
        });

        // Map and validate role from SSO
        let userRole: 'ADMIN' | 'USER' = 'USER';
        if (user.role) {
          const roleUpper = (user.role as string).toUpperCase();
          if (roleUpper === 'ADMIN') userRole = 'ADMIN';
          else if (roleUpper === 'USER') userRole = 'USER';
        }

        if (existingUser) {
          // If IDs don't match, we update the existing record to use the Central ID
          // onUpdate: Cascade in schema.prisma will handle updating references
          if (existingUser.id !== user.id) {
            console.log(`Migrating user ID for ${user.email}: ${existingUser.id} -> ${user.id}`);
            await prisma.user.update({
              where: { email: user.email },
              data: {
                id: user.id, // Migrate the local ID to the Central ID
                name: user.name,
                image: user.image,
                role: userRole,
              },
            });
          } else {
            // Update other fields if ID already matches
            await prisma.user.update({
              where: { id: user.id },
              data: {
                name: user.name,
                image: user.image,
                role: userRole,
              },
            });
          }
        } else {
          // New user entirely
          await prisma.user.create({
            data: {
              id: user.id,
              email: user.email,
              name: user.name,
              image: user.image,
              role: userRole,
            },
          });
        }
        return true;
      } catch (error) {
        console.error("Error in signIn callback:", error);
        // Still return true to allow sign in if the user exists but update failed?
        // Actually, it's safer to return false if we can't sync the user properly
        // but for better UX we might want to be careful.
        // For now, let's keep it strict so we catch errors.
        return false;
      }
    },
    async jwt({ token, user, trigger, session }) {
      if (user) {
        token.id = user.id;
        token.role = user.role;
      }
      
      // Update from local DB if necessary for local-only metadata
      if (trigger === "update" && session) {
        token = { ...token, ...session };
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.id as string;
        session.user.role = token.role as string;
      }
      return session;
    },
  },
  pages: {
    signIn: '/login',
    error: '/auth/error',
  },
  session: {
    strategy: 'jwt', // This allows us to remove the Session table
  },
  secret: process.env.NEXTAUTH_SECRET,
};

export const handleLogin = async (callbackUrl = "/dashboard") => {
  try {
    await signIn("central-auth", { callbackUrl });
  } catch (error) {
    console.error("Central login error:", error);
  }
};