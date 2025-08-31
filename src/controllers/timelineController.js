const HistoricalEvent = require('../models/HistoricalEvent');
const EventRepository = require('../repositories/EventRepository');
const { asyncHandler, NotFoundError } = require('../middleware/errorHandler');
const { ERROR_MESSAGES } = require('../config/constants');

// GET /api/timeline/:rootEventId
const getTimeline = asyncHandler(async (req, res) => {
  const { rootEventId } = req.params;
  
  // First check if the event exists
  const rootEvent = await EventRepository.findById(rootEventId);
  if (!rootEvent) {
    throw new NotFoundError(`${ERROR_MESSAGES.EVENT_NOT_FOUND}: ${rootEventId}`);
  }
  
  // Get the complete hierarchy
  const hierarchyData = await EventRepository.getTimelineHierarchy(rootEventId);
  const timeline = HistoricalEvent.buildHierarchy(hierarchyData);
  
  if (!timeline) {
    throw new NotFoundError(`Timeline for event ${rootEventId} not found`);
  }
  
  res.json(timeline);
});

module.exports = {
  getTimeline
};
