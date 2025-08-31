const HistoricalEvent = require('../models/HistoricalEvent');
const InsightsService = require('../services/InsightsService');
const EventRepository = require('../repositories/EventRepository');
const { asyncHandler, ValidationError } = require('../middleware/errorHandler');
const { ERROR_MESSAGES } = require('../config/constants');
const logger = require('../config/logger');
const QUERIES = require('../config/queries');

// GET /api/insights/overlapping-events
const getOverlappingEvents = asyncHandler(async (req, res) => {
  const { startDate, endDate } = req.query;
  
  // Use default date range if not provided (last 30 days)
  const defaultEndDate = new Date();
  const defaultStartDate = new Date();
  defaultStartDate.setDate(defaultStartDate.getDate() - 30);
  
  const searchStartDate = startDate ? new Date(startDate) : defaultStartDate;
  const searchEndDate = endDate ? new Date(endDate) : defaultEndDate;
  
  if (searchEndDate <= searchStartDate) {
    throw new ValidationError('endDate must be after startDate');
  }
  
  logger.info(`Finding overlapping events between ${searchStartDate} and ${searchEndDate}`);
  
  const overlappingEvents = await InsightsService.findOverlappingEvents(
    searchStartDate, 
    searchEndDate
  );
  
  res.json(overlappingEvents);
});

// GET /api/insights/temporal-gaps
const getTemporalGaps = asyncHandler(async (req, res) => {
  const { startDate, endDate } = req.query;
  
  const searchStartDate = new Date(startDate);
  const searchEndDate = new Date(endDate);
  
  logger.info(`Finding temporal gaps between ${searchStartDate} and ${searchEndDate}`);
  
  const largestGap = await InsightsService.findTemporalGaps(
    searchStartDate, 
    searchEndDate
  );
  
  if (!largestGap) {
    return res.json({
      largestGap: null,
      message: 'No significant temporal gaps found within the specified range, or too few events.'
    });
  }
  
  res.json({
    largestGap,
    message: 'Largest temporal gap identified.'
  });
});

// GET /api/insights/event-influence
const getEventInfluence = asyncHandler(async (req, res) => {
  const { sourceEventId, targetEventId } = req.query;
  
  logger.info(`Finding shortest path from ${sourceEventId} to ${targetEventId}`);
  
  // Check if both events exist
  const [sourceEvent, targetEvent] = await Promise.all([
    EventRepository.findById(sourceEventId),
    EventRepository.findById(targetEventId)
  ]);
  
  if (!sourceEvent) {
    throw new ValidationError(`${ERROR_MESSAGES.EVENT_NOT_FOUND}: source ${sourceEventId}`);
  }
  
  if (!targetEvent) {
    throw new ValidationError(`${ERROR_MESSAGES.EVENT_NOT_FOUND}: target ${targetEventId}`);
  }
  
  const pathResult = await InsightsService.findEventInfluence(sourceEventId, targetEventId);
  
  if (!pathResult) {
    return res.json({
      sourceEventId,
      targetEventId,
      shortestPath: [],
      totalDurationMinutes: 0,
      message: 'No temporal path found from source to target event.'
    });
  }
  
  res.json({
    sourceEventId,
    targetEventId,
    shortestPath: pathResult.shortestPath,
    totalDurationMinutes: pathResult.totalDurationMinutes,
    message: 'Shortest temporal path found from source to target event.'
  });
});

// GET /api/insights/event-statistics (bonus endpoint)
const getEventStatistics = asyncHandler(async (req, res) => {
  const { startDate, endDate } = req.query;
  
  // Use default date range if not provided (last 30 days)
  const defaultEndDate = new Date();
  const defaultStartDate = new Date();
  defaultStartDate.setDate(defaultStartDate.getDate() - 30);
  
  const searchStartDate = startDate ? new Date(startDate) : defaultStartDate;
  const searchEndDate = endDate ? new Date(endDate) : defaultEndDate;
  
  logger.info(`Calculating event statistics between ${searchStartDate} and ${searchEndDate}`);
  
  const statistics = await InsightsService.getEventStatistics(searchStartDate, searchEndDate);
  
  res.json({
    dateRange: {
      startDate: searchStartDate,
      endDate: searchEndDate
    },
    statistics
  });
});

// GET /api/insights/hierarchy-analysis (bonus endpoint)
const getHierarchyAnalysis = asyncHandler(async (req, res) => {
  const { rootEventId } = req.query;
  
  if (!rootEventId) {
    throw new ValidationError('rootEventId is required');
  }
  
  logger.info(`Analyzing hierarchy for root event: ${rootEventId}`);
  
  // Check if root event exists
  const rootEvent = await HistoricalEvent.findById(rootEventId);
  if (!rootEvent) {
    throw new ValidationError(`Root event with ID ${rootEventId} not found`);
  }
  
  // Get hierarchy analysis
  const pool = require('../config/database');
  const result = await pool.query(QUERIES.INSIGHTS.HIERARCHY_ANALYSIS, [rootEventId]);
  const analysis = result.rows[0];
  
  res.json({
    rootEventId,
    rootEventName: rootEvent.event_name,
    hierarchyAnalysis: {
      totalEvents: parseInt(analysis.total_events) || 0,
      maxDepth: parseInt(analysis.max_depth) || 0,
      averageDurationMinutes: Math.round(parseFloat(analysis.avg_duration) || 0),
      totalDurationMinutes: parseInt(analysis.total_duration) || 0,
      levelDistribution: {
        root: parseInt(analysis.root_count) || 0,
        level1: parseInt(analysis.level_1_count) || 0,
        level2: parseInt(analysis.level_2_count) || 0,
        level3Plus: parseInt(analysis.level_3_plus_count) || 0
      }
    }
  });
});

module.exports = {
  getOverlappingEvents,
  getTemporalGaps,
  getEventInfluence,
  getEventStatistics,
  getHierarchyAnalysis
};
