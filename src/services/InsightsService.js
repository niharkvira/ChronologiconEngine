const HistoricalEvent = require('../models/HistoricalEvent');
const pool = require('../config/database');
const QUERIES = require('../config/queries');

/**
 * Service for handling insights and analytics operations
 */
class InsightsService {

  static async findOverlappingEvents(startDate, endDate) {
    return await HistoricalEvent.findOverlappingEvents(startDate, endDate);
  }

  static async findTemporalGaps(startDate, endDate) {
    return await HistoricalEvent.findTemporalGaps(startDate, endDate);
  }


  static async findEventInfluence(sourceEventId, targetEventId) {
    return await HistoricalEvent.findShortestPath(sourceEventId, targetEventId);
  }

  static async getEventStatistics(startDate, endDate) {
    const result = await pool.query(QUERIES.INSIGHTS.EVENT_STATISTICS, [startDate, endDate]);
    const stats = result.rows[0];
    
    // Calculate time span
    const timeSpanMinutes = stats.earliest_event && stats.latest_event 
      ? Math.round((new Date(stats.latest_event) - new Date(stats.earliest_event)) / (1000 * 60))
      : 0;
    
    return {
      totalEvents: parseInt(stats.total_events) || 0,
      rootEvents: parseInt(stats.root_events) || 0,
      childEvents: parseInt(stats.child_events) || 0,
      averageDurationMinutes: Math.round(parseFloat(stats.avg_duration_minutes) || 0),
      minDurationMinutes: parseInt(stats.min_duration_minutes) || 0,
      maxDurationMinutes: parseInt(stats.max_duration_minutes) || 0,
      maxHierarchyDepth: parseInt(stats.max_hierarchy_depth) || 0,
      averageHierarchyDepth: Math.round(parseFloat(stats.avg_hierarchy_depth) || 0),
      timeSpanMinutes,
      earliestEvent: stats.earliest_event,
      latestEvent: stats.latest_event
    };
  }
}

module.exports = InsightsService;
