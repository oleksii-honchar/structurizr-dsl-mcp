#!/usr/bin/env node

/**
 * Simplified Structurizr DSL Debugger
 *
 * A lightweight MCP server with shorter tool names and simpler implementation
 * to resolve issues with Cursor integration.
 */

const { McpServer } = require('@modelcontextprotocol/sdk/server/mcp.js');
const { StdioServerTransport } = require('@modelcontextprotocol/sdk/server/stdio.js');
const fs = require('fs');
const path = require('path');
const { z } = require('zod');
const puppeteer = require('puppeteer');

// Configuration
const CONFIG = {
  logDir: path.join(__dirname, 'logs'),
  errorFile: path.join(__dirname, 'logs', 'structurizr-dsl-errors.json'),
  port: 8080
};

// Ensure log directory exists
if (!fs.existsSync(CONFIG.logDir)) {
  fs.mkdirSync(CONFIG.logDir, { recursive: true });
}

// Initialize empty errors file if it doesn't exist
if (!fs.existsSync(CONFIG.errorFile)) {
  fs.writeFileSync(CONFIG.errorFile, '[]', 'utf-8');
}

// Set up the simplified MCP server
const mcp = new McpServer({
  name: 'dsl-debug',
  version: '1.0.0',
  description: 'Simple Structurizr DSL debugger'
});

// Function to process DSL errors
function processDslError(errorText) {
  console.log(`Processing DSL error: ${errorText}`);
  
  try {
    // Extract information from error message
    const lineMatch = errorText.match(/at line (\d+) of ([^:]+):/);
    const contextMatch = errorText.match(/: ([^:]+)$/);
    const messageMatch = errorText.match(/workspace\.dsl: ([^(]+)/);
    
    if (!lineMatch || !contextMatch || !messageMatch) {
      console.log('Could not parse error message. Invalid format.');
      return null;
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
    
    // Append to log file
    const errors = JSON.parse(fs.readFileSync(CONFIG.errorFile, 'utf-8'));
    errors.push(error);
    fs.writeFileSync(CONFIG.errorFile, JSON.stringify(errors, null, 2), 'utf-8');
    
    console.log('DSL error processed and saved');
    return error;
  } catch (err) {
    console.error('Error processing DSL error:', err);
    return null;
  }
}

// Connect to browser tool
mcp.tool(
  'connect',
  {
    port: z.number().default(9222).describe('Debug port')
  },
  async ({ port = 9222 }) => {
    try {
      // Connect to browser
      const browser = await puppeteer.connect({
        browserURL: `http://localhost:${port}`,
        defaultViewport: null
      });
      
      const pages = await browser.pages();
      
      // Find Structurizr page
      const structurizrPage = pages.find(p => 
        p.url().includes(`localhost:${CONFIG.port}`)
      );
      
      if (!structurizrPage) {
        return { 
          error: `No Structurizr page found on port ${CONFIG.port}`
        };
      }
      
      // Set up error listener
      structurizrPage.on('console', message => {
        if (message.type() === 'error' && message.text().includes('workspace.dsl')) {
          processDslError(message.text());
        }
      });
      
      return {
        message: `Connected to Structurizr page at ${await structurizrPage.url()}`
      };
    } catch (error) {
      console.error('Error connecting to browser:', error);
      return {
        error: `Failed to connect: ${error.message}`
      };
    }
  }
);

// Get errors tool
mcp.tool(
  'errors',
  {
    count: z.number().default(5).describe('Number of errors to retrieve')
  },
  async ({ count = 5 }) => {
    try {
      // Read errors from file
      const errors = JSON.parse(fs.readFileSync(CONFIG.errorFile, 'utf-8'));
      return {
        errors: errors.slice(-count)
      };
    } catch (error) {
      console.error('Error getting DSL errors:', error);
      return {
        error: `Failed to get errors: ${error.message}`
      };
    }
  }
);

// Fix error tool
mcp.tool(
  'fix',
  {
    line: z.number().describe('Line number to fix'),
    solution: z.string().describe('Suggested fix')
  },
  async ({ line, solution }) => {
    return {
      message: `Fix for line ${line}: ${solution}`
    };
  }
);

// Connect MCP server via stdio
const transport = new StdioServerTransport();
mcp.connect(transport);
console.log('Simplified DSL Debugger MCP Server running');

// Process error if found in structurizr
const dslError = "workspace.dsl: Unexpected tokens (expected: include, exclude, autolayout, default, animation, title, description, properties) at line 776 of /usr/local/structurizr/workspace.dsl: dynamic \"ErrorHandlingFlow\" {";
processDslError(dslError); 