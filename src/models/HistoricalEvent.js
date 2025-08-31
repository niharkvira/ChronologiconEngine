const pool = require('../config/database');
const { v4: uuidv4 } = require('uuid');
const QUERIES = require('../config/queries');
const { replaceQueryPlaceholders, buildWhereClause, buildUpdateClause, buildBatchInsertPlaceholders } = require('../utils/queryBuilder');

class HistoricalEvent {
  constructor(data) {
    this.event_id = data.event_id || uuidv4();
    this.event_name = data.event_name;
    this.description = data.description || null;
    this.start_date = data.start_date;
    this.end_date = data.end_date;
    this.parent_event_id = data.parent_event_id || null;
    this.metadata = data.metadata || {};
  }

  // Create a new historical event
  async save() {
    const values = [
      this.event_id,
      this.event_name,
      this.description,
      this.start_date,
      this.end_date,
      this.parent_event_id,
      JSON.stringify(this.metadata)
    ];

    const result = await pool.query(QUERIES.HISTORICAL_EVENT.SAVE, values);
    return result.rows[0];
  }

  // Find event by ID
  static async findById(eventId) {
    const result = await pool.query(QUERIES.HISTORICAL_EVENT.FIND_BY_ID, [eventId]);
    return result.rows[0] || null;
  }

  // Find all events
  static async findAll(limit = 100, offset = 0) {
    const result = await pool.query(QUERIES.HISTORICAL_EVENT.FIND_ALL, [limit, offset]);
    return result.rows;
  }

  // Find events by parent ID
  static async findByParentId(parentId) {
    const result = await pool.query(QUERIES.HISTORICAL_EVENT.FIND_BY_PARENT_ID, [parentId]);
    return result.rows;
  }

  // Find root events (no parent)
  static async findRootEvents() {
    const result = await pool.query(QUERIES.HISTORICAL_EVENT.FIND_ROOT_EVENTS);
    return result.rows;
  }

  // Get complete timeline hierarchy for a root event
  static async getTimelineHierarchy(rootEventId) {
    const result = await pool.query(QUERIES.HISTORICAL_EVENT.GET_TIMELINE_HIERARCHY, [rootEventId]);
    return this.buildHierarchy(result.rows);
  }

  // Build nested hierarchy from flat array
  static buildHierarchy(events) {
    if (events.length === 0) return null;
    
    const eventMap = new Map();
    const rootEvent = events[0];
    
    // Initialize all events in the map
    events.forEach(event => {
      eventMap.set(event.event_id, {
        ...event,
        children: []
      });
    });
    
    // Build parent-child relationships
    events.forEach(event => {
      if (event.parent_event_id && eventMap.has(event.parent_event_id)) {
        const parent = eventMap.get(event.parent_event_id);
        const child = eventMap.get(event.event_id);
        parent.children.push(child);
      }
    });
    
    return eventMap.get(rootEvent.event_id);
  }

  // Search events with filters
  static async search(filters = {}) {
    const conditions = [];
    const { whereClause, values, paramCount } = buildWhereClause(filters, conditions);
    
    // Build main query
    let query = QUERIES.HISTORICAL_EVENT.SEARCH_BASE;
    if (whereClause) {
      query += ` ${whereClause.replace('WHERE', 'AND')}`;
    }

    // Sorting
    const sortBy = filters.sortBy || 'start_date';
    const sortOrder = filters.sortOrder === 'desc' ? 'DESC' : 'ASC';
    query += ` ORDER BY ${sortBy} ${sortOrder}`;

    // Pagination
    const limit = Math.min(filters.limit || 10, 100); // Max 100 results
    const offset = ((filters.page || 1) - 1) * limit;
    
    query += ` LIMIT $${paramCount + 1} OFFSET $${paramCount + 2}`;
    values.push(limit, offset);

    const result = await pool.query(query, values);
    
    // Get total count for pagination
    let countQuery = QUERIES.HISTORICAL_EVENT.COUNT_BASE;
    if (whereClause) {
      countQuery += ` ${whereClause.replace('WHERE', 'AND')}`;
    }

    const countResult = await pool.query(countQuery, values.slice(0, paramCount));
    const totalEvents = parseInt(countResult.rows[0].count);

    return {
      events: result.rows,
      totalEvents,
      page: filters.page || 1,
      limit
    };
  }

