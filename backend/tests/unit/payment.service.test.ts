import { describe, it, expect, vi, beforeEach } from "vitest";
import crypto from "crypto";
import { PaymentService } from "../../src/services/payment.service.js";
import prisma from "../../src/config/db.js";
import { env } from "../../src/config/env.js";
import { PaymentStatus } from "@prisma/client";

// Mock Razorpay SDK and Prisma
vi.mock("razorpay", () => {
  class MockRazorpay {
    orders = {
      create: vi.fn().mockResolvedValue({ id: "order_rzp_mock_123" }),
    };
  }
  return { default: MockRazorpay };
});

vi.mock("../../src/config/db.js", () => {
  return {
    default: {
      cohort: {
        findUnique: vi.fn(),
      },
      enrollment: {
        findUnique: vi.fn(),
        upsert: vi.fn(),
      },
      order: {
        create: vi.fn(),
        findUnique: vi.fn(),
        update: vi.fn(),
      },
      $transaction: vi.fn().mockImplementation((promises) => Promise.all(promises)),
    },
  };
});

describe("PaymentService - Commerce & Verification Security", () => {
  let paymentService: PaymentService;
  const testSecret = "test_razorpay_secret_key_12345";

  beforeEach(() => {
    vi.clearAllMocks();
    (env as any).RAZORPAY_KEY_ID = "rzp_test_key_id";
    (env as any).RAZORPAY_KEY_SECRET = testSecret;
    paymentService = new PaymentService();
  });

  describe("createOrder", () => {
    it("should reject order creation if cohort is not found", async () => {
      vi.mocked(prisma.cohort.findUnique).mockResolvedValue(null);

      await expect(
        paymentService.createOrder("user-1", "non-existent-cohort")
      ).rejects.toThrow("Cohort not found");
    });

    it("should reject order creation if user is already enrolled", async () => {
      vi.mocked(prisma.cohort.findUnique).mockResolvedValue({
        id: "cohort-1",
        title: "Fullstack Bootcamp",
        price: 4999,
      } as any);

      vi.mocked(prisma.enrollment.findUnique).mockResolvedValue({
        id: "enr-1",
        userId: "user-1",
        cohortId: "cohort-1",
      } as any);

      await expect(paymentService.createOrder("user-1", "cohort-1")).rejects.toThrow(
        "You are already enrolled in this cohort"
      );
    });

    it("should reject order creation if cohort price is 0 (free cohort)", async () => {
      vi.mocked(prisma.cohort.findUnique).mockResolvedValue({
        id: "cohort-free",
        title: "Free Workshop",
        price: 0,
      } as any);
      vi.mocked(prisma.enrollment.findUnique).mockResolvedValue(null);

      await expect(paymentService.createOrder("user-1", "cohort-free")).rejects.toThrow(
        "This cohort is free"
      );
    });

    it("should accurately convert rupees to paise for Razorpay order generation", async () => {
      const priceInRupees = 2999;
      vi.mocked(prisma.cohort.findUnique).mockResolvedValue({
        id: "cohort-1",
        title: "Fullstack Bootcamp",
        price: priceInRupees,
      } as any);
      vi.mocked(prisma.enrollment.findUnique).mockResolvedValue(null);

      vi.mocked(prisma.order.create).mockResolvedValue({
        id: "ord-internal-1",
        userId: "user-1",
        cohortId: "cohort-1",
        amount: priceInRupees,
        currency: "INR",
        razorpayOrderId: "order_rzp_mock_123",
        status: PaymentStatus.PENDING,
      } as any);

      const orderResult = await paymentService.createOrder("user-1", "cohort-1");

      // 2999 INR = 299900 paise
      expect(orderResult.amount).toBe(299900);
      expect(orderResult.orderId).toBe("order_rzp_mock_123");
      expect(orderResult.currency).toBe("INR");
    });
  });

  describe("verifyPayment - HMAC SHA-256 Signature Validation", () => {
    it("should successfully verify genuine payment signature and confirm enrollment", async () => {
      const orderId = "order_rzp_123";
      const paymentId = "pay_rzp_456";
      const body = `${orderId}|${paymentId}`;
      const validSignature = crypto
        .createHmac("sha256", testSecret)
        .update(body)
        .digest("hex");

      vi.mocked(prisma.order.findUnique).mockResolvedValue({
        id: "order-db-id",
        userId: "user-1",
        cohortId: "cohort-1",
        razorpayOrderId: orderId,
        status: PaymentStatus.PENDING,
      } as any);

      const result = await paymentService.verifyPayment("user-1", {
        cohortId: "cohort-1",
        razorpayOrderId: orderId,
        razorpayPaymentId: paymentId,
        razorpaySignature: validSignature,
      });

      expect(result.success).toBe(true);
      expect(prisma.order.update).toHaveBeenCalledWith({
        where: { id: "order-db-id" },
        data: {
          status: PaymentStatus.SUCCESS,
          razorpayPaymentId: paymentId,
        },
      });
      expect(prisma.enrollment.upsert).toHaveBeenCalledWith({
        where: { userId_cohortId: { userId: "user-1", cohortId: "cohort-1" } },
        create: { userId: "user-1", cohortId: "cohort-1" },
        update: {},
      });
    });

    it("should reject forged signature, mark order as FAILED, and throw INVALID_SIGNATURE", async () => {
      const orderId = "order_rzp_123";
      const paymentId = "pay_rzp_456";
      const forgedSignature = "forged_signature_hex_000000000000000000000000000000000000000000000";

      vi.mocked(prisma.order.findUnique).mockResolvedValue({
        id: "order-db-id",
        userId: "user-1",
        cohortId: "cohort-1",
        razorpayOrderId: orderId,
        status: PaymentStatus.PENDING,
      } as any);

      await expect(
        paymentService.verifyPayment("user-1", {
          cohortId: "cohort-1",
          razorpayOrderId: orderId,
          razorpayPaymentId: paymentId,
          razorpaySignature: forgedSignature,
        })
      ).rejects.toThrow("Payment signature verification failed");

      expect(prisma.order.update).toHaveBeenCalledWith({
        where: { id: "order-db-id" },
        data: { status: PaymentStatus.FAILED },
      });
    });

    it("should be idempotent if order status is already SUCCESS", async () => {
      vi.mocked(prisma.order.findUnique).mockResolvedValue({
        id: "order-db-id",
        userId: "user-1",
        cohortId: "cohort-1",
        razorpayOrderId: "order_rzp_123",
        status: PaymentStatus.SUCCESS,
      } as any);

      const result = await paymentService.verifyPayment("user-1", {
        cohortId: "cohort-1",
        razorpayOrderId: "order_rzp_123",
        razorpayPaymentId: "pay_rzp_456",
        razorpaySignature: "dummy_sig",
      });

      expect(result.success).toBe(true);
      expect(result.message).toContain("already verified");
    });
  });
});
