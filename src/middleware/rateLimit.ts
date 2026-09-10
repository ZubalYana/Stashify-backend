import rateLimit, { ipKeyGenerator } from "express-rate-limit";
import type { Request } from "express";

function userOrIpKey(req: Request): string {
  if (req.user?.user_id != null) {
    return `user:${req.user.user_id}`;
  }
  return ipKeyGenerator(req.ip ?? "unknown");
}

export const createLimiter = rateLimit({
  windowMs: 2000,
  limit: 1,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: userOrIpKey,
  handler: (_req, res) => {
    res.status(429).json({
      message: "Please wait a moment before creating another item",
    });
  },
});

export const analyzeLimiter = rateLimit({
  windowMs: 2000,
  limit: 1,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: userOrIpKey,
  handler: (_req, res) => {
    res.status(429).json({
      message: "Please wait a moment before analyzing again",
    });
  },
});

export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => ipKeyGenerator(req.ip ?? "unknown"),
  handler: (_req, res) => {
    res.status(429).json({
      message: "Too many attempts. Try again in a few minutes",
    });
  },
});
