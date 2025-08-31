/**
 * Query Builder Utility
 * Helps build dynamic SQL queries with parameter replacement
 */


function replaceQueryPlaceholders(query, replacements = {}) {
  let result = query;
  
  Object.keys(replacements).forEach(key => {
    const placeholder = `{${key}}`;
    result = result.replace(new RegExp(placeholder, 'g'), replacements[key]);
  });
  
  return result;
}

function buildWhereClause(filters, conditions = [], values = [], startParamCount = 0) {
  let paramCount = startParamCount;

  if (filters.name) {
    paramCount++;
    conditions.push(`LOWER(event_name) LIKE LOWER($${paramCount})`);
    values.push(`%${filters.name}%`);
  }

  if (filters.start_date_after) {
    paramCount++;
    conditions.push(`start_date >= $${paramCount}`);
    values.push(filters.start_date_after);
  }

  if (filters.end_date_before) {
    paramCount++;
    conditions.push(`end_date <= $${paramCount}`);
    values.push(filters.end_date_before);
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
  
  return { whereClause, values, paramCount };
}

function buildUpdateClause(updates, values = [], startParamCount = 0) {
  const fields = [];
  let paramCount = startParamCount;

  Object.keys(updates).forEach(key => {
    if (updates[key] !== undefined && key !== 'event_id' && key !== 'job_id') {
      paramCount++;
      fields.push(`${key} = $${paramCount}`);
      values.push(key === 'metadata' || key === 'errors' ? JSON.stringify(updates[key]) : updates[key]);
    }
  });

  if (fields.length === 0) {
    throw new Error('No fields to update');
  }

  return { fields: fields.join(', '), values, paramCount };
}

function buildBatchInsertPlaceholders(items, fieldsPerItem) {
  const placeholders = [];
  
  items.forEach((item, index) => {
    const baseIndex = index * fieldsPerItem;
    const itemPlaceholders = [];
    for (let i = 1; i <= fieldsPerItem; i++) {
      itemPlaceholders.push(`$${baseIndex + i}`);
    }
    placeholders.push(`(${itemPlaceholders.join(', ')})`);
  });
  
  return placeholders.join(', ');
}

module.exports = {
  replaceQueryPlaceholders,
  buildWhereClause,
  buildUpdateClause,
  buildBatchInsertPlaceholders
};
