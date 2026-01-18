import 'dotenv/config';
import { startServer } from './app.js';
import { startScheduler } from './services/scheduler.js';

startServer();
startScheduler();
