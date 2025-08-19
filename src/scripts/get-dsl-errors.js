#!/usr/bin/env node

/**
 * Simple utility to display Structurizr DSL errors from the log file
 */

const fs = require('fs');
const path = require('path');

// Configuration
const LOG_FILE = path.join(__dirname, 'logs', 'structurizr-dsl-errors.json');
const OUTPUT_FILE = '/tmp/dsl-error.json';

// Read errors from log file
try {
  if (!fs.existsSync(LOG_FILE)) {
    console.error(`Error: Log file not found at ${LOG_FILE}`);
    process.exit(1);
  }

  const errors = JSON.parse(fs.readFileSync(LOG_FILE, 'utf-8'));
  
  if (errors.length === 0) {
    console.log('No DSL errors found in the log file.');
    process.exit(0);
  }

  // Get most recent error
  const latestError = errors[errors.length - 1];
  
  // Display error details
  console.log('\n=== Latest Structurizr DSL Error ===');
  console.log(`Error: ${latestError.message}`);
  console.log(`File: ${latestError.file}`);
  console.log(`Line: ${latestError.line}, Column: ${latestError.column}`);
  console.log(`Context: ${latestError.relatedInformation[0].message}`);
  console.log(`Issue: ${latestError.suggestion.issue}`);
  console.log(`Suggested Fix: ${latestError.suggestion.fix}`);
  console.log(`Timestamp: ${latestError.timestamp}`);
  
  // Save to temp file for easy access
  fs.writeFileSync(OUTPUT_FILE, JSON.stringify(latestError, null, 2), 'utf-8');
  console.log(`\nError details saved to ${OUTPUT_FILE} for easy access`);
  console.log('To copy to clipboard: cat /tmp/dsl-error.json | xclip -selection clipboard');
  
  // Also display all recent unique errors (last 3)
  console.log('\n=== Recent Unique Errors ===');
  const uniqueErrors = [];
  const seenLines = new Set();
  
  for (let i = errors.length - 1; i >= 0 && uniqueErrors.length < 3; i--) {
    const error = errors[i];
    const errorKey = `${error.file}:${error.line}:${error.message}`;
    
    if (!seenLines.has(errorKey)) {
      seenLines.add(errorKey);
      uniqueErrors.push(error);
      console.log(`\n--- Error at ${error.file}:${error.line} ---`);
      console.log(`Message: ${error.message}`);
      console.log(`Context: ${error.relatedInformation[0].message}`);
    }
  }
  
} catch (error) {
  console.error('Error processing log file:', error);
  process.exit(1);
} 