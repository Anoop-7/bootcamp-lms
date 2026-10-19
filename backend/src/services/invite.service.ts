import crypto from "crypto";
import bcrypt from "bcryptjs";
import prisma from "../config/db.js";
import { InviteStatus, Role } from "@prisma/client";
import { env } from "../config/env.js";
import {
  badRequest,
  unauthorized,
  notFound,
  conflict,
  forbidden,
} from "../utils/httpError.js";

// Role hierarchy rank: Higher value means higher privileges
const ROLE_HIERARCHY: Record<Role, number> = {
  [Role.STUDENT]: 1,
  [Role.INSTRUCTOR]: 2,
  [Role.ADMIN]: 3,
};

export class InviteService {
  async createInstructorInvite(
    email: string,
    adminId: string,
    role: Role = Role.INSTRUCTOR
  ) {
    const normalizedEmail = email.trim().toLowerCase();

    const existingUser = await prisma.user.findUnique({
      where: { email: normalizedEmail },
    });

    if (existingUser) {
      if (existingUser.role === role) {
        throw conflict(`User is already an active ${role}.`, `USER_ALREADY_${role}`);
      }
      if (existingUser.role === Role.ADMIN && role !== Role.ADMIN) {
        throw badRequest(
          "This email belongs to an existing platform administrator.",
          "USER_IS_ADMIN"
        );
      }
    }

    const token = crypto.randomBytes(32).toString("hex");
    const expiresAt = new Date(Date.now() + 48 * 60 * 60 * 1000); // 48h

    const existingInvite = await prisma.instructorInvite.findFirst({
      where: { email: normalizedEmail },
    });

    let invite;
    if (existingInvite) {
      invite = await prisma.instructorInvite.update({
        where: { id: existingInvite.id },
        data: {
          token,
          role,
          expiresAt,
          invitedById: adminId,
          status: InviteStatus.PENDING,
          acceptedAt: null,
        },
      });
    } else {
      invite = await prisma.instructorInvite.create({
        data: {
          email: normalizedEmail,
          token,
          role,
          expiresAt,
          invitedById: adminId,
          status: InviteStatus.PENDING,
        },
      });
    }

    const inviteUrl = `${env.FRONTEND_URL}/onboard/instructor?token=${token}`;

    if (env.NODE_ENV === "development") {
      console.log(`✉️  [ONBOARDING INVITE DISPATCHED (${role})]: ${normalizedEmail} -> ${inviteUrl}`);
    }

    return {
      inviteId: invite.id,
      email: invite.email,
      role: invite.role,
      expiresAt: invite.expiresAt,
      inviteUrl,
    };
  }

  async verifyInviteToken(token: string) {
    const invite = await prisma.instructorInvite.findUnique({
      where: { token },
      include: {
        invitedBy: {
          select: { name: true, email: true },
        },
      },
    });

    if (!invite) {
      throw notFound("Invalid invite token.", "INVITE_NOT_FOUND");
    }
    if (invite.status === InviteStatus.REVOKED) {
      throw badRequest("This invite has been revoked by an administrator.", "INVITE_REVOKED");
    }
    if (invite.status === InviteStatus.ACCEPTED) {
      throw badRequest("This invite has already been redeemed.", "INVITE_ALREADY_USED");
    }
    if (invite.status !== InviteStatus.PENDING) {
      throw badRequest("Invalid invite state.", "INVITE_INVALID");
    }

    if (new Date() > invite.expiresAt) {
      await prisma.instructorInvite.update({
        where: { id: invite.id },
        data: { status: InviteStatus.EXPIRED },
      });
      throw badRequest("This invite has expired. Please ask for a new link.", "INVITE_EXPIRED");
    }

    const existingUser = await prisma.user.findUnique({
      where: { email: invite.email },
      select: { id: true, name: true, role: true },
    });

    return {
      email: invite.email,
      role: invite.role,
      expiresAt: invite.expiresAt,
      invitedBy: invite.invitedBy?.name || "System Admin",
      userExists: !!existingUser,
      existingName: existingUser?.name || null,
    };
  }

