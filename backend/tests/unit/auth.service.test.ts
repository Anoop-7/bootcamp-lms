import { describe, it, expect, vi, beforeEach } from "vitest";
import jwt from "jsonwebtoken";
import { AuthService } from "../../src/services/auth.service.js";
import { UserRepository } from "../../src/repositories/user.repository.js";
import { Role } from "@prisma/client";
import { env } from "../../src/config/env.js";

// Mock the UserRepository class
vi.mock("../../src/repositories/user.repository.js", () => {
  class MockUserRepository {
    async findByEmail(_email: string) {
      return null;
    }
    async findById(_id: string) {
      return null;
    }
    async create(_data: any) {
      return {} as any;
    }
  }
  return { UserRepository: MockUserRepository };
});

describe("AuthService - Dual-Token & Session Management", () => {
  let authService: AuthService;
  let mockUserRepo: any;

  beforeEach(() => {
    vi.clearAllMocks();
    authService = new AuthService();
    // Access the mocked repository instance inside authService
    mockUserRepo = (authService as any).userRepository || new UserRepository();
    (authService as any).userRepository = mockUserRepo;
  });

  describe("Token Generation", () => {
    it("should generate a 15-minute access token containing userId, role, and tokenVersion", () => {
      const userId = "usr-123";
      const role = Role.STUDENT;
      const tokenVersion = 2;

      const token = authService.generateAccessToken(userId, role, tokenVersion);
      expect(typeof token).toBe("string");

      const decoded = jwt.verify(token, env.JWT_SECRET) as any;
      expect(decoded.userId).toBe(userId);
      expect(decoded.role).toBe(role);
      expect(decoded.tokenVersion).toBe(tokenVersion);

      // 15 minutes = 900 seconds
      const lifespan = decoded.exp - decoded.iat;
      expect(lifespan).toBe(900);
    });

    it("should generate a 7-day refresh token containing userId and tokenVersion", () => {
      const userId = "usr-123";
      const tokenVersion = 3;

      const refreshToken = authService.generateRefreshToken(userId, tokenVersion);
      expect(typeof refreshToken).toBe("string");

      const decoded = jwt.verify(refreshToken, env.JWT_SECRET) as any;
      expect(decoded.userId).toBe(userId);
      expect(decoded.tokenVersion).toBe(tokenVersion);

      // 7 days = 604,800 seconds
      const lifespan = decoded.exp - decoded.iat;
      expect(lifespan).toBe(7 * 24 * 60 * 60);
    });
  });

  describe("Session Refresh (refreshSession)", () => {
    it("should successfully rotate tokens when valid refresh token is supplied", async () => {
      const userId = "user-active-1";
      const tokenVersion = 1;
      const validRefreshToken = authService.generateRefreshToken(userId, tokenVersion);

      const mockDbUser = {
        id: userId,
        email: "student@example.com",
        name: "Test Student",
        role: Role.STUDENT,
        tokenVersion: 1,
      };

      vi.spyOn(UserRepository.prototype, "findById").mockResolvedValue(mockDbUser as any);

      const result = await authService.refreshSession(validRefreshToken);

      expect(result.accessToken).toBeDefined();
      expect(result.token).toBe(result.accessToken);
      expect(result.refreshToken).toBeDefined();
      expect(result.refreshToken).not.toBe(validRefreshToken); // Rotated token
      expect(result.user.id).toBe(userId);
      expect(result.user.email).toBe("student@example.com");

      // Verify new tokens decode properly
      const decodedAccess = jwt.verify(result.accessToken, env.JWT_SECRET) as any;
      expect(decodedAccess.userId).toBe(userId);
      expect(decodedAccess.tokenVersion).toBe(tokenVersion);

      const decodedRefresh = jwt.verify(result.refreshToken, env.JWT_SECRET) as any;
      expect(decodedRefresh.userId).toBe(userId);
      expect(decodedRefresh.tokenVersion).toBe(tokenVersion);
    });

    it("should reject refresh if the token signature is invalid or tampered", async () => {
      const tamperedToken = "header.payload.invalidsignature123";

      await expect(authService.refreshSession(tamperedToken)).rejects.toThrow(
        "Invalid or expired refresh token"
      );
    });

    it("should reject refresh if the user no longer exists in the database", async () => {
      const userId = "non-existent-user";
      const validToken = authService.generateRefreshToken(userId, 0);

      vi.spyOn(UserRepository.prototype, "findById").mockResolvedValue(null);

      await expect(authService.refreshSession(validToken)).rejects.toThrow(
        "User account no longer exists"
      );
    });

    it("should reject refresh if tokenVersion in DB was incremented (session revocation)", async () => {
      const userId = "user-revoked";
      const oldTokenVersion = 1;
      // Stale refresh token issued with version 1
      const staleToken = authService.generateRefreshToken(userId, oldTokenVersion);

      // Database has version 2 (password was changed/reset)
      const mockDbUser = {
        id: userId,
        email: "revoked@example.com",
        name: "Revoked Student",
        role: Role.STUDENT,
        tokenVersion: 2,
      };

      vi.spyOn(UserRepository.prototype, "findById").mockResolvedValue(mockDbUser as any);

      await expect(authService.refreshSession(staleToken)).rejects.toThrow(
        "Session expired or revoked. Please log in again."
      );
    });
  });
});
