import * as mediasoup from 'mediasoup';
import type { types } from 'mediasoup';

type Router = types.Router;
type Worker = types.Worker;
type WebRtcTransport = types.WebRtcTransport;
type Producer = types.Producer;
type Consumer = types.Consumer;
type RtpCapabilities = types.RtpCapabilities;
type DtlsParameters = types.DtlsParameters;
type MediaKind = types.MediaKind;
type RtpParameters = types.RtpParameters;

interface Peer {
  userId: string;
  transports: Map<string, WebRtcTransport & { rtpCapabilities?: RtpCapabilities; transportType?: 'send' | 'recv' }>;
  producers: Map<string, Producer>;
  consumers: Map<string, Consumer>;
}

interface Room {
  router: Router;
  peers: Map<string, Peer>;
}

class MediasoupService {
  private workers: Worker[] = [];
  private nextWorkerIndex = 0;
  private rooms: Map<string, Room> = new Map();

  async initialize() {
    const numWorkers = 1;
    
    for (let i = 0; i < numWorkers; i++) {
      const worker = await mediasoup.createWorker({
        logLevel: 'warn',
        rtcMinPort: 40000,
        rtcMaxPort: 49999,
      });

      worker.on('died', () => {
        console.error('mediasoup worker died, exiting in 2 seconds... [pid:%d]', worker.pid);
        setTimeout(() => process.exit(1), 2000);
      });

      this.workers.push(worker);
    }

    console.log(`✓ Mediasoup initialized with ${numWorkers} worker(s)`);
  }

  private getNextWorker(): Worker {
    const worker = this.workers[this.nextWorkerIndex];
    this.nextWorkerIndex = (this.nextWorkerIndex + 1) % this.workers.length;
    return worker;
  }

  async createRoom(roomId: string): Promise<Router> {
    if (this.rooms.has(roomId)) {
      return this.rooms.get(roomId)!.router;
    }

    const worker = this.getNextWorker();
    const router = await worker.createRouter({
      mediaCodecs: [
        {
          kind: 'audio',
          mimeType: 'audio/opus',
          clockRate: 48000,
          channels: 2,
        },
      ],
    });

    this.rooms.set(roomId, {
      router,
      peers: new Map(),
    });

    console.log(`Created room: ${roomId}`);
    return router;
  }

  getRouterRtpCapabilities(roomId: string): RtpCapabilities | null {
    const room = this.rooms.get(roomId);
    return room ? room.router.rtpCapabilities : null;
  }

  async createWebRtcTransport(
    roomId: string,
    userId: string,
    transportType: 'send' | 'recv',
    rtpCapabilities?: RtpCapabilities
  ): Promise<{ 
    transport: WebRtcTransport; 
    params: { 
      id: string; 
      iceParameters: any; 
      iceCandidates: any; 
      dtlsParameters: any; 
    }
  } | null> {
    const room = this.rooms.get(roomId);
    if (!room) return null;

    const transport = await room.router.createWebRtcTransport({
      listenIps: [{ ip: '0.0.0.0', announcedIp: undefined }],
      enableUdp: true,
      enableTcp: true,
      preferUdp: true,
    }) as WebRtcTransport & { rtpCapabilities?: RtpCapabilities; transportType?: 'send' | 'recv' };

    transport.rtpCapabilities = rtpCapabilities;
    transport.transportType = transportType;

    let peer = room.peers.get(userId);
    if (!peer) {
      peer = {
        userId,
        transports: new Map(),
        producers: new Map(),
        consumers: new Map(),
      };
      room.peers.set(userId, peer);
    }

    peer.transports.set(transport.id, transport);

    return {
      transport,
      params: {
        id: transport.id,
        iceParameters: transport.iceParameters,
        iceCandidates: transport.iceCandidates,
        dtlsParameters: transport.dtlsParameters,
      },
    };
  }

  async connectTransport(
    roomId: string,
    userId: string,
    transportId: string,
    dtlsParameters: DtlsParameters
  ): Promise<boolean> {
    const room = this.rooms.get(roomId);
    if (!room) return false;

    const peer = room.peers.get(userId);
    if (!peer) return false;

    const transport = peer.transports.get(transportId);
    if (!transport) return false;

    await transport.connect({ dtlsParameters });
    return true;
  }

  async produce(
    roomId: string,
    userId: string,
    transportId: string,
    kind: MediaKind,
    rtpParameters: RtpParameters
  ): Promise<string | null> {
    const room = this.rooms.get(roomId);
    if (!room) return null;

    const peer = room.peers.get(userId);
    if (!peer) return null;

    const transport = peer.transports.get(transportId);
    if (!transport) return null;

    const producer = await transport.produce({ kind, rtpParameters });
    peer.producers.set(producer.id, producer);

    producer.on('transportclose', () => {
      console.log('Producer transport closed', producer.id);
      peer.producers.delete(producer.id);
    });

    return producer.id;
  }

  async consume(
    roomId: string,
    userId: string,
    transportId: string,
    producerId: string,
    rtpCapabilities: RtpCapabilities
  ): Promise<{ id: string; producerId: string; kind: MediaKind; rtpParameters: RtpParameters } | null> {
    const room = this.rooms.get(roomId);
    if (!room) return null;

    const peer = room.peers.get(userId);
    if (!peer) return null;

    const transport = peer.transports.get(transportId);
    if (!transport) return null;

    if (!room.router.canConsume({ producerId, rtpCapabilities })) {
      console.log('Cannot consume');
      return null;
    }

    const consumer = await transport.consume({
      producerId,
      rtpCapabilities,
      paused: false,
    });

    peer.consumers.set(consumer.id, consumer);

    consumer.on('transportclose', () => {
      peer.consumers.delete(consumer.id);
    });

    return {
      id: consumer.id,
      producerId: consumer.producerId,
      kind: consumer.kind,
      rtpParameters: consumer.rtpParameters,
    };
  }

  getProducersForRoom(roomId: string, excludeUserId?: string): Array<{ userId: string; producerId: string; kind: MediaKind }> {
    const room = this.rooms.get(roomId);
    if (!room) return [];

    const producers: Array<{ userId: string; producerId: string; kind: MediaKind }> = [];

    const peersArray = Array.from(room.peers.entries());
    for (const [userId, peer] of peersArray) {
      if (excludeUserId && userId === excludeUserId) continue;

      const producersArray = Array.from(peer.producers.entries());
      for (const [producerId, producer] of producersArray) {
        producers.push({
          userId,
          producerId,
          kind: producer.kind,
        });
      }
    }

    return producers;
  }

  removePeer(roomId: string, userId: string) {
    const room = this.rooms.get(roomId);
    if (!room) return;

    const peer = room.peers.get(userId);
    if (!peer) return;

    const transportsArray = Array.from(peer.transports.values());
    for (const transport of transportsArray) {
      transport.close();
    }

    room.peers.delete(userId);

    if (room.peers.size === 0) {
      room.router.close();
      this.rooms.delete(roomId);
      console.log(`Removed empty room: ${roomId}`);
    }
  }

  closeRoom(roomId: string) {
    const room = this.rooms.get(roomId);
    if (!room) return;

    const peersArray = Array.from(room.peers.values());
    for (const peer of peersArray) {
      const transportsArray = Array.from(peer.transports.values());
      for (const transport of transportsArray) {
        transport.close();
      }
    }

    room.router.close();
    this.rooms.delete(roomId);
    console.log(`Closed room: ${roomId}`);
  }
}

export const mediasoupService = new MediasoupService();
