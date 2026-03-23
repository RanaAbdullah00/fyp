import { setupWorker } from 'msw';
import { handlers } from './handlers.js';

// MSW worker for development
export const worker = setupWorker(...handlers);

