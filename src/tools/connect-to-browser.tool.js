const { z } = require('zod');
const puppeteer = require('puppeteer');

const { CONFIG } = require('../config');

export const registerConnectToBrowserTool = (server) => {
  // Connect to existing browser
  server.registerTool(
    'connectToBrowser',
    {
      title: 'Connect to Browser',
      description: 'Connects to an existing browser instance running in debug mode',
      inputSchema: {
        debugPort: z.number().default(CONFIG.debugPort).describe('The debugging port of the browser'),
        structurizrPort: z.number().default(CONFIG.structurizrPort).describe('The port Structurizr is running on')
      }
    },
    async ({ debugPort = CONFIG.debugPort, structurizrPort = CONFIG.structurizrPort }) => {
      try {
        const browser = await puppeteer.connect({
          browserURL: `http://localhost:${debugPort}`,
          defaultViewport: null
        });
        
        const pages = await browser.pages();
        if (pages.length === 0) {
          return {
            content: [{
              type: "text",
              text: "No pages found in the browser"
            }]
          };
        }
        
        // Find Structurizr page with customizable port
        const structurizrPage = pages.find(page => page.url().includes(`localhost:${structurizrPort}`));
        if (!structurizrPage) {
          const availablePages = await Promise.all(pages.map(p => p.url()));
          return {
            content: [{
              type: "text",
              text: `Structurizr page not found on port ${structurizrPort}\nAvailable pages: ${availablePages.join(', ')}`
            }]
          };
        }
        
        // Listen for console logs
        structurizrPage.on('console', message => {
          if (message.type() === 'error' && message.text().includes('workspace.dsl')) {
            processDslError(message.text());
          }
        });
        
        return {
          content: [{
            type: "text",
            text: `Connected to Structurizr page at ${await structurizrPage.url()}\nNote: Error monitoring has been set up for DSL errors`
          }]
        };
      } catch (error) {
        console.error('Error connecting to browser:', error);
        return {
          content: [{
            type: "text",
            text: `Failed to connect to browser: ${error.message}`
          }]
        };
      }
    }
  );
}