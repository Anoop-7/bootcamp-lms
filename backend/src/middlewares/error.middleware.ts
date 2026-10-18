import { Request, Response, NextFunction } from "express";
import { Prisma } from "@prisma/client";

export function errorMiddleware(
  err: any,
  _req: Request,
  res: Response,
  _next: NextFunction
): void {
  // 1. Log internal error details on the server for debugging
  console.error("[SERVER_ERROR]:", err);

  // 2. Handle Prisma Database-Specific Errors
  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    switch (err.code) {
      case "P2002": {
        // Unique constraint violation
        const target = Array.isArray(err.meta?.target)
          ? err.meta?.target.join(", ")
          : "field";
        res.status(409).json({
          status: "error",
          message: `A record with this ${target} already exists. Please choose a different value.`,
        });
        return;
      }
      case "P2025": {
        // Record not found
        res.status(404).json({
          status: "error",
          message: "The requested resource could not be found.",
        });
        return;
      }
      case "P2003": {
        // Foreign key constraint failure
        res.status(400).json({
          status: "error",
          message: "Operation failed because related records are missing or protected.",
        });
        return;
      }
      default: {
        res.status(400).json({
          status: "error",
          message: "Database operation failed. Please check your data and try again.",
        });
        return;
      }
    }
  }

  // 3. Handle Prisma Validation Errors (bad types, missing fields)
  if (err instanceof Prisma.PrismaClientValidationError) {
    res.status(400).json({
      status: "error",
      message: "Invalid data format or missing required fields.",
    });
    return;
  }

  // 4. Handle Known Application/Business Errors
  if (err.status && typeof err.status === "number") {
    res.status(err.status).json({
      status: "error",
      message: err.message || "An unexpected error occurred.",
    });
    return;
  }

  // 5. Fallback for unhandled internal exceptions (Never expose raw stack traces)
  const isProduction = process.env.NODE_ENV === "production";
  res.status(500).json({
    status: "error",
    message: isProduction
      ? "An internal server error occurred. Please try again shortly."
      : err.message || "Internal server error",
  });
}