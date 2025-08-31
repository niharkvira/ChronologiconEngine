/**
 * Centralized SQL Queries for Chronologicon Engine
 * All SQL queries are defined here and imported by other modules
 */

const { JOB_STATUS } = require('./constants');

const QUERIES = {
  // ===== EVENT REPOSITORY QUERIES =====
  EVENT: {
    FIND_BY_ID: 'SELECT * FROM historical_events WHERE event_id = $1',
    
    FIND_ALL: `
      SELECT * FROM historical_events 
      ORDER BY start_date ASC 
      LIMIT $1 OFFSET $2
    `,
    
    SEARCH: `
      SELECT * FROM historical_events 
      {WHERE_CLAUSE}
      ORDER BY {SORT_BY} {SORT_ORDER}
      LIMIT ${'{LIMIT_PARAM}'} OFFSET ${'{OFFSET_PARAM}'}
    `,
    
    COUNT: 'SELECT COUNT(*) FROM historical_events {WHERE_CLAUSE}',
    
    GET_TIMELINE_HIERARCHY: `
      WITH RECURSIVE event_tree AS (
        SELECT 
          event_id, event_name, description, start_date, end_date, 
          duration_minutes, parent_event_id, metadata, 0 as level
        FROM historical_events 
        WHERE event_id = $1
        
        UNION ALL
        
        SELECT 
          he.event_id, he.event_name, he.description, he.start_date, he.end_date,
          he.duration_minutes, he.parent_event_id, he.metadata, et.level + 1
        FROM historical_events he
        JOIN event_tree et ON he.parent_event_id = et.event_id
      )
      SELECT * FROM event_tree ORDER BY level, start_date
    `,
    
    CREATE: `
      INSERT INTO historical_events (
        event_id, event_name, description, start_date, end_date, parent_event_id, metadata
      ) VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING *
    `,
    
    BATCH_INSERT: `
      INSERT INTO historical_events (
        event_id, event_name, description, start_date, end_date, parent_event_id, metadata
      ) VALUES {PLACEHOLDERS}
      RETURNING *
    `,
    
    UPDATE: `
      UPDATE historical_events 
      SET {FIELDS} 
      WHERE event_id = ${'{PARAM_COUNT}'}
      RETURNING *
    `,
    
    DELETE_BY_ID: 'DELETE FROM historical_events WHERE event_id = $1 RETURNING *'
  },

  // ===== HISTORICAL EVENT MODEL QUERIES =====
  HISTORICAL_EVENT: {
    SAVE: `
      INSERT INTO historical_events (
        event_id, event_name, description, start_date, end_date, parent_event_id, metadata
      ) VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING *
    `,
    
    FIND_BY_ID: 'SELECT * FROM historical_events WHERE event_id = $1',
    
    FIND_ALL: `
      SELECT * FROM historical_events 
      ORDER BY start_date ASC 
      LIMIT $1 OFFSET $2
    `,
    
    FIND_BY_PARENT_ID: `
      SELECT * FROM historical_events 
      WHERE parent_event_id = $1 
      ORDER BY start_date ASC
    `,
    
    FIND_ROOT_EVENTS: `
      SELECT * FROM historical_events 
      WHERE parent_event_id IS NULL 
      ORDER BY start_date ASC
    `,
    
    GET_TIMELINE_HIERARCHY: `
      WITH RECURSIVE event_tree AS (
        -- Base case: the root event
        SELECT 
          event_id, event_name, description, start_date, end_date, 
          duration_minutes, parent_event_id, metadata, 0 as level
        FROM historical_events 
        WHERE event_id = $1
        
        UNION ALL
        
        -- Recursive case: children
        SELECT 
          he.event_id, he.event_name, he.description, he.start_date, he.end_date,
          he.duration_minutes, he.parent_event_id, he.metadata, et.level + 1
        FROM historical_events he
        JOIN event_tree et ON he.parent_event_id = et.event_id
      )
      SELECT * FROM event_tree ORDER BY level, start_date
    `,
    
    SEARCH_BASE: 'SELECT * FROM historical_events WHERE 1=1',
    COUNT_BASE: 'SELECT COUNT(*) FROM historical_events WHERE 1=1',
    
    FIND_OVERLAPPING_EVENTS: `
      SELECT 
        e1.event_id as event1_id, e1.event_name as event1_name,
        e1.start_date as event1_start, e1.end_date as event1_end,
        e2.event_id as event2_id, e2.event_name as event2_name,
        e2.start_date as event2_start, e2.end_date as event2_end,
        EXTRACT(EPOCH FROM (LEAST(e1.end_date, e2.end_date) - GREATEST(e1.start_date, e2.start_date))) as overlap_duration_seconds
      FROM historical_events e1
      JOIN historical_events e2 ON e1.event_id < e2.event_id
      WHERE 
        e1.start_date < e2.end_date 
        AND e2.start_date < e1.end_date
        AND e1.start_date >= $1 
        AND e1.end_date <= $2
        AND e2.start_date >= $1 
        AND e2.end_date <= $2
      ORDER BY overlap_duration_seconds DESC
    `,
    
    FIND_TEMPORAL_GAPS: `
      WITH event_boundaries AS (
        SELECT 
          event_id,
          event_name,
          start_date,
          end_date,
          LAG(end_date) OVER (ORDER BY start_date) as prev_end_date,
          LEAD(start_date) OVER (ORDER BY start_date) as next_start_date
        FROM historical_events
        WHERE start_date >= $1 AND end_date <= $2
        ORDER BY start_date
      ),
      gaps AS (
        SELECT 
          event_id,
          event_name,
          end_date as gap_start,
          next_start_date as gap_end,
          EXTRACT(EPOCH FROM (next_start_date - end_date)) / 60 as gap_duration_minutes
        FROM event_boundaries
        WHERE next_start_date IS NOT NULL
          AND next_start_date > end_date
      )
      SELECT * FROM gaps
      WHERE gap_duration_minutes = (SELECT MAX(gap_duration_minutes) FROM gaps)
      LIMIT 1
    `,
    
    FIND_PRECEDING_EVENT: 'SELECT * FROM historical_events WHERE event_id = $1',
    
    FIND_SUCCEEDING_EVENT: `
      SELECT * FROM historical_events 
      WHERE start_date = $1 AND start_date >= $2 AND end_date <= $3
      ORDER BY start_date LIMIT 1
    `,
    
    FIND_SHORTEST_PATH: `
      WITH RECURSIVE event_paths AS (
        -- Start from source event
        SELECT 
          event_id,
          event_name,
          duration_minutes,
          parent_event_id,
          ARRAY[event_id] as path,
          duration_minutes as total_duration
        FROM historical_events 
        WHERE event_id = $1
        
        UNION ALL
        
        -- Follow parent-child relationships (both directions)
        SELECT 
          he.event_id,
          he.event_name,
          he.duration_minutes,
          he.parent_event_id,
          ep.path || he.event_id,
          ep.total_duration + he.duration_minutes
        FROM historical_events he
        JOIN event_paths ep ON (
          he.parent_event_id = ep.event_id OR 
          he.event_id = ep.parent_event_id
        )
        WHERE NOT he.event_id = ANY(ep.path) -- Prevent cycles
          AND array_length(ep.path, 1) < 20 -- Prevent infinite recursion
      )
      SELECT * FROM event_paths 
      WHERE event_id = $2
      ORDER BY total_duration ASC
      LIMIT 1
    `,
    
    GET_PATH_DETAILS: `
      SELECT event_id, event_name, duration_minutes
      FROM historical_events 
      WHERE event_id = ANY($1)
      ORDER BY array_position($1, event_id)
    `,
    
    BATCH_INSERT: `
      INSERT INTO historical_events (
        event_id, event_name, description, start_date, end_date, parent_event_id, metadata
      ) VALUES {PLACEHOLDERS}
      RETURNING *
    `,
    
    DELETE_BY_ID: 'DELETE FROM historical_events WHERE event_id = $1 RETURNING *',
    
    UPDATE: `
      UPDATE historical_events 
      SET {FIELDS} 
      WHERE event_id = ${'{PARAM_COUNT}'}
      RETURNING *
    `
  },

  // ===== INGESTION JOB QUERIES =====
  INGESTION_JOB: {
    SAVE: `
      INSERT INTO ingestion_jobs (
        job_id, status, file_path, total_lines, processed_lines, error_lines, errors, start_time, end_time
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      RETURNING *
    `,
    
    FIND_BY_ID: 'SELECT * FROM ingestion_jobs WHERE job_id = $1',
    
    UPDATE_PROGRESS: `
      UPDATE ingestion_jobs 
      SET {FIELDS} 
      WHERE job_id = ${'{PARAM_COUNT}'}
      RETURNING *
    `,
    
    FIND_ALL: `
      SELECT * FROM ingestion_jobs 
      ORDER BY created_at DESC 
      LIMIT $1 OFFSET $2
    `,
    
    FIND_BY_STATUS: `
      SELECT * FROM ingestion_jobs 
      WHERE status = $1 
      ORDER BY created_at DESC
    `,
    
    DELETE_OLD_JOBS: `
      DELETE FROM ingestion_jobs 
      WHERE status IN ('${JOB_STATUS.COMPLETED}', '${JOB_STATUS.FAILED}') 
        AND created_at < NOW() - INTERVAL '{DAYS_OLD} days'
      RETURNING job_id
    `
  },

  // ===== INSIGHTS SERVICE QUERIES =====
  INSIGHTS: {
    EVENT_STATISTICS: `
      WITH event_stats AS (
        SELECT 
          COUNT(*) as total_events,
          AVG(duration_minutes) as avg_duration_minutes,
          MIN(duration_minutes) as min_duration_minutes,
          MAX(duration_minutes) as max_duration_minutes,
          COUNT(CASE WHEN parent_event_id IS NULL THEN 1 END) as root_events,
          COUNT(CASE WHEN parent_event_id IS NOT NULL THEN 1 END) as child_events,
          MIN(start_date) as earliest_event,
          MAX(end_date) as latest_event
        FROM historical_events
        WHERE start_date >= $1 AND end_date <= $2
      ),
      hierarchy_stats AS (
        SELECT 
          MAX(depth) as max_hierarchy_depth,
          AVG(depth) as avg_hierarchy_depth
        FROM events_with_hierarchy
        WHERE start_date >= $1 AND end_date <= $2
      )
      SELECT 
        es.*,
        hs.max_hierarchy_depth,
        hs.avg_hierarchy_depth
      FROM event_stats es, hierarchy_stats hs
    `,
    
    HIERARCHY_ANALYSIS: `
      WITH RECURSIVE event_hierarchy AS (
        SELECT 
          event_id,
          event_name,
          duration_minutes,
          parent_event_id,
          0 as depth,
          ARRAY[event_id] as path,
          duration_minutes as cumulative_duration
        FROM historical_events 
        WHERE event_id = $1
        
        UNION ALL
        
        SELECT 
          he.event_id,
          he.event_name,
          he.duration_minutes,
          he.parent_event_id,
          eh.depth + 1,
          eh.path || he.event_id,
          eh.cumulative_duration + he.duration_minutes
        FROM historical_events he
        JOIN event_hierarchy eh ON he.parent_event_id = eh.event_id
      ),
      hierarchy_stats AS (
        SELECT 
          COUNT(*) as total_events,
          MAX(depth) as max_depth,
          AVG(duration_minutes) as avg_duration,
          SUM(duration_minutes) as total_duration,
          COUNT(CASE WHEN depth = 0 THEN 1 END) as root_count,
          COUNT(CASE WHEN depth = 1 THEN 1 END) as level_1_count,
          COUNT(CASE WHEN depth = 2 THEN 1 END) as level_2_count,
          COUNT(CASE WHEN depth >= 3 THEN 1 END) as level_3_plus_count
        FROM event_hierarchy
      )
      SELECT * FROM hierarchy_stats
    `
  },

  // ===== DATABASE MIGRATION QUERIES =====
  MIGRATION: {
    TEST_CONNECTION: 'SELECT NOW() as current_time',
    
    CHECK_TABLES: `
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      ORDER BY table_name
    `
  },

  // ===== FILTER CONDITIONS =====
  FILTERS: {
    NAME_LIKE: 'LOWER(event_name) LIKE LOWER($${PARAM})',
    START_DATE_AFTER: 'start_date >= $${PARAM}',
    END_DATE_BEFORE: 'end_date <= $${PARAM}'
  }
};

module.exports = QUERIES;
