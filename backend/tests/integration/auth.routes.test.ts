import { describe, it, expect, vi, beforeEach } from "vitest";
import request from "supertest";
import app from "../../src/app.js";
import { AuthService } from "../../src/services/auth.service.js";
import { UserRepository } from "../../src/repositories/user.repository.js";
import { Role } from "@prisma/client";

// Mock the UserRepository class methods
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

const getCookies = (res: request.Response): string[] => {
  const header = res.headers["set-cookie"];
  if (Array.isArray(header)) return header;
  if (typeof header === "string") return [header];
  return [];
};

describe("Auth HTTP Integration Routes", () => {
  const authService = new AuthService();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("POST /api/v1/auth/refresh", () => {
    it("should return 401 if refresh cookie is not provided", async () => {
      const res = await request(app).post("/api/v1/auth/refresh");

      expect(res.status).toBe(401);
      expect(res.body.status).toBe("error");
      expect(res.body.message).toContain("Refresh token missing");
    });

    it("should return 401 and clear cookie if refresh token is malformed", async () => {
      const res = await request(app)
        .post("/api/v1/auth/refresh")
        .set("Cookie", ["refreshToken=invalid.token.signature"]);

      expect(res.status).toBe(401);
      expect(res.body.status).toBe("error");

      // Verify Set-Cookie header contains instructions to expire the cookie
      const cookies = getCookies(res);
      expect(cookies.length).toBeGreaterThan(0);
      expect(cookies.some((c) => c.includes("refreshToken=;"))).toBe(true);
    });

    it("should rotate tokens and return new access token when valid refresh cookie is sent", async () => {
      const userId = "usr-test-student";
      const tokenVersion = 1;
      const validRefreshToken = authService.generateRefreshToken(userId, tokenVersion);

      vi.spyOn(UserRepository.prototype, "findById").mockResolvedValue({
        id: userId,
        email: "student@example.com",
        name: "Test Student",
        role: Role.STUDENT,
        tokenVersion: 1,
      } as any);

      const res = await request(app)
        .post("/api/v1/auth/refresh")
        .set("Cookie", [`refreshToken=${validRefreshToken}`]);

      expect(res.status).toBe(200);
      expect(res.body.status).toBe("success");
      expect(res.body.data.token).toBeDefined();
      expect(res.body.data.accessToken).toBeDefined();
      expect(res.body.data.user.id).toBe(userId);

      // Verify Set-Cookie header sets the newly rotated refreshToken
      const cookies = getCookies(res);
      expect(cookies.length).toBeGreaterThan(0);
      expect(cookies.some((c) => c.includes("refreshToken="))).toBe(true);
    });
  });

  describe("POST /api/v1/auth/logout", () => {
    it("should clear the refreshToken cookie and return 200", async () => {
      const res = await request(app).post("/api/v1/auth/logout");

      expect(res.status).toBe(200);
      expect(res.body.status).toBe("success");
      expect(res.body.message).toBe("Logged out successfully");

      const cookies = getCookies(res);
      expect(cookies.length).toBeGreaterThan(0);
      expect(cookies.some((c) => c.includes("refreshToken=;"))).toBe(true);
    });
  });

  describe("POST /api/v1/auth/login", () => {
    it("should return 400 when missing credentials", async () => {
      const res = await request(app)
        .post("/api/v1/auth/login")
        .send({ email: "" });

      expect(res.status).toBe(400);
      expect(res.body.status).toBe("error");
    });
  });
});