  // Find overlapping events within a date range
  static async findOverlappingEvents(startDate, endDate) {
    const result = await pool.query(QUERIES.HISTORICAL_EVENT.FIND_OVERLAPPING_EVENTS, [startDate, endDate]);
    
    return result.rows.map(row => ({
      overlappingEventPairs: [
        {
          event_id: row.event1_id,
          event_name: row.event1_name,
          start_date: row.event1_start,
          end_date: row.event1_end
        },
        {
          event_id: row.event2_id,
          event_name: row.event2_name,
          start_date: row.event2_start,
          end_date: row.event2_end
        }
      ],
      overlap_duration_minutes: Math.round(parseFloat(row.overlap_duration_seconds) / 60)
    }));
  }

  // Find temporal gaps in events
  static async findTemporalGaps(startDate, endDate) {
    const result = await pool.query(QUERIES.HISTORICAL_EVENT.FIND_TEMPORAL_GAPS, [startDate, endDate]);
    
    if (result.rows.length === 0) {
      return null;
    }
    
    const gap = result.rows[0];
    
    // Get preceding and succeeding events
    const [precedingResult, succeedingResult] = await Promise.all([
      pool.query(QUERIES.HISTORICAL_EVENT.FIND_PRECEDING_EVENT, [gap.event_id]),
      pool.query(QUERIES.HISTORICAL_EVENT.FIND_SUCCEEDING_EVENT, [gap.gap_end, startDate, endDate])
    ]);
    
    return {
      startOfGap: gap.gap_start,
      endOfGap: gap.gap_end,
      durationMinutes: Math.round(gap.gap_duration_minutes),
      precedingEvent: precedingResult.rows[0] || null,
      succeedingEvent: succeedingResult.rows[0] || null
    };
  }

  // Find shortest path between two events (for event influence)
  static async findShortestPath(sourceEventId, targetEventId) {
    // First, build the complete hierarchy to understand relationships
    const result = await pool.query(QUERIES.HISTORICAL_EVENT.FIND_SHORTEST_PATH, [sourceEventId, targetEventId]);
    
    if (result.rows.length === 0) {
      return null;
    }
    
    const pathResult = result.rows[0];
    
    // Get full details for each event in the path
    const pathEventIds = pathResult.path;
    const pathDetails = await pool.query(QUERIES.HISTORICAL_EVENT.GET_PATH_DETAILS, [pathEventIds]);
    
    return {
      shortestPath: pathDetails.rows,
      totalDurationMinutes: pathResult.total_duration
    };
  }

  // Batch insert events (for file ingestion)
  static async batchInsert(events) {
    if (events.length === 0) return [];
    
    const values = [];
    const placeholders = buildBatchInsertPlaceholders(events, 7);
    
    events.forEach((event) => {
      values.push(
        event.event_id,
        event.event_name,
        event.description,
        event.start_date,
        event.end_date,
        event.parent_event_id,
        JSON.stringify(event.metadata)
      );
    });
    
    const query = replaceQueryPlaceholders(QUERIES.HISTORICAL_EVENT.BATCH_INSERT, {
      PLACEHOLDERS: placeholders
    });
    
    const result = await pool.query(query, values);
    return result.rows;
  }

  // Delete event and all its children
  static async deleteById(eventId) {
    const result = await pool.query(QUERIES.HISTORICAL_EVENT.DELETE_BY_ID, [eventId]);
    return result.rows[0] || null;
  }

  // Update event
  async update(updates) {
    const { fields, values, paramCount } = buildUpdateClause(updates);
    values.push(this.event_id);

    const query = replaceQueryPlaceholders(QUERIES.HISTORICAL_EVENT.UPDATE, {
      FIELDS: fields,
      PARAM_COUNT: `$${paramCount + 1}`
    });

    const result = await pool.query(query, values);
    return result.rows[0];
  }
}

module.exports = HistoricalEvent;
