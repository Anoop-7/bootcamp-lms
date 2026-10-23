import Razorpay from "razorpay";
import crypto from "crypto";
import prisma from "../config/db.js";
import { env } from "../config/env.js";
import { badRequest, notFound, conflict } from "../utils/httpError.js";
import { PaymentStatus } from "@prisma/client";

export class PaymentService {
  private razorpay: Razorpay | null = null;

  constructor() {
    const key_id = process.env.RAZORPAY_KEY_ID;
    const key_secret = process.env.RAZORPAY_KEY_SECRET;

    if (key_id && key_secret) {
      this.razorpay = new Razorpay({
        key_id,
        key_secret,
      });
    }
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

    let razorpayOrderId: string;

    if (this.razorpay) {
      const order = await this.razorpay.orders.create({
        amount: amountInPaise,
        currency: "INR",
        receipt: `rcpt_${userId.substring(0, 8)}_${Date.now()}`,
        notes: {
          cohortId,
          userId,
        },
      });
      razorpayOrderId = order.id;
    } else {
      // Fallback stub for local testing if credentials are not yet entered
      razorpayOrderId = `order_test_${crypto.randomBytes(8).toString("hex")}`;
    }

    // Persist pending order record
    const dbOrder = await prisma.order.create({
      data: {
        userId,
        cohortId,
        amount: cohort.price,
        currency: "INR",
        razorpayOrderId,
        status: PaymentStatus.PENDING,
      },
    });

    return {
      orderId: dbOrder.razorpayOrderId,
      amount: amountInPaise,
      currency: "INR",
      cohortTitle: cohort.title,
      keyId: process.env.RAZORPAY_KEY_ID || "rzp_test_placeholder",
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

    // Cryptographic signature validation using HMAC SHA256
    const secret = process.env.RAZORPAY_KEY_SECRET;
    if (secret) {
      const body = `${razorpayOrderId}|${razorpayPaymentId}`;
      const expectedSignature = crypto
        .createHmac("sha256", secret)
        .update(body)
        .digest("hex");

      if (expectedSignature !== razorpaySignature) {
        await prisma.order.update({
          where: { id: order.id },
          data: { status: PaymentStatus.FAILED },
        });
        throw badRequest("Payment signature verification failed", "INVALID_SIGNATURE");
      }
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