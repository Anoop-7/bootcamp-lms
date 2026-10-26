import Razorpay from "razorpay";
import crypto from "crypto";
import prisma from "../config/db.js";
import { env } from "../config/env.js";
import { badRequest, notFound, conflict, internal } from "../utils/httpError.js";
import { PaymentStatus } from "@prisma/client";

export class PaymentService {
  private razorpay: Razorpay;

  constructor() {
    const key_id = env.RAZORPAY_KEY_ID || process.env.RAZORPAY_KEY_ID;
    const key_secret = env.RAZORPAY_KEY_SECRET || process.env.RAZORPAY_KEY_SECRET;

    if (!key_id || !key_secret) {
      throw internal("Razorpay payment gateway credentials are not configured", "PAYMENT_CONFIG_ERROR");
    }

    this.razorpay = new Razorpay({
      key_id,
      key_secret,
    });
  }

  async createOrder(userId: string, cohortId: string) {
    const cohort = await prisma.cohort.findUnique({
      where: { id: cohortId },
      select: { id: true, title: true, price: true },
    });

    if (!cohort) {
      throw notFound("Cohort not found", "COHORT_NOT_FOUND");
    }

    // Check if user is already enrolled
    const existing = await prisma.enrollment.findUnique({
      where: { userId_cohortId: { userId, cohortId } },
    });

    if (existing) {
      throw conflict("You are already enrolled in this cohort", "ALREADY_ENROLLED");
    }

    if (cohort.price <= 0) {
      throw badRequest("This cohort is free. Please use the free enrollment endpoint.", "FREE_COHORT");
    }

    // Amount for Razorpay is strictly in the smallest currency sub-unit (paise)
    const amountInPaise = Math.round(cohort.price * 100);

    const order = await this.razorpay.orders.create({
      amount: amountInPaise,
      currency: "INR",
      receipt: `rcpt_${userId.substring(0, 8)}_${Date.now()}`,
      notes: {
        cohortId,
        userId,
      },
    });

    // Persist pending order record
    const dbOrder = await prisma.order.create({
      data: {
        userId,
        cohortId,
        amount: cohort.price,
        currency: "INR",
        razorpayOrderId: order.id,
        status: PaymentStatus.PENDING,
      },
    });

    return {
      orderId: dbOrder.razorpayOrderId,
      amount: amountInPaise,
      currency: "INR",
      cohortTitle: cohort.title,
      keyId: env.RAZORPAY_KEY_ID || process.env.RAZORPAY_KEY_ID!,
    };
  }

  async verifyPayment(
    userId: string,
    data: {
      cohortId: string;
      razorpayOrderId: string;
      razorpayPaymentId: string;
      razorpaySignature: string;
    }
  ) {
    const { cohortId, razorpayOrderId, razorpayPaymentId, razorpaySignature } = data;

    const order = await prisma.order.findUnique({
      where: { razorpayOrderId },
    });

    if (!order || order.userId !== userId || order.cohortId !== cohortId) {
      throw badRequest("Order record not found or does not match transaction", "INVALID_ORDER");
    }

    if (order.status === PaymentStatus.SUCCESS) {
      return { success: true, message: "Order already verified and enrolled." };
    }

    const secret = env.RAZORPAY_KEY_SECRET || process.env.RAZORPAY_KEY_SECRET;
    if (!secret) {
      throw internal("Razorpay secret key is not configured", "PAYMENT_CONFIG_ERROR");
    }

    // Cryptographic signature validation using HMAC SHA256 and constant-time comparison
    const body = `${razorpayOrderId}|${razorpayPaymentId}`;
    const expectedSignature = crypto
      .createHmac("sha256", secret)
      .update(body)
      .digest("hex");

    const expectedBuf = Buffer.from(expectedSignature, "utf8");
    const receivedBuf = Buffer.from(razorpaySignature || "", "utf8");

    const isMatch =
      expectedBuf.length === receivedBuf.length &&
      crypto.timingSafeEqual(expectedBuf, receivedBuf);

    if (!isMatch) {
      await prisma.order.update({
        where: { id: order.id },
        data: { status: PaymentStatus.FAILED },
      });
      throw badRequest("Payment signature verification failed", "INVALID_SIGNATURE");
    }

    // Atomic transaction: mark order SUCCESS and create student Enrollment
    await prisma.$transaction([
      prisma.order.update({
        where: { id: order.id },
        data: {
          status: PaymentStatus.SUCCESS,
          razorpayPaymentId,
        },
      }),
      prisma.enrollment.upsert({
        where: { userId_cohortId: { userId, cohortId } },
        create: { userId, cohortId },
        update: {},
      }),
    ]);

    return { success: true, message: "Payment verified and enrollment confirmed!" };
  }
}