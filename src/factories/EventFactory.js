const { v4: uuidv4 } = require('uuid');
const HistoricalEvent = require('../models/HistoricalEvent');
const { VALIDATION, ERROR_MESSAGES } = require('../config/constants');

/**
 * Factory Pattern for creating HistoricalEvent instances
 * Handles validation and standardization of event creation
 */
class EventFactory {

  static createFromRawData(data) {
    const validatedData = this.validateAndNormalize(data);
    return new HistoricalEvent(validatedData);
  }


  static createFromFileLine(line, lineNumber) {
    const parsedData = this.parseFileLine(line, lineNumber);
    return this.createFromRawData(parsedData);
  }

  static validateAndNormalize(data) {
    const normalized = {
      event_id: data.event_id || uuidv4(),
      event_name: this.validateEventName(data.event_name),
      description: this.validateDescription(data.description),
      start_date: this.validateDate(data.start_date, 'start_date'),
      end_date: this.validateDate(data.end_date, 'end_date'),
      parent_event_id: this.validateParentId(data.parent_event_id),
      metadata: data.metadata || {}
    };

    // Validate date order
    if (normalized.end_date <= normalized.start_date) {
      throw new Error(ERROR_MESSAGES.END_DATE_BEFORE_START);
    }

    // Validate UUIDs
    if (!VALIDATION.UUID_REGEX.test(normalized.event_id)) {
      throw new Error(`${ERROR_MESSAGES.INVALID_UUID}: event_id`);
    }

    if (normalized.parent_event_id && !VALIDATION.UUID_REGEX.test(normalized.parent_event_id)) {
      throw new Error(`${ERROR_MESSAGES.INVALID_UUID}: parent_event_id`);
    }

    return normalized;
  }


  static parseFileLine(line, lineNumber) {
    if (!line.trim()) {
      return null;
    }

    const parts = line.split('|');
    if (parts.length !== 6) {
      throw new Error(`Line ${lineNumber}: Expected 6 fields, got ${parts.length}`);
    }

    const [eventId, eventName, startDateStr, endDateStr, parentIdStr, description] = parts;

    return {
      event_id: eventId.trim(),
      event_name: eventName.trim(),
      description: description.trim() || null,
      start_date: startDateStr.trim(),
      end_date: endDateStr.trim(),
      parent_event_id: parentIdStr.trim().toUpperCase() === 'NULL' ? null : parentIdStr.trim(),
      metadata: {
        source_line: lineNumber,
        ingested_at: new Date().toISOString()
      }
    };
  }

  static validateEventName(name) {
    if (!name || typeof name !== 'string' || !name.trim()) {
      throw new Error(`${ERROR_MESSAGES.MISSING_REQUIRED_FIELDS}: event_name`);
    }

    const trimmed = name.trim();
    if (trimmed.length > VALIDATION.MAX_EVENT_NAME_LENGTH) {
      throw new Error(`Event name too long (max ${VALIDATION.MAX_EVENT_NAME_LENGTH} characters)`);
    }

    return trimmed;
  }

  static validateDescription(description) {
    if (!description) return null;

    const trimmed = description.trim();
    if (trimmed.length > VALIDATION.MAX_DESCRIPTION_LENGTH) {
      throw new Error(`Description too long (max ${VALIDATION.MAX_DESCRIPTION_LENGTH} characters)`);
    }

    return trimmed || null;
  }

  static validateDate(date, fieldName) {
    if (!date) {
      throw new Error(`${ERROR_MESSAGES.MISSING_REQUIRED_FIELDS}: ${fieldName}`);
    }

    const dateObj = new Date(date);
    if (isNaN(dateObj.getTime())) {
      throw new Error(`${ERROR_MESSAGES.INVALID_DATE}: ${fieldName}`);
    }

    return dateObj;
  }

  static validateParentId(parentId) {
    if (!parentId || parentId.trim().toUpperCase() === 'NULL') {
      return null;
    }

    return parentId.trim();
  }

  static createBatch(dataArray) {
    return dataArray.map((data, index) => {
      try {
        return this.createFromRawData(data);
      } catch (error) {
        throw new Error(`Item ${index + 1}: ${error.message}`);
      }
    });
  }
}

module.exports = EventFactory;
