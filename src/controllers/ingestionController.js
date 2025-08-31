const FileIngestionService = require('../services/FileIngestionService');
const CSVConverter = require('../utils/csvConverter');
const { asyncHandler, NotFoundError, ValidationError } = require('../middleware/errorHandler');
const { ERROR_MESSAGES } = require('../config/constants');
const logger = require('../config/logger');
const path = require('path');

// POST /api/events/ingest
const ingestEvents = asyncHandler(async (req, res) => {
  const { filePath } = req.body;
  
  logger.info(`Starting ingestion for file: ${filePath}`);
  
  let processFilePath = filePath;
  
  // Check if it's a CSV file and convert it
  if (path.extname(filePath).toLowerCase() === '.csv') {
    logger.info(`Detected CSV file, converting to pipe-delimited format...`);
    
    // Validate CSV format first
    const csvValidation = await CSVConverter.validateCSVFormat(filePath);
    if (!csvValidation.isValid) {
      logger.warn(`CSV validation failed for ${filePath}:`, csvValidation.errors);
      throw new ValidationError(`CSV validation failed: ${csvValidation.errors.join('; ')}`);
    }
    
    // Convert CSV to pipe-delimited format
    try {
      processFilePath = await CSVConverter.convertCSVToPipeDelimited(filePath);
      logger.info(`CSV converted successfully: ${processFilePath}`);
    } catch (error) {
      logger.error(`CSV conversion failed: ${error.message}`);
      throw new ValidationError(`CSV conversion failed: ${error.message}`);
    }
  }
  
  // Validate file before starting ingestion
  const validation = await FileIngestionService.validateFile(processFilePath);
  if (!validation.isValid) {
    logger.warn(`File validation failed for ${processFilePath}:`, validation.errors);
    throw new ValidationError(`File validation failed: ${validation.errors.join('; ')}`);
  }
  
  const jobId = await FileIngestionService.startIngestion(processFilePath);
  
  res.status(202).json({
    status: 'Ingestion initiated',
    jobId,
    message: `Check /api/events/ingestion-status/${jobId} for updates.`,
    originalFile: filePath,
    processedFile: processFilePath,
    fileType: path.extname(filePath).toLowerCase() === '.csv' ? 'CSV (converted)' : 'Pipe-delimited'
  });
});

// GET /api/events/ingestion-status/:jobId
const getIngestionStatus = asyncHandler(async (req, res) => {
  const { jobId } = req.params;
  
  const status = await FileIngestionService.getJobStatus(jobId);
  
  if (!status) {
    throw new NotFoundError(`${ERROR_MESSAGES.JOB_NOT_FOUND}: ${jobId}`);
  }
  
  res.json(status);
});

module.exports = {
  ingestEvents,
  getIngestionStatus
};
