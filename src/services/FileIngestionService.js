const fs = require('fs').promises;
const readline = require('readline');
const { createReadStream } = require('fs');
const { v4: uuidv4 } = require('uuid');
const HistoricalEvent = require('../models/HistoricalEvent');
const IngestionJob = require('../models/IngestionJob');
const EventFactory = require('../factories/EventFactory');
const { JOB_STATUS, ERROR_MESSAGES, FILE_PROCESSING } = require('../config/constants');
const logger = require('../config/logger');

class FileIngestionService {
  constructor() {
    if (FileIngestionService.instance) {
      return FileIngestionService.instance;
    }
    
    this.activeJobs = new Map();
    FileIngestionService.instance = this;
  }

  static getInstance() {
    if (!FileIngestionService.instance) {
      FileIngestionService.instance = new FileIngestionService();
    }
    return FileIngestionService.instance;
  }

  // Generate unique job ID
  generateJobId() {
    return `ingest-job-${Date.now()}-${uuidv4().substring(0, 8)}`;
  }

  // Start file ingestion process
  async startIngestion(filePath) {
    const jobId = this.generateJobId();
    
    try {
      // Check if file exists
      await fs.access(filePath);
      
      // Create job record
      const job = new IngestionJob({
        job_id: jobId,
        file_path: filePath,
        status: JOB_STATUS.PENDING
      });
      
      await job.save();
      
      // Start processing asynchronously
      this.processFile(jobId, filePath).catch(error => {
        logger.error(`Job ${jobId} failed:`, error);
      });
      
      return jobId;
      
    } catch (error) {
      logger.error(`Failed to start ingestion for ${filePath}:`, error);
      throw new Error(`${ERROR_MESSAGES.FILE_NOT_ACCESSIBLE}: ${filePath}`);
    }
  }

  // Process the file asynchronously
  async processFile(jobId, filePath) {
    const jobData = await IngestionJob.findById(jobId);
    if (!jobData) {
      logger.error(`Job ${jobId} not found`);
      return;
    }
    
    // Create an IngestionJob instance from the data
    const job = new IngestionJob(jobData);
    this.activeJobs.set(jobId, job);
    
    try {
      await job.start();
      logger.info(`Started processing job ${jobId} for file ${filePath}`);
      
      // Count total lines first
      const totalLines = await this.countLines(filePath);
      await job.updateProgress({ total_lines: totalLines });
      
      // Process file line by line
      await this.processLines(job, filePath);
      
      await job.complete();
      logger.info(`Completed job ${jobId}. Processed: ${job.processed_lines}, Errors: ${job.error_lines}`);
      
    } catch (error) {
      logger.error(`Job ${jobId} processing failed:`, error);
      await job.fail(`Processing failed: ${error.message}`);
    } finally {
      this.activeJobs.delete(jobId);
    }
  }

  // Count total lines in file
  async countLines(filePath) {
    return new Promise((resolve, reject) => {
      let lineCount = 0;
      const rl = readline.createInterface({
        input: createReadStream(filePath),
        crlfDelay: Infinity
      });
      
      rl.on('line', () => {
        lineCount++;
      });
      
      rl.on('close', () => {
        resolve(lineCount);
      });
      
      rl.on('error', reject);
    });
  }

  // Process file lines
  async processLines(job, filePath) {
    const batchSize = FILE_PROCESSING.DEFAULT_BATCH_SIZE;
    let batch = [];
    let lineNumber = 0;
    
    return new Promise((resolve, reject) => {
      const rl = readline.createInterface({
        input: createReadStream(filePath),
        crlfDelay: Infinity
      });
      
      rl.on('line', async (line) => {
        lineNumber++;
        
        try {
          const event = EventFactory.createFromFileLine(line, lineNumber);
          if (event) {
            batch.push(event);
          }
          
          // Process batch when it reaches batch size
          if (batch.length >= batchSize) {
            rl.pause(); // Pause reading while processing batch
            await this.processBatch(job, batch, lineNumber);
            batch = [];
            rl.resume();
          }
          
        } catch (error) {
          await job.addError(`Line ${lineNumber}: ${error.message}`);
          logger.warn(`Error parsing line ${lineNumber}: ${error.message}`);
        }
      });
      
      rl.on('close', async () => {
        try {
          // Process remaining batch
          if (batch.length > 0) {
            await this.processBatch(job, batch, lineNumber);
          }
          resolve();
        } catch (error) {
          reject(error);
        }
      });
      
      rl.on('error', reject);
    });
  }



