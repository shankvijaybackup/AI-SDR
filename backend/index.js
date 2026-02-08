import dotenv from 'dotenv';
// Force rebuild 2026-02-09
import path from 'path';

// Force load .env before anything else
dotenv.config({ path: path.resolve(process.cwd(), '.env') });

console.log('[Startup] Environment variables loaded');
console.log('[Startup] TWILIO_ACCOUNT_SID present:', !!process.env.TWILIO_ACCOUNT_SID);
console.log('[Startup] OPENAI_API_KEY present:', !!process.env.OPENAI_API_KEY);

// Now import the server which imports other modules
import('./server.js');
