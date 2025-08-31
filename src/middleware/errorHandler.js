const logger = require('../config/logger');

// Custom error classes - Keep these simple
class AppError extends Error {
  constructor(message, statusCode = 500) {
    super(message);
    this.statusCode = statusCode;
    this.isOperational = true;
  }
}

class ValidationError extends AppError {
  constructor(message) { super(message, 400); }
}

class NotFoundError extends AppError {
  constructor(message = 'Resource not found') { super(message, 404); }
}

class DatabaseError extends AppError {
  constructor(message) { super(message, 500); }
}

// Error code mappings - Much simpler
const ERROR_MAPPINGS = {
  // PostgreSQL errors
  '23505': { status: 400, message: 'Duplicate entry already exists' },
  '23503': { status: 400, message: 'Referenced record does not exist' },
  '23514': { status: 400, message: 'Data validation failed' },
  '22001': { status: 400, message: 'Data too long for field' },
  '22007': { status: 400, message: 'Invalid date/time format' },
  
  // File system errors
  'ENOENT': { status: 404, message: 'File not found' },
  'EACCES': { status: 403, message: 'Access denied' },
  
  // Multer errors
  'LIMIT_FILE_SIZE': { status: 400, message: 'File too large' },
  'LIMIT_UNEXPECTED_FILE': { status: 400, message: 'Unexpected file field' }
};

// Main error handler - Much cleaner
const errorHandler = (err, req, res, next) => {
  // Log the error
  logger.error('Error occurred:', {
    message: err.message,
    stack: process.env.NODE_ENV === 'development' ? err.stack : undefined,
    url: req.url,
    method: req.method,
    ip: req.ip
  });

  // Handle known errors
  const mapping = ERROR_MAPPINGS[err.code] || ERROR_MAPPINGS[err.name];
  if (mapping) {
    return res.status(mapping.status).json({
      success: false,
      error: mapping.message
    });
  }

  // Handle custom app errors
  if (err.isOperational) {
    return res.status(err.statusCode).json({
      success: false,
      error: err.message
    });
  }

  // Handle validation errors with details
  if (err.details) {
    return res.status(400).json({
      success: false,
      error: 'Validation failed',
      details: err.details
    });
  }

  // Default server error
  res.status(500).json({
    success: false,
    error: process.env.NODE_ENV === 'production' 
      ? 'Internal server error' 
      : err.message,
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
  });
};

// 404 handler
const notFound = (req, res, next) => {
  next(new NotFoundError(`Route ${req.originalUrl} not found`));
};

// Async wrapper 
const asyncHandler = (fn) => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};

module.exports = {
  errorHandler,
  notFound,
  asyncHandler,
  AppError,
  ValidationError,
  NotFoundError,
  DatabaseError
};