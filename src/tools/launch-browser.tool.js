const { z } = require('zod');
const puppeteer = require('puppeteer');
const path = require('path');

const { CONFIG } = require('../config');

export const registerLaunchBrowserTool = (server) => {
  // Browser launch tool
  server.registerTool(
    'launchBrowser',
    {
      title: 'Launch Browser',
      description: 'Launches a browser instance for Structurizr debugging with error monitoring',
      inputSchema: {
        url: z.string().describe('The URL to navigate to').optional(),
        headless: z.boolean().default(false).describe('Whether to run the browser in headless mode'),
        structurizrPort: z.number().default(CONFIG.structurizrPort).describe('The port Structurizr is running on')
      }
    },
    async ({ url, headless = false, structurizrPort = CONFIG.structurizrPort }) => {
      try {
        // Launch browser with debugging
        const browser = await puppeteer.launch({
          headless: headless ? 'new' : false,
          args: [
            `--remote-debugging-port=${CONFIG.debugPort}`,
            `--user-data-dir=${path.join(__dirname, 'chrome-data')}`
          ]
        });
        
        // If no specific URL is provided, default to Structurizr
        if (!url || url === '') {
          url = `http://localhost:${structurizrPort}`;
        }
        
        const pages = await browser.pages();
        const page = pages[0];
        await page.goto(url, { waitUntil: 'networkidle2' });
        
        // Setup monitoring for DSL errors
        await page.evaluate(() => {
          // Monitor for error messages in the DOM
          const observer = new MutationObserver((mutations) => {
            mutations.forEach((mutation) => {
              if (mutation.type === 'childList') {
                const errorElements = document.querySelectorAll('.error');
                errorElements.forEach((errorElement) => {
                  const errorText = errorElement.textContent;
                  if (errorText && errorText.includes('workspace.dsl')) {
                    console.error('DSL Error:', errorText);
                  }
                });
              }
            });
          });
          
          // Start observing changes to the DOM
          observer.observe(document.body, { childList: true, subtree: true });
          console.log('Structurizr DSL error monitor initialized');
        });
        
        // Listen for console logs
        page.on('console', message => {
          if (message.type() === 'error' && message.text().includes('workspace.dsl')) {
            processDslError(message.text());
          }
        });
        
        return {
          content: [{
            type: "text",
            text: `Browser launched and navigated to ${url}\nNote: Error monitoring has been set up for Structurizr DSL errors`
          }]
        };
      } catch (error) {
        console.error('Error launching browser:', error);
        return {
          content: [{
            type: "text",
            text: `Failed to launch browser: ${error.message}`
          }]
        };
      }
    }
  );
}