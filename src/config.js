const path = require('path');

export const CONFIG = {
  logDir: path.join(__dirname, 'logs'),
  dslLogFile: path.join(__dirname, 'logs', 'structurizr-dsl-errors.json'),
  debugPort: 9222,
  structurizrPort: process.env.STRUCTURIZR_PORT || 8080 // Default Structurizr port
};