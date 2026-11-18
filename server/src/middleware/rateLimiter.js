import rateLimit from 'express-rate-limit';
import { env } from '../config/env.js';

const skipInTest = () => env.NODE_ENV === 'test';

export const authRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  skip: skipInTest,
  message: {
    success: false,
    error: {
      code: 'TOO_MANY_REQUESTS',
      message: 'Too many authentication attempts. Please try again later.',
    },
  },
});

export const apiRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 600,
  standardHeaders: true,
  legacyHeaders: false,
  skip: skipInTest,
  message: {
    success: false,
    error: {
      code: 'TOO_MANY_REQUESTS',
      message: 'API rate limit exceeded. Please slow down and try again.',
    },
  },
});
