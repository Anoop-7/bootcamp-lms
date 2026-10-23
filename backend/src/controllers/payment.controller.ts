import { Request, Response, NextFunction } from "express";
import { PaymentService } from "../services/payment.service.js";
import { badRequest } from "../utils/httpError.js";

const paymentService = new PaymentService();

export class PaymentController {
  async createOrder(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user!.userId;
      const { cohortId } = req.body;

      if (!cohortId) {
        throw badRequest("cohortId is required", "MISSING_COHORT_ID");
      }

      const orderData = await paymentService.createOrder(userId, cohortId);
      res.status(201).json({ status: "success", data: orderData });
    } catch (err: unknown) {
      next(err);
    }
  }

  async verifyPayment(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user!.userId;
      const { cohortId, razorpayOrderId, razorpayPaymentId, razorpaySignature } = req.body;

      if (!cohortId || !razorpayOrderId || !razorpayPaymentId || !razorpaySignature) {
        throw badRequest("All payment verification parameters are required", "MISSING_PARAMS");
      }

      const result = await paymentService.verifyPayment(userId, {
        cohortId,
        razorpayOrderId,
        razorpayPaymentId,
        razorpaySignature,
      });

      res.status(200).json({ status: "success", data: result });
    } catch (err: unknown) {
      next(err);
    }
  }
}