  async acceptInvite(token: string, name?: string, password?: string) {
    // 1. Verify token existence and state
    const invite = await prisma.instructorInvite.findUnique({
      where: { token },
    });

    if (!invite) throw notFound("Invalid invite token.", "INVITE_NOT_FOUND");
    if (invite.status === InviteStatus.REVOKED) {
      throw badRequest("This invite has been revoked.", "INVITE_REVOKED");
    }
    if (invite.status === InviteStatus.ACCEPTED) {
      throw badRequest("This invite has already been redeemed.", "INVITE_ALREADY_USED");
    }
    if (new Date() > invite.expiresAt) {
      throw badRequest("This invite has expired.", "INVITE_EXPIRED");
    }

    // 2. Pre-transaction credential validation
    const existingUser = await prisma.user.findUnique({
      where: { email: invite.email },
    });

    if (existingUser) {
      if (!existingUser.password) {
        throw badRequest(
          "This account has no password set. Please use the forgot-password flow first.",
          "PASSWORD_REQUIRED_RESET_FIRST"
        );
      }
      if (!password) {
        throw unauthorized(
          "Current password is required to claim this invite for an existing account.",
          "INVALID_CREDENTIALS"
        );
      }
      const isValid = await bcrypt.compare(password, existingUser.password);
      if (!isValid) {
        throw unauthorized("Incorrect password for existing account.", "INVALID_CREDENTIALS");
      }
    } else {
      if (!password || password.length < 6) {
        throw badRequest("Password must be at least 6 characters.", "PASSWORD_TOO_SHORT");
      }
    }

    // 3. Determine target role without downgrading
    let targetRole = invite.role;
    if (existingUser) {
      const currentRank = ROLE_HIERARCHY[existingUser.role];
      const inviteRank = ROLE_HIERARCHY[invite.role];
      // Only elevate, never demote through invite
      targetRole = inviteRank > currentRank ? invite.role : existingUser.role;
    }

    // 4. Atomic transaction to consume invite and update/create user
    return prisma.$transaction(async (tx) => {
      const updated = await tx.instructorInvite.updateMany({
        where: { id: invite.id, status: InviteStatus.PENDING },
        data: {
          status: InviteStatus.ACCEPTED,
          acceptedAt: new Date(),
        },
      });

      if (updated.count === 0) {
        throw badRequest("This invite has already been redeemed.", "INVITE_ALREADY_USED");
      }

      let finalUser;

      if (existingUser) {
        finalUser = await tx.user.update({
          where: { id: existingUser.id },
          data: { role: targetRole },
          select: { id: true, name: true, email: true, role: true, createdAt: true },
        });
      } else {
        const salt = await bcrypt.genSalt(10);
        const passwordHash = await bcrypt.hash(password!, salt);

        finalUser = await tx.user.create({
          data: {
            name: (name || (invite.role === Role.ADMIN ? "Administrator" : "Instructor")).trim(),
            email: invite.email,
            password: passwordHash,
            role: targetRole,
          },
          select: { id: true, name: true, email: true, role: true, createdAt: true },
        });
      }

      return finalUser;
    });
  }

  async revokeInvite(inviteId: string) {
    const invite = await prisma.instructorInvite.findUnique({
      where: { id: inviteId },
    });
    if (!invite) throw notFound("Invite not found.", "INVITE_NOT_FOUND");
    if (invite.status === InviteStatus.ACCEPTED) {
      throw badRequest("Cannot revoke an invite that has already been accepted.", "CANNOT_REVOKE_ACCEPTED_INVITE");
    }

    return prisma.instructorInvite.update({
      where: { id: inviteId },
      data: { status: InviteStatus.REVOKED },
    });
  }

  async resendInvite(inviteId: string, adminId: string) {
    const invite = await prisma.instructorInvite.findUnique({
      where: { id: inviteId },
    });
    if (!invite) throw notFound("Invite not found.", "INVITE_NOT_FOUND");
    if (invite.status === InviteStatus.ACCEPTED) {
      throw badRequest("This candidate has already accepted their invite.", "INVITE_ALREADY_ACCEPTED");
    }

    const token = crypto.randomBytes(32).toString("hex");
    const expiresAt = new Date(Date.now() + 48 * 60 * 60 * 1000);

    const updated = await prisma.instructorInvite.update({
      where: { id: inviteId },
      data: {
        token,
        expiresAt,
        status: InviteStatus.PENDING,
        invitedById: adminId,
      },
    });

    const inviteUrl = `${env.FRONTEND_URL}/onboard/instructor?token=${token}`;

    if (env.NODE_ENV === "development") {
      console.log(`✉️  [INVITE RE-ARMED (${invite.role})]: ${invite.email} -> ${inviteUrl}`);
    }

    return {
      inviteId: updated.id,
      email: updated.email,
      role: updated.role,
      expiresAt: updated.expiresAt,
      inviteUrl,
    };
  }

  async listInvites() {
    const invites = await prisma.instructorInvite.findMany({
      orderBy: { createdAt: "desc" },
      include: {
        invitedBy: {
          select: { name: true, email: true },
        },
      },
    });

    const emails = invites.map((inv) => inv.email);
    const users = await prisma.user.findMany({
      where: { email: { in: emails } },
      select: { email: true, role: true, id: true },
    });

    const userRoleMap = new Map(users.map((u) => [u.email, u.role]));

    return invites.map((inv) => ({
      ...inv,
      invitedBy: inv.invitedBy || { name: "System Admin", email: "" },
      currentRole: userRoleMap.get(inv.email) || null,
    }));
  }

  async listUsers() {
    return prisma.user.findMany({
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        createdAt: true,
        _count: {
          select: {
            cohortsTeaching: true,
            enrollments: true,
          },
        },
      },
    });
  }

  async updateUserRole(targetUserId: string, newRole: Role, currentAdminId: string) {
    if (targetUserId === currentAdminId && newRole !== Role.ADMIN) {
      throw forbidden("Security guard: You cannot demote your own administrator account.", "CANNOT_DEMOTE_SELF");
    }

    return prisma.user.update({
      where: { id: targetUserId },
      data: { role: newRole },
      select: { id: true, name: true, email: true, role: true },
    });
  }

  async deleteInvite(inviteId: string) {
    const invite = await prisma.instructorInvite.findUnique({
      where: { id: inviteId },
    });

    if (!invite) throw notFound("Invite not found.", "INVITE_NOT_FOUND");
    if (invite.status === InviteStatus.ACCEPTED) {
      throw badRequest("Cannot delete an accepted onboarding invite.", "CANNOT_DELETE_ACCEPTED_INVITE");
    }
    if (invite.status === InviteStatus.PENDING) {
      throw badRequest("Please revoke the active invite before deleting it.", "REVOKE_BEFORE_DELETE");
    }

    return prisma.instructorInvite.delete({
      where: { id: inviteId },
    });
  }
}