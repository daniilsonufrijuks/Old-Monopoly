import dgram from 'node:dgram';
import os from 'node:os';
import { DISCOVERY_MAGIC, DISCOVERY_PORT, PROTOCOL_VERSION, discoverySchema, isPrivateIPv4 } from '../src/multiplayer/protocol';

export interface FoundTable {
  magic: typeof DISCOVERY_MAGIC;
  version: number;
  roomCode: string;
  roomName: string;
  hostName: string;
  port: number;
  players: number;
  maxPlayers: number;
  address: string;
}

export function lanAddresses(): string[] {
  const found: string[] = [];
  for (const entries of Object.values(os.networkInterfaces())) {
    for (const entry of entries ?? []) {
      if (entry.family === 'IPv4' && !entry.internal) found.push(entry.address);
    }
  }
  return found.sort((a, b) => Number(isPrivateIPv4(b)) - Number(isPrivateIPv4(a)));
}

function directedBroadcasts(): string[] {
  const targets = new Set<string>(['255.255.255.255']);
  for (const entries of Object.values(os.networkInterfaces())) {
    for (const entry of entries ?? []) {
      if (entry.family !== 'IPv4' || entry.internal || !entry.netmask) continue;
      const ip = entry.address.split('.').map(Number);
      const mask = entry.netmask.split('.').map(Number);
      if (ip.length !== 4 || mask.length !== 4) continue;
      targets.add(ip.map((part, index) => (part | (~mask[index] & 255)) >>> 0).join('.'));
    }
  }
  return [...targets];
}

export class DiscoveryBeacon {
  private timer: NodeJS.Timeout | null = null;
  private socket: dgram.Socket | null = null;
  private info: Omit<FoundTable, 'address' | 'magic' | 'version'> | null = null;

  start(info: Omit<FoundTable, 'address' | 'magic' | 'version'>): void {
    this.info = info;
    if (this.socket) return;
    const socket = dgram.createSocket('udp4');
    this.socket = socket;
    socket.bind(0, () => {
      try {
        socket.setBroadcast(true);
      } catch {
        // Some interfaces reject broadcast; manual IP join still works.
      }
    });
    const send = () => {
      if (!this.info) return;
      const payload = Buffer.from(JSON.stringify({
        magic: DISCOVERY_MAGIC,
        version: PROTOCOL_VERSION,
        ...this.info,
      }));
      for (const target of directedBroadcasts()) {
        socket.send(payload, DISCOVERY_PORT, target, () => undefined);
      }
    };
    this.timer = setInterval(send, 1500);
    setTimeout(send, 120);
  }

  update(info: Omit<FoundTable, 'address' | 'magic' | 'version'>): void {
    this.info = info;
    if (!this.socket) this.start(info);
  }

  stop(): void {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
    this.socket?.close();
    this.socket = null;
  }
}

export class DiscoveryListener {
  private socket: dgram.Socket | null = null;

  start(onFound: (table: FoundTable) => void): Promise<void> {
    this.stop();
    const socket = dgram.createSocket({ type: 'udp4', reuseAddr: true });
    this.socket = socket;
    socket.on('message', (message, remote) => {
      try {
        const parsed = discoverySchema.safeParse(JSON.parse(message.toString()));
        if (!parsed.success) return;
        onFound({ ...parsed.data, address: remote.address });
      } catch {
        // Ignore malformed advertisements.
      }
    });
    return new Promise((resolve, reject) => {
      socket.once('error', (error: NodeJS.ErrnoException) => {
        this.stop();
        if (error.code === 'EADDRINUSE') {
          reject(new Error('Another player on this computer is already listening for tables. Join with the host IP instead.'));
          return;
        }
        reject(new Error('This computer blocked LAN discovery. Join with the host IP address.'));
      });
      socket.bind(DISCOVERY_PORT, () => {
        try {
          socket.setBroadcast(true);
        } catch {
          // Listening can still succeed without the broadcast flag.
        }
        resolve();
      });
    });
  }

  stop(): void {
    this.socket?.close();
    this.socket = null;
  }
}
