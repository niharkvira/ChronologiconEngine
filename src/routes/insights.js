const express = require('express');
const router = express.Router();

const {
  getOverlappingEvents,
  getTemporalGaps,
  getEventInfluence,
  getEventStatistics,
  getHierarchyAnalysis
} = require('../controllers/insightsController');

const {
  validateOverlappingEvents,
  validateTemporalGaps,
  validateEventInfluence
} = require('../middleware/validation');

// Required insights endpoints
router.get('/overlapping-events', validateOverlappingEvents, getOverlappingEvents);
router.get('/temporal-gaps', validateTemporalGaps, getTemporalGaps);
router.get('/event-influence', validateEventInfluence, getEventInfluence);

// Bonus insights endpoints
router.get('/event-statistics', getEventStatistics);
router.get('/hierarchy-analysis', getHierarchyAnalysis);

module.exports = router;
