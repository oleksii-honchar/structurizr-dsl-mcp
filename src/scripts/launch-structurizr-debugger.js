#!/usr/bin/env node

/**
 * Structurizr DSL Debugger Launcher
 * 
 * This script provides a simple command-line interface to launch the 
 * Structurizr DSL Debugger with customizable options.
 */

const { spawn } = require('child_process');
const path = require('path');
const readline = require('readline');

// Parse command line arguments
const args = process.argv.slice(2);
let structurizrPort = 8080;
let autoConnect = false;

// Process arguments
for (let i = 0; i < args.length; i++) {
  if (args[i] === '--port' && i + 1 < args.length) {
    structurizrPort = parseInt(args[i + 1], 10);
    i++;
  } else if (args[i] === '--auto-connect') {
    autoConnect = true;
  } else if (args[i] === '--help') {
    showHelp();
    process.exit(0);
  }
}

function showHelp() {
  console.log(`
Structurizr DSL Debugger Launcher

Usage:
  node launch-structurizr-debugger.js [options]

Options:
  --port PORT         Specify the port where Structurizr is running (default: 8080)
  --auto-connect      Automatically connect to Chrome and find Structurizr
  --help              Show this help message

Examples:
  node launch-structurizr-debugger.js
  node launch-structurizr-debugger.js --port 9090
  node launch-structurizr-debugger.js --auto-connect
  `);
}

// Start the MCP server
console.log(`Starting Structurizr DSL Debugger (Structurizr port: ${structurizrPort})...`);

// Set environment variables
const env = { ...process.env, STRUCTURIZR_PORT: structurizrPort };

// Spawn the server process
const serverProc = spawn('node', [
  path.join(__dirname, 'structurizr-dsl-debugger-mcp.js')
], {
  env,
  stdio: ['pipe', 'inherit', 'inherit']
});

// Create interface for user input
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

// Handle server startup
serverProc.on('spawn', () => {
  console.log('Structurizr DSL Debugger MCP Server running');
  console.log('Use the following MCP tools in Cursor IDE:');
  console.log('- connectToBrowser - Connect to Chrome browser');
  console.log('- getDslErrors - Get captured DSL errors');
  console.log('- fixDslError - Get suggestions for fixing errors');
  
  // If auto-connect is enabled, try to connect to Chrome
  if (autoConnect) {
    console.log('\nAuto-connect enabled. Attempting to connect to Chrome...');
    
    // Wait a moment for the server to fully initialize
    setTimeout(() => {
      const puppeteer = require('puppeteer');
      
      (async () => {
        try {
          // Connect to the browser
          const browser = await puppeteer.connect({
            browserURL: 'http://localhost:9222',
            defaultViewport: null
          });
          
          const pages = await browser.pages();
          
          // Find Structurizr page
          const structurizrPage = pages.find(page => 
            page.url().includes(`localhost:${structurizrPort}`)
          );
          
          if (structurizrPage) {
            console.log(`Connected to Structurizr page at ${await structurizrPage.url()}`);
            console.log('Error monitoring has been set up');
            
            // Monitor for console errors
            structurizrPage.on('console', message => {
              if (message.type() === 'error' && message.text().includes('workspace.dsl')) {
                console.log(`Captured DSL error: ${message.text()}`);
              }
            });
          } else {
            console.log(`Could not find Structurizr page on port ${structurizrPort}`);
            console.log('Available pages:');
            for (const page of pages) {
              console.log(` - ${await page.url()}`);
            }
          }
        } catch (err) {
          console.error('Failed to auto-connect to Chrome:', err.message);
          console.log('You will need to use the connectToBrowser tool from Cursor manually');
        }
      })();
    }, 1000);
  }
  
  console.log('\nType "exit" to stop the server');
});

// Handle server error
serverProc.on('error', (err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});

// Handle server exit
serverProc.on('exit', (code) => {
  console.log(`Server process exited with code ${code}`);
  rl.close();
});

// Handle user input
rl.on('line', (input) => {
  if (input.toLowerCase() === 'exit') {
    console.log('Stopping server...');
    serverProc.kill();
    rl.close();
  }
});

// Clean up on exit
process.on('SIGINT', () => {
  console.log('Stopping server...');
  serverProc.kill();
  rl.close();
}); 