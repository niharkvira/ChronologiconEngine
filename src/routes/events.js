const express = require('express');
const router = express.Router();

// Import controllers
const { ingestEvents, getIngestionStatus } = require('../controllers/ingestionController');
const { getTimeline } = require('../controllers/timelineController');
const { 
  searchEvents, 
  getEvent, 
  createEvent, 
  updateEvent, 
  deleteEvent, 
  listEvents 
} = require('../controllers/eventCrudController');

const {
  validateIngestFile,
  validateSearchEvents,
  validateTimelineParams,
  validateJobStatusParams,
  validateCreateEvent,
  validateUpdateEvent
} = require('../middleware/validation');

// File ingestion routes
router.post('/ingest', validateIngestFile, ingestEvents);
router.get('/ingestion-status/:jobId', validateJobStatusParams, getIngestionStatus);

// Timeline route
router.get('/timeline/:rootEventId', validateTimelineParams, getTimeline);

// Search route
router.get('/search', validateSearchEvents, searchEvents);

// CRUD routes for events (bonus functionality)
router.get('/', listEvents); // List all events with pagination
router.post('/', validateCreateEvent, createEvent); // Create new event
router.get('/:eventId', getEvent); // Get single event
router.put('/:eventId', validateUpdateEvent, updateEvent); // Update event
router.delete('/:eventId', deleteEvent); // Delete event

module.exports = router;