  // Process a batch of events
  async processBatch(job, events, currentLine) {
    try {
      await HistoricalEvent.batchInsert(events);
      
      const newProcessedLines = job.processed_lines + events.length;
      await job.updateProgress({ 
        processed_lines: newProcessedLines 
      });
      
      logger.debug(`Processed batch: ${events.length} events (total: ${newProcessedLines})`);
      
    } catch (error) {
      // If batch insert fails, try individual inserts to identify problematic events
      logger.warn(`Batch insert failed, trying individual inserts: ${error.message}`);
      
      for (const event of events) {
        try {
          await event.save();
          const newProcessedLines = job.processed_lines + 1;
          await job.updateProgress({ processed_lines: newProcessedLines });
        } catch (individualError) {
          await job.addError(`Event ${event.event_id}: ${individualError.message}`);
          logger.warn(`Failed to insert event ${event.event_id}: ${individualError.message}`);
        }
      }
    }
  }

  // Get job status
  async getJobStatus(jobId) {
    const job = await IngestionJob.findById(jobId);
    if (!job) {
      return null;
    }
    
    return {
      jobId: job.job_id,
      status: job.status,
      processedLines: job.processed_lines,
      errorLines: job.error_lines,
      totalLines: job.total_lines,
      errors: job.errors,
      startTime: job.start_time,
      endTime: job.end_time
    };
  }

  // Cancel a running job
  async cancelJob(jobId) {
    const job = this.activeJobs.get(jobId);
    if (job) {
      await job.updateProgress({ status: 'CANCELLED' });
      this.activeJobs.delete(jobId);
      return true;
    }
    return false;
  }

  // Get all active jobs
  getActiveJobs() {
    return Array.from(this.activeJobs.keys());
  }

  // Parse a single line from the input file
  parseLine(line, lineNumber) {
    // Skip empty lines and comments
    if (!line.trim() || line.trim().startsWith('#')) {
      return null;
    }

    const parts = line.split('|');
    if (parts.length !== 6) {
      throw new Error(`Expected 6 fields, got ${parts.length}`);
    }

    const [eventId, eventName, startDate, endDate, parentId, description] = parts;

    // Validate UUID format
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(eventId)) {
      throw new Error(`Invalid UUID format: ${eventId}`);
    }

    // Validate parent ID if not NULL
    if (parentId !== 'NULL' && !uuidRegex.test(parentId)) {
      throw new Error(`Invalid parent UUID format: ${parentId}`);
    }

    // Validate dates
    const startDateTime = new Date(startDate);
    const endDateTime = new Date(endDate);
    
    if (isNaN(startDateTime.getTime())) {
      throw new Error(`Invalid start date format: ${startDate}`);
    }
    
    if (isNaN(endDateTime.getTime())) {
      throw new Error(`Invalid end date format: ${endDate}`);
    }
    
    if (endDateTime <= startDateTime) {
      throw new Error(`End date must be after start date`);
    }

    // Validate required fields
    if (!eventName.trim()) {
      throw new Error('Event name cannot be empty');
    }

    return {
      event_id: eventId,
      event_name: eventName,
      description: description || null,
      start_date: startDateTime.toISOString(),
      end_date: endDateTime.toISOString(),
      parent_event_id: parentId === 'NULL' ? null : parentId,
      metadata: {
        ingested_at: new Date().toISOString(),
        source_line: lineNumber
      }
    };
  }

  // Validate file format before processing
  async validateFile(filePath, maxSampleLines = 10) {
    const errors = [];
    let lineNumber = 0;
    
    return new Promise((resolve) => {
      const rl = readline.createInterface({
        input: createReadStream(filePath),
        crlfDelay: Infinity
      });
      
      rl.on('line', (line) => {
        lineNumber++;
        
        if (lineNumber > maxSampleLines) {
          rl.close();
          return;
        }
        
        try {
          this.parseLine(line, lineNumber);
        } catch (error) {
          errors.push(`Line ${lineNumber}: ${error.message}`);
        }
      });
      
      rl.on('close', () => {
        resolve({
          isValid: errors.length === 0,
          errors,
          sampledLines: lineNumber
        });
      });
      
      rl.on('error', (error) => {
        resolve({
          isValid: false,
          errors: [`File read error: ${error.message}`],
          sampledLines: 0
        });
      });
    });
  }
}

module.exports = FileIngestionService.getInstance();
