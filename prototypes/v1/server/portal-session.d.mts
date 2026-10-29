import type {Plugin} from 'vite';
import type {IncomingMessage, ServerResponse} from 'node:http';
export function portalSessionPlugin(): Plugin;
export type PortalCustomer = {id: string; label: string; customerId: string; apiOrigin: string; tokenFile: string; operatorTokenFile?: string; championTokenFile?: string};
export type PortalPersona = {id: string; name: string; role: 'operator' | 'champion' | 'developer'; title: string; customers: string[]};
export type PortalDirectory = {customers: Required<PortalCustomer>[]; personas: PortalPersona[]};
export function loadDirectory(env?: Record<string, string | undefined>): PortalDirectory;
export function createPortalSession(options: {directory: PortalDirectory; now?: () => number; fetchImpl?: typeof fetch;
  secret?: string | null; secure?: boolean; room?: ((req: IncomingMessage) => string | null) | null}):
  (req: IncomingMessage, res: ServerResponse, next: () => void) => Promise<void>;
