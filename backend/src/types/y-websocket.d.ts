declare module 'y-websocket/bin/utils' {
  import * as Y from 'yjs';
  import { WebSocket } from 'ws';

  export function setupWSConnection(conn: WebSocket, req: any, docName?: string): void;

  export function setPersistence(persistence: {
    bindState?: (docName: string, ydoc: Y.Doc) => Promise<void>;
    writeState?: (docName: string, ydoc: Y.Doc) => Promise<void>;
  }): void;

  export function setAuth(auth: (doc: string) => Promise<boolean>): void;
}
