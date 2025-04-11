#!/usr/bin/env node

/**
 * Structurizr DSL Error Capture
 * 
 * This script connects to a Chrome browser with Structurizr open,
 * captures DSL errors, and saves them for easy access.
 */

const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');
const readline = require('readline');

// Configuration
const CONFIG = {
  debugPort: 9222,
  structurizrPort: process.env.STRUCTURIZR_PORT || 8080,
  outputFile: '/tmp/dsl-error.json',
  logFile: path.join(__dirname, 'logs', 'structurizr-dsl-errors.json')
};

// Create logs directory if it doesn't exist
const logsDir = path.join(__dirname, 'logs');
if (!fs.existsSync(logsDir)) {
  fs.mkdirSync(logsDir, { recursive: true });
}

// Initialize log file if it doesn't exist
if (!fs.existsSync(CONFIG.logFile)) {
  fs.writeFileSync(CONFIG.logFile, '[]', 'utf-8');
}

// Process a DSL error
function processDslError(errorText) {
  console.log(`Processing DSL error: ${errorText}`);
  
  try {
    // Extract information from error message
    // Format: workspace.dsl: Unexpected tokens ... at line 776 of /usr/local/structurizr/workspace.dsl: dynamic "ErrorHandlingFlow" {
    const lineMatch = errorText.match(/at line (\d+) of ([^:]+):/);
    const contextMatch = errorText.match(/: ([^:]+)$/);
    const messageMatch = errorText.match(/workspace\.dsl: ([^(]+)/);
    
    if (!lineMatch || !contextMatch || !messageMatch) {
      console.log('Could not parse error message. Invalid format.');
      return;
    }
    
    const line = parseInt(lineMatch[1], 10);
    const file = lineMatch[2];
    const context = contextMatch[1].trim();
    const message = messageMatch[1].trim();
    
    // Create error object
    const error = {
      source: "Structurizr DSL",
      severity: "Error",
      message: message,
      file: file,
      line: line,
      column: 1,
      code: "dsl-syntax",
      relatedInformation: [
        {
          message: `Context: ${context}`,
          file: file,
          line: line,
          column: 1
        }
      ],
      suggestion: {
        issue: "The dynamic view syntax is incorrect. It needs a container/component identifier AND key.",
        fix: "Correct syntax: 'dynamic ContainerName ErrorHandlingFlow {'\nAlternatively: 'dynamic ComponentName ErrorHandlingFlow {'"
      },
      timestamp: new Date().toISOString()
    };
    
    // Save to output file for immediate access
    fs.writeFileSync(CONFIG.outputFile, JSON.stringify(error, null, 2), 'utf-8');
    
    // Append to log file
    const errors = JSON.parse(fs.readFileSync(CONFIG.logFile, 'utf-8'));
    errors.push(error);
    fs.writeFileSync(CONFIG.logFile, JSON.stringify(errors, null, 2), 'utf-8');
    
    console.log('DSL error processed and saved for Cursor');
    console.log(`Error details saved to ${CONFIG.outputFile} for easy access`);
    console.log('To copy to clipboard: cat /tmp/dsl-error.json | xclip -selection clipboard');
    
    return error;
  } catch (err) {
    console.error('Error processing DSL error:', err);
  }
}

// Main function
async function main() {
  console.log('Starting Structurizr DSL error capture for Cursor...');
  
  try {
    console.log(`Connecting to Chrome on port ${CONFIG.debugPort}...`);
    
    // Connect to browser
    const browser = await puppeteer.connect({
      browserURL: `http://localhost:${CONFIG.debugPort}`,
      defaultViewport: null
    });
    
    // Get all pages
    const pages = await browser.pages();
    console.log(`Found ${pages.length} pages`);
    
    for (const page of pages) {
      console.log(`Page URL: ${await page.url()}`);
    }
    
    // Find Structurizr page
    const structurizrPage = pages.find(page => 
      page.url().includes(`localhost:${CONFIG.structurizrPort}`)
    );
    
    if (!structurizrPage) {
      console.error(`Could not find Structurizr page on port ${CONFIG.structurizrPort}`);
      console.log('Available pages:');
      for (const page of pages) {
        console.log(` - ${await page.url()}`);
      }
      process.exit(1);
    }
    
    console.log(`Found Structurizr page: ${await structurizrPage.url()}`);
    
    // Set up error listener
    structurizrPage.on('console', message => {
      if (message.type() === 'error' && message.text().includes('workspace.dsl')) {
        processDslError(message.text());
      }
    });
    
    console.log('Error capture setup complete. Waiting for Structurizr DSL errors...');
    console.log('Press Ctrl+C to exit or type "refresh" to reload the page.');
    
    // Create readline interface for commands
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    });
    
    rl.on('line', async (input) => {
      if (input.toLowerCase() === 'refresh') {
        console.log('Refreshing Structurizr page...');
        await structurizrPage.reload({ waitUntil: 'networkidle2' });
        console.log('Page refreshed.');
      }
    });
    
    // Keep the process running
    process.stdin.resume();
    
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

// Start the app
main(); 