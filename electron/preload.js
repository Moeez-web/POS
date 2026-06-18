const { contextBridge } = require('electron');

// Pass the API base URL (with its dynamic port) to the Angular app.
const arg = process.argv.find((a) => a.startsWith('--pos-api-base='));
const apiBase = arg ? arg.split('=')[1] : 'http://localhost:4317/api';

contextBridge.exposeInMainWorld('POS_API_BASE', apiBase);
