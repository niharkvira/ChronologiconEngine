/**
 * Application Constants
 * Centralized configuration and error messages
 */

// Job Status Constants
const JOB_STATUS = {
  PENDING: 'PENDING',
  PROCESSING: 'PROCESSING',
  COMPLETED: 'COMPLETED',
  FAILED: 'FAILED',
  CANCELLED: 'CANCELLED'
};

// Error Messages
const ERROR_MESSAGES = {
  FILE_NOT_ACCESSIBLE: 'File not accessible',
  JOB_NOT_FOUND: 'Job not found',
  INVALID_UUID: 'Invalid UUID format',
  INVALID_DATE: 'Invalid date format',
  MISSING_REQUIRED_FIELDS: 'Missing required fields',
  END_DATE_BEFORE_START: 'End date must be after start date',
  EVENT_NOT_FOUND: 'Event not found',
  VALIDATION_FAILED: 'Validation failed',
  DATABASE_ERROR: 'Database operation failed',
  DUPLICATE_ENTRY: 'Duplicate entry detected'
};

// Validation Constants
const VALIDATION = {
  UUID_REGEX: /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
  MAX_EVENT_NAME_LENGTH: 255,
  MAX_DESCRIPTION_LENGTH: 2000,
  MIN_BATCH_SIZE: 10,
  MAX_BATCH_SIZE: 1000,
  DEFAULT_BATCH_SIZE: 100
};

// File Processing Constants
const FILE_PROCESSING = {
  EXPECTED_FIELDS_COUNT: 6,
  MAX_SAMPLE_LINES: 10,
  CHUNK_SIZE: 1024 * 1024, // 1MB
  MAX_FILE_SIZE: 100 * 1024 * 1024 // 100MB
};

// API Constants
const API = {
  DEFAULT_PAGE_SIZE: 10,
  MAX_PAGE_SIZE: 100,
  DEFAULT_SORT_ORDER: 'asc',
  DEFAULT_SORT_BY: 'start_date'
};

// Database Constants
const DATABASE = {
  CONNECTION_TIMEOUT: 2000,
  IDLE_TIMEOUT: 30000,
  MAX_CONNECTIONS: 20
};

module.exports = {
  JOB_STATUS,
  ERROR_MESSAGES,
  VALIDATION,
  FILE_PROCESSING,
  API,
  DATABASE
};
