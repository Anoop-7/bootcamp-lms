import { Router, Request, Response, NextFunction } from "express";
import { PaymentController } from "../controllers/payment.controller.js";
import { authenticate } from "../middlewares/auth.middleware.js";
import { env } from "../config/env.js";

const router = Router();
const controller = new PaymentController();

const requirePaymentsEnabled = (_req: Request, res: Response, next: NextFunction): void => {
  if (env.PAYMENTS_MODE !== "razorpay") {
    res.status(503).json({
      status: "error",
      code: "PAYMENTS_DISABLED",
      message: "Payment gateway is currently disabled or unconfigured.",
    });
    return;
  }
  next();
};

router.use(requirePaymentsEnabled);

router.post("/orders", authenticate, controller.createOrder);
router.post("/verify", authenticate, controller.verifyPayment);

export default router;