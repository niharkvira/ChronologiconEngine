const Joi = require('joi');
const { JOB_STATUS } = require('../config/constants');

const uuidSchema = Joi.string().pattern(/^[0-9a-f-]{36}$/i).message('Must be a valid UUID format');

const dateSchema = Joi.date().iso();

// Validation schemas
const schemas = {
  // File ingestion validation
  ingestFile: Joi.object({
    filePath: Joi.string().required().min(1).max(500)
  }),

  // Search validation
  searchEvents: Joi.object({
    name: Joi.string().min(1).max(255).optional(),
    start_date_after: dateSchema.optional(),
    end_date_before: dateSchema.optional(),
    sortBy: Joi.string().valid('start_date', 'end_date', 'event_name', 'duration_minutes').default('start_date'),
    sortOrder: Joi.string().valid('asc', 'desc').default('asc'),
    page: Joi.number().integer().min(1).default(1),
    limit: Joi.number().integer().min(1).max(100).default(10)
  }),

  // Timeline validation
  timelineParams: Joi.object({
    rootEventId: uuidSchema.required()
  }),

  // Job status validation
  jobStatusParams: Joi.object({
    jobId: Joi.string().required().min(1).max(100)
  }),

  // Job status filter validation (for potential filtering endpoints)
  jobStatusFilter: Joi.object({
    status: Joi.string().valid(...Object.values(JOB_STATUS)).optional(),
    limit: Joi.number().integer().min(1).max(100).default(10),
    offset: Joi.number().integer().min(0).default(0)
  }),

  // Overlapping events validation
  overlappingEvents: Joi.object({
    startDate: dateSchema.optional(),
    endDate: dateSchema.optional()
  }),

  // Temporal gaps validation
  temporalGaps: Joi.object({
    startDate: dateSchema.required(),
    endDate: dateSchema.required()
  }).custom((value, helpers) => {
    if (new Date(value.endDate) <= new Date(value.startDate)) {
      return helpers.error('any.invalid', { message: 'endDate must be after startDate' });
    }
    return value;
  }),

  // Event influence validation
  eventInfluence: Joi.object({
    sourceEventId: uuidSchema.required(),
    targetEventId: uuidSchema.required()
  }).custom((value, helpers) => {
    if (value.sourceEventId === value.targetEventId) {
      return helpers.error('any.invalid', { message: 'sourceEventId and targetEventId must be different' });
    }
    return value;
  }),

  // Create event validation
  createEvent: Joi.object({
    event_id: uuidSchema.optional(),
    event_name: Joi.string().required().min(1).max(255),
    description: Joi.string().max(2000).allow(null, '').optional(),
    start_date: dateSchema.required(),
    end_date: dateSchema.required(),
    parent_event_id: uuidSchema.allow(null).optional(),
    metadata: Joi.object().default({})
  }).custom((value, helpers) => {
    if (new Date(value.end_date) <= new Date(value.start_date)) {
      return helpers.error('any.invalid', { message: 'end_date must be after start_date' });
    }
    return value;
  }),

  // Update event validation (all fields optional)
  updateEvent: Joi.object({
    event_name: Joi.string().min(1).max(255).optional(),
    description: Joi.string().max(2000).allow(null, '').optional(),
    start_date: dateSchema.optional(),
    end_date: dateSchema.optional(),
    parent_event_id: uuidSchema.allow(null).optional(),
    metadata: Joi.object().optional()
  }).custom((value, helpers) => {
    if (value.start_date && value.end_date && new Date(value.end_date) <= new Date(value.start_date)) {
      return helpers.error('any.invalid', { message: 'end_date must be after start_date' });
    }
    return value;
  })
};

// Validation middleware factory
const validate = (schema, source = 'body') => {
  return (req, res, next) => {
    let data;
    
    switch (source) {
      case 'body':
        data = req.body;
        break;
      case 'query':
        data = req.query;
        break;
      case 'params':
        data = req.params;
        break;
      default:
        data = req.body;
    }

    const { error, value } = schema.validate(data, {
      abortEarly: false,
      stripUnknown: true,
      convert: true
    });

    if (error) {
      const errorDetails = error.details.map(detail => ({
        field: detail.path.join('.'),
        message: detail.message,
        value: detail.context?.value
      }));

      return res.status(400).json({
        error: 'Validation failed',
        details: errorDetails
      });
    }

    // Replace the original data with validated and sanitized data
    switch (source) {
      case 'body':
        req.body = value;
        break;
      case 'query':
        req.query = value;
        break;
      case 'params':
        req.params = value;
        break;
    }

    next();
  };
};

// Export validation middleware functions
module.exports = {
  validateIngestFile: validate(schemas.ingestFile, 'body'),
  validateSearchEvents: validate(schemas.searchEvents, 'query'),
  validateTimelineParams: validate(schemas.timelineParams, 'params'),
  validateJobStatusParams: validate(schemas.jobStatusParams, 'params'),
  validateJobStatusFilter: validate(schemas.jobStatusFilter, 'query'),
  validateOverlappingEvents: validate(schemas.overlappingEvents, 'query'),
  validateTemporalGaps: validate(schemas.temporalGaps, 'query'),
  validateEventInfluence: validate(schemas.eventInfluence, 'query'),
  validateCreateEvent: validate(schemas.createEvent, 'body'),
  validateUpdateEvent: validate(schemas.updateEvent, 'body'),
  schemas
};
