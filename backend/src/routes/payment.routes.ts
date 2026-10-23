import { Router } from "express";
import { PaymentController } from "../controllers/payment.controller.js";
import { authenticate } from "../middlewares/auth.middleware.js";

const router = Router();
const controller = new PaymentController();

router.post("/orders", authenticate, controller.createOrder);
router.post("/verify", authenticate, controller.verifyPayment);

export default router;