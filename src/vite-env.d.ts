/// <reference types="vite/client" />

import type { DesktopBridge } from './platform/types';

declare global {
  interface Window {
    desktop?: DesktopBridge;
  }
}

export {};
