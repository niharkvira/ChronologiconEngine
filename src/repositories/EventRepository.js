const pool = require('../config/database');
const { API } = require('../config/constants');
const QUERIES = require('../config/queries');
const { replaceQueryPlaceholders, buildWhereClause, buildUpdateClause, buildBatchInsertPlaceholders } = require('../utils/queryBuilder');

/**
 * Repository Pattern for HistoricalEvent data access
 * Encapsulates all database operations for events
 */
class EventRepository {

  static async findById(eventId) {
    const result = await pool.query(QUERIES.EVENT.FIND_BY_ID, [eventId]);
    return result.rows[0] || null;
  }

  static async findAll(limit = API.DEFAULT_PAGE_SIZE, offset = 0) {
    const result = await pool.query(QUERIES.EVENT.FIND_ALL, [limit, offset]);
    return result.rows;
  }

  static async search(filters = {}) {
    const { whereClause, values, paramCount } = buildWhereClause(filters);
    
    // Main query
    const sortBy = filters.sortBy || API.DEFAULT_SORT_BY;
    const sortOrder = filters.sortOrder === 'desc' ? 'DESC' : 'ASC';
    const limit = Math.min(filters.limit || API.DEFAULT_PAGE_SIZE, API.MAX_PAGE_SIZE);
    const offset = ((filters.page || 1) - 1) * limit;
    
    const query = replaceQueryPlaceholders(QUERIES.EVENT.SEARCH, {
      WHERE_CLAUSE: whereClause,
      SORT_BY: sortBy,
      SORT_ORDER: sortOrder,
      LIMIT_PARAM: `$${paramCount + 1}`,
      OFFSET_PARAM: `$${paramCount + 2}`
    });
    
    values.push(limit, offset);
    const result = await pool.query(query, values);
    
    // Count query
    const countQuery = replaceQueryPlaceholders(QUERIES.EVENT.COUNT, {
      WHERE_CLAUSE: whereClause
    });
    const countResult = await pool.query(countQuery, values.slice(0, paramCount));
    const totalEvents = parseInt(countResult.rows[0].count);

    return {
      events: result.rows,
      totalEvents,
      page: filters.page || 1,
      limit
    };
  }

 
  static async getTimelineHierarchy(rootEventId) {
    const result = await pool.query(QUERIES.EVENT.GET_TIMELINE_HIERARCHY, [rootEventId]);
    return result.rows;
  }

  static async create(eventData) {
    const values = [
      eventData.event_id,
      eventData.event_name,
      eventData.description,
      eventData.start_date,
      eventData.end_date,
      eventData.parent_event_id,
      JSON.stringify(eventData.metadata)
    ];

    const result = await pool.query(QUERIES.EVENT.CREATE, values);
    return result.rows[0];
  }

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
    
    const query = replaceQueryPlaceholders(QUERIES.EVENT.BATCH_INSERT, {
      PLACEHOLDERS: placeholders
    });
    
    const result = await pool.query(query, values);
    return result.rows;
  }

  static async update(eventId, updates) {
    const { fields, values, paramCount } = buildUpdateClause(updates);
    values.push(eventId);

    const query = replaceQueryPlaceholders(QUERIES.EVENT.UPDATE, {
      FIELDS: fields,
      PARAM_COUNT: `$${paramCount + 1}`
    });

    const result = await pool.query(query, values);
    return result.rows[0];
  }

  static async deleteById(eventId) {
    const result = await pool.query(QUERIES.EVENT.DELETE_BY_ID, [eventId]);
    return result.rows[0] || null;
  }


}

module.exports = EventRepository;
