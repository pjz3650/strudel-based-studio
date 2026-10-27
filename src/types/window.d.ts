import type { StudioBridge } from '../shared/schema';
declare global { interface Window { studio: StudioBridge; } }
export {};
