// inspect-drive\src\app\api\auth\authOptions.ts

import { NextAuthOptions } from 'next-auth';
import CredentialsProvider from 'next-auth/providers/credentials';
import { JWT } from 'next-auth/jwt';
import bcrypt from 'bcryptjs';
import mongoose from 'mongoose';

import connectDB from '@/lib/dbConnect';
import User from '@/models/User';
import logger from '@/lib/logger';

// Interface for Mongo user document
interface UserType {
  _id: mongoose.Types.ObjectId;
  passwordHash: string;
  email: string;
  username: string;
  role?: string;
  department?: string;
  isApproved: boolean;
}

// Returned by authorize()
interface AuthUser {
  id: string;
  email: string;
  name: string;
  role: string;
  department: string;
}

// Extend JWT to include custom fields
interface ExtendedJWT extends JWT {
  id: string;
  role: string;
  department: string;
}

export const authOptions: NextAuthOptions = {
  secret: process.env.NEXTAUTH_SECRET,
  providers: [
    CredentialsProvider({
      name: 'Credentials',
      credentials: {
        email: { label: 'Email', type: 'text' },
        password: { label: 'Password', type: 'password' },
      },
      async authorize(credentials) {
        logger.debug('[auth] authorize start');
        if (!credentials?.email || !credentials?.password) {
          logger.warn('[auth] Missing email or password');
          throw new Error('กรุณากรอกอีเมลและรหัสผ่าน');
        }

        // Connect to database
        try {
          await connectDB();
          logger.debug('[auth] Database connected');
        } catch (error) {
          logger.error('[auth] Database connection failed', error);
          throw new Error('Database connection error');
        }

        // Find user
        let user: UserType | null;
        try {
          user = await User.findOne({ email: credentials.email }).lean<UserType>();
          logger.debug('[auth] User lookup', { email: credentials.email, found: Boolean(user) });
        } catch (error) {
          logger.error('[auth] Error fetching user', error);
          throw new Error('Error fetching user');
        }
        if (!user) {
          logger.warn('[auth] User not found', { email: credentials.email });
          throw new Error('ไม่พบผู้ใช้งาน');
        }

        // Check approval
        if (!user.isApproved) {
          logger.warn('[auth] User not approved', { userId: user._id.toString() });
          throw new Error('บัญชีของคุณยังไม่ผ่านการอนุมัติจากผู้ดูแลระบบ');
        }

        // Verify password
        const isValid = await bcrypt.compare(credentials.password, user.passwordHash);
        if (!isValid) {
          logger.warn('[auth] Invalid password attempt', { userId: user._id.toString() });
          throw new Error('รหัสผ่านไม่ถูกต้อง');
        }

        // Successful authentication
        const authUser: AuthUser = {
          id: user._id.toString(),
          email: user.email,
          name: user.username,
          role: user.role ?? 'User',
          department: user.department ?? 'Unknown',
        };
        logger.info('[auth] User authorized', { userId: authUser.id });
        return authUser;
      },
    }),
  ],
  session: {
    strategy: 'jwt',
    maxAge: 6 * 60 * 60, // 6 hours
  },
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        const authUser = user as AuthUser;
        token.id = authUser.id;
        token.role = authUser.role;
        token.department = authUser.department;
        logger.debug('[auth] JWT callback set token', { id: token.id });
      }
      return token as ExtendedJWT;
    },
    async session({ session, token }) {
      const ext = token as ExtendedJWT;
      session.user.id = ext.id;
      session.user.role = ext.role;
      session.user.department = ext.department;
      logger.debug('[auth] Session callback updated session', { userId: ext.id });
      return session;
    },
  },
  pages: {
    signIn: '/login',
  },
  debug: process.env.NODE_ENV === 'development',
};
