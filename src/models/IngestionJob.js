const pool = require('../config/database');
const QUERIES = require('../config/queries');
const { replaceQueryPlaceholders, buildUpdateClause } = require('../utils/queryBuilder');
const { JOB_STATUS } = require('../config/constants');

class IngestionJob {
  constructor(data) {
    this.job_id = data.job_id;
    this.status = data.status || JOB_STATUS.PENDING;
    this.file_path = data.file_path;
    this.total_lines = data.total_lines || 0;
    this.processed_lines = data.processed_lines || 0;
    this.error_lines = data.error_lines || 0;
    this.errors = data.errors || [];
    this.start_time = data.start_time;
    this.end_time = data.end_time;
  }

  // Create a new ingestion job
  async save() {
    const values = [
      this.job_id,
      this.status,
      this.file_path,
      this.total_lines,
      this.processed_lines,
      this.error_lines,
      JSON.stringify(this.errors),
      this.start_time,
      this.end_time
    ];

    const result = await pool.query(QUERIES.INGESTION_JOB.SAVE, values);
    return result.rows[0];
  }

  // Find job by ID
  static async findById(jobId) {
    const result = await pool.query(QUERIES.INGESTION_JOB.FIND_BY_ID, [jobId]);
    return result.rows[0] || null;
  }

  // Update job status and progress
  async updateProgress(updates) {
    const { fields, values, paramCount } = buildUpdateClause(updates);
    values.push(this.job_id);

    const query = replaceQueryPlaceholders(QUERIES.INGESTION_JOB.UPDATE_PROGRESS, {
      FIELDS: fields,
      PARAM_COUNT: `$${paramCount + 1}`
    });

    const result = await pool.query(query, values);
    const updated = result.rows[0];
    
    // Update instance properties
    Object.assign(this, updated);
    
    return updated;
  }

  // Add error to job
  async addError(errorMessage) {
    this.errors.push(errorMessage);
    this.error_lines++;
    
    await this.updateProgress({
      errors: this.errors,
      error_lines: this.error_lines
    });
  }

  // Mark job as started
  async start() {
    await this.updateProgress({
      status: JOB_STATUS.PROCESSING,
      start_time: new Date()
    });
  }

  // Mark job as completed
  async complete() {
    await this.updateProgress({
      status: JOB_STATUS.COMPLETED,
      end_time: new Date()
    });
  }

  // Mark job as failed
  async fail(errorMessage) {
    if (errorMessage) {
      await this.addError(errorMessage);
    }
    
    await this.updateProgress({
      status: JOB_STATUS.FAILED,
      end_time: new Date()
    });
  }

  // Get all jobs with pagination
  static async findAll(limit = 10, offset = 0) {
    const result = await pool.query(QUERIES.INGESTION_JOB.FIND_ALL, [limit, offset]);
    return result.rows;
  }

  // Get jobs by status
  static async findByStatus(status) {
    const result = await pool.query(QUERIES.INGESTION_JOB.FIND_BY_STATUS, [status]);
    return result.rows;
  }

  // Delete old completed jobs (cleanup)
  static async deleteOldJobs(daysOld = 30) {
    const query = replaceQueryPlaceholders(QUERIES.INGESTION_JOB.DELETE_OLD_JOBS, {
      DAYS_OLD: daysOld
    });
    const result = await pool.query(query);
    return result.rows.map(row => row.job_id);
  }

  // Static method to get available status values
  static get STATUS() {
    return JOB_STATUS;
  }

  // Validate status value
  static isValidStatus(status) {
    return Object.values(JOB_STATUS).includes(status);
  }
}

module.exports = IngestionJob;
