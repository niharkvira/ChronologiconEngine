const express = require('express');
const router = express.Router();

// Import route modules
const eventRoutes = require('./events');
const insightRoutes = require('./insights');
const { getTimeline } = require('../controllers/timelineController');
const { validateTimelineParams } = require('../middleware/validation');

// Health check endpoint
router.get('/health', (req, res) => {
  res.json({
    status: 'OK',
    timestamp: new Date().toISOString(),
    service: 'Chronologicon Engine',
    version: '1.0.0'
  });
});

// API info endpoint
router.get('/', (req, res) => {
  res.json({
    service: 'Chronologicon Engine API',
    version: '1.0.0',
    description: 'A Node.js backend service to ingest, manage, and query historical event data',
    endpoints: {
      events: '/api/events',
      insights: '/api/insights',
      health: '/api/health'
    },
    documentation: 'See README.md for detailed API documentation'
  });
});

// Timeline route (as per requirements: /api/timeline/:rootEventId)
router.get('/timeline/:rootEventId', validateTimelineParams, getTimeline);

// Mount route modules
router.use('/events', eventRoutes);
router.use('/insights', insightRoutes);

module.exports = router;
