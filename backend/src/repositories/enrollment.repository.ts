import { prisma } from "../config/db.js";
import { Enrollment, Order, PaymentStatus } from "@prisma/client";
import crypto from "crypto";

export class EnrollmentRepository {
  async findEnrollment(userId: string, cohortId: string): Promise<Enrollment | null> {
    return prisma.enrollment.findUnique({
      where: {
        userId_cohortId: {
          userId,
          cohortId,
        },
      },
    });
  }

  async getStudentEnrollments(userId: string) {
    return prisma.enrollment.findMany({
      where: { userId },
      include: {
        cohort: {
          select: {
            id: true,
            title: true,
            slug: true,
            description: true,
            thumbnail: true,
            status: true,
            isLiveActive: true,
            instructor: {
              select: {
                id: true,
                name: true,
                avatar: true,
              },
            },
          },
        },
      },
      orderBy: { enrolledAt: "desc" },
    });
  }

  async createEnrollmentWithOrder(params: {
    userId: string;
    cohortId: string;
    amount: number;
    razorpayOrderId?: string;
    razorpayPaymentId?: string;
  }): Promise<{ enrollment: Enrollment; order: Order }> {
    return prisma.$transaction(async (tx) => {
      const order = await tx.order.create({
        data: {
          userId: params.userId,
          cohortId: params.cohortId,
          amount: params.amount,
          currency: "INR",
          razorpayOrderId: params.razorpayOrderId || `order_${crypto.randomUUID()}`,
          razorpayPaymentId: params.razorpayPaymentId || `pay_mock_${crypto.randomUUID()}`,
          status: PaymentStatus.SUCCESS,
        },
      });

      const enrollment = await tx.enrollment.create({
        data: {
          userId: params.userId,
          cohortId: params.cohortId,
        },
      });

      return { enrollment, order };
    });
  }
}