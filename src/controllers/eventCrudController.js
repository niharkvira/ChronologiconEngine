const EventRepository = require('../repositories/EventRepository');
const EventFactory = require('../factories/EventFactory');
const { asyncHandler, NotFoundError, ValidationError } = require('../middleware/errorHandler');
const { ERROR_MESSAGES } = require('../config/constants');
const logger = require('../config/logger');

// GET /api/events/search
const searchEvents = asyncHandler(async (req, res) => {
  const filters = req.query;
  
  logger.info('Searching events with filters:', filters);
  
  const result = await EventRepository.search(filters);
  
  res.json(result);
});

// GET /api/events/:eventId
const getEvent = asyncHandler(async (req, res) => {
  const { eventId } = req.params;
  
  const event = await EventRepository.findById(eventId);
  
  if (!event) {
    throw new NotFoundError(`${ERROR_MESSAGES.EVENT_NOT_FOUND}: ${eventId}`);
  }
  
  res.json(event);
});

// POST /api/events
const createEvent = asyncHandler(async (req, res) => {
  const eventData = req.body;
  
  // Check if parent event exists (if specified)
  if (eventData.parent_event_id) {
    const parentEvent = await EventRepository.findById(eventData.parent_event_id);
    if (!parentEvent) {
      throw new ValidationError(`${ERROR_MESSAGES.EVENT_NOT_FOUND}: parent ${eventData.parent_event_id}`);
    }
  }
  
  const event = EventFactory.createFromRawData(eventData);
  const savedEvent = await EventRepository.create(event);
  
  logger.info(`Created new event: ${savedEvent.event_id}`);
  
  res.status(201).json(savedEvent);
});

// PUT /api/events/:eventId
const updateEvent = asyncHandler(async (req, res) => {
  const { eventId } = req.params;
  const updates = req.body;
  
  const event = await EventRepository.findById(eventId);
  if (!event) {
    throw new NotFoundError(`${ERROR_MESSAGES.EVENT_NOT_FOUND}: ${eventId}`);
  }
  
  // Check if parent event exists (if being updated)
  if (updates.parent_event_id && updates.parent_event_id !== event.parent_event_id) {
    const parentEvent = await EventRepository.findById(updates.parent_event_id);
    if (!parentEvent) {
      throw new ValidationError(`${ERROR_MESSAGES.EVENT_NOT_FOUND}: parent ${updates.parent_event_id}`);
    }
  }
  
  const updatedEvent = await EventRepository.update(eventId, updates);
  
  logger.info(`Updated event: ${eventId}`);
  
  res.json(updatedEvent);
});

// DELETE /api/events/:eventId
const deleteEvent = asyncHandler(async (req, res) => {
  const { eventId } = req.params;
  
  const deletedEvent = await EventRepository.deleteById(eventId);
  
  if (!deletedEvent) {
    throw new NotFoundError(`${ERROR_MESSAGES.EVENT_NOT_FOUND}: ${eventId}`);
  }
  
  logger.info(`Deleted event: ${eventId}`);
  
  res.json({
    message: 'Event deleted successfully',
    deletedEvent
  });
});

// GET /api/events
const listEvents = asyncHandler(async (req, res) => {
  const page = parseInt(req.query.page) || 1;
  const limit = Math.min(parseInt(req.query.limit) || 10, 100);
  const offset = (page - 1) * limit;
  
  const events = await EventRepository.findAll(limit, offset);
  
  res.json({
    events,
    page,
    limit,
    hasMore: events.length === limit
  });
});

module.exports = {
  searchEvents,
  getEvent,
  createEvent,
  updateEvent,
  deleteEvent,
  listEvents
};
