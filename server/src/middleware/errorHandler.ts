import { Request, Response, NextFunction } from 'express';
import { ZodError } from 'zod';
import mongoose from 'mongoose';

export class AppError extends Error {
  public readonly statusCode: number;
  public readonly code: string;
  public readonly isOperational: boolean;
  public readonly details?: Record<string, string[]>;

  constructor(
    message: string,
    statusCode: number = 500,
    code: string = 'INTERNAL_ERROR',
    details?: Record<string, string[]>
  ) {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
    this.isOperational = true;
    this.details = details;
    
    Error.captureStackTrace(this, this.constructor);
  }
}

export function errorHandler(
  error: Error,
  req: Request,
  res: Response,
  next: NextFunction
): void {
  console.error('Error:', {
    message: error.message,
    stack: error.stack,
    path: req.path,
    method: req.method,
  });

  // Handle known operational errors
  if (error instanceof AppError) {
    res.status(error.statusCode).json({
      success: false,
      error: {
        code: error.code,
        message: error.message,
        details: error.details,
      },
    });
    return;
  }

  // Handle malformed request bodies (body-parser / express.json SyntaxError).
  // These bubble out of body-parser with the `type` property set on the error.
  const bodyParserType = (error as { type?: string }).type;
  if (
    error instanceof SyntaxError ||
    bodyParserType === 'entity.parse.failed' ||
    bodyParserType === 'entity.too.large' ||
    bodyParserType === 'request.size.invalid'
  ) {
    const isTooLarge = bodyParserType === 'entity.too.large';
    res.status(isTooLarge ? 413 : 400).json({
      success: false,
      error: {
        code: isTooLarge ? 'PAYLOAD_TOO_LARGE' : 'INVALID_JSON',
        message: isTooLarge
          ? 'Request body is too large.'
          : 'Request body is not valid JSON.',
      },
    });
    return;
  }

  // Handle Zod validation errors
  if (error instanceof ZodError) {
    const details: Record<string, string[]> = {};
    error.errors.forEach((err) => {
      const path = err.path.join('.');
      if (!details[path]) {
        details[path] = [];
      }
      details[path].push(err.message);
    });

    res.status(400).json({
      success: false,
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Invalid input data',
        details,
      },
    });
    return;
  }

  // Handle MongoDB duplicate key error
  if (error instanceof mongoose.mongo.MongoServerError && error.code === 11000) {
    const field = Object.keys((error as any).keyPattern)[0];
    res.status(409).json({
      success: false,
      error: {
        code: 'DUPLICATE_ENTRY',
        message: `${field} already exists`,
        details: { [field]: ['Value already in use'] },
      },
    });
    return;
  }

  // Handle MongoDB validation errors
  if (error instanceof mongoose.Error.ValidationError) {
    const details: Record<string, string[]> = {};
    Object.entries(error.errors).forEach(([field, err]) => {
      details[field] = [err.message];
    });

    res.status(400).json({
      success: false,
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Database validation failed',
        details,
      },
    });
    return;
  }

  // Handle MongoDB cast errors (invalid ObjectId, etc.)
  if (error instanceof mongoose.Error.CastError) {
    res.status(400).json({
      success: false,
      error: {
        code: 'INVALID_ID',
        message: `Invalid ${error.path}: ${error.value}`,
      },
    });
    return;
  }

  // Default error response
  res.status(500).json({
    success: false,
    error: {
      code: 'INTERNAL_ERROR',
      message: process.env.NODE_ENV === 'production' 
        ? 'An unexpected error occurred' 
        : error.message,
    },
  });
}

export function notFoundHandler(req: Request, res: Response): void {
  res.status(404).json({
    success: false,
    error: {
      code: 'NOT_FOUND',
      message: `Route ${req.method} ${req.path} not found`,
    },
  });
}
