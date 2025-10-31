import { createContext, useContext, useState, useRef, useCallback, useEffect } from 'react';
import { useWebSocket } from '@/hooks/useWebSocket';
import { useAuth } from '@/hooks/useAuth';
import * as mediasoupClient from 'mediasoup-client';
import type { types } from 'mediasoup-client';

type Device = types.Device;
type Transport = types.Transport;
type Producer = types.Producer;
type Consumer = types.Consumer;

interface VoiceParticipant {
  userId: string;
  gamertag: string | null;
  profileImageUrl: string | null;
  isMuted: boolean;
}

interface VoiceState {
  connectionId: string | null;
  isInChannel: boolean;
  isMuted: boolean;
  isConnecting: boolean;
  participants: VoiceParticipant[];
}

interface VoiceContextType {
  state: VoiceState;
  joinChannel: (connectionId: string) => Promise<void>;
  leaveChannel: () => Promise<void>;
  toggleMute: () => void;
}

const VoiceContext = createContext<VoiceContextType | null>(null);

export function VoiceProvider({ children }: { children: React.ReactNode }) {
  const { sendMessage, lastMessage } = useWebSocket();
  const { user } = useAuth();
  
  const [state, setState] = useState<VoiceState>({
    connectionId: null,
    isInChannel: false,
    isMuted: false,
    isConnecting: false,
    participants: [],
  });

  const deviceRef = useRef<Device | null>(null);
  const sendTransportRef = useRef<Transport | null>(null);
  const recvTransportRef = useRef<Transport | null>(null);
  const producerRef = useRef<Producer | null>(null);
  const consumersRef = useRef<Map<string, Consumer>>(new Map());
  const localStreamRef = useRef<MediaStream | null>(null);
  const audioElementsRef = useRef<Map<string, HTMLAudioElement>>(new Map());

  // Clean up resources
  const cleanup = useCallback(() => {
    // Close producer
    if (producerRef.current) {
      producerRef.current.close();
      producerRef.current = null;
    }

    // Close all consumers
    consumersRef.current.forEach(consumer => consumer.close());
    consumersRef.current.clear();

    // Close transports
    if (sendTransportRef.current) {
      sendTransportRef.current.close();
      sendTransportRef.current = null;
    }
    if (recvTransportRef.current) {
      recvTransportRef.current.close();
      recvTransportRef.current = null;
    }

    // Stop local tracks
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach(track => track.stop());
      localStreamRef.current = null;
    }

    // Remove audio elements
    audioElementsRef.current.forEach(audio => {
      audio.srcObject = null;
      audio.remove();
    });
    audioElementsRef.current.clear();

    deviceRef.current = null;
  }, []);

  // Pending operations tracking
  const pendingOperationsRef = useRef<Map<string, (data: any) => void>>(new Map());

  // Create transport
  const createTransport = useCallback(async (
    direction: 'send' | 'recv',
    connectionId: string
  ): Promise<Transport | null> => {
    if (!deviceRef.current) return null;

    try {
      // Request transport creation from server
      sendMessage({
        type: 'voice:createTransport',
        connectionId,
        transportType: direction,
        rtpCapabilities: deviceRef.current.rtpCapabilities,
      });

      // Wait for transport params from server
      const transportParams = await new Promise<any>((resolve) => {
        const operationId = `transport_${direction}_${Date.now()}`;
        pendingOperationsRef.current.set(operationId, (data) => {
          if (data.type === 'voice:transportCreated') {
            resolve(data);
          }
        });

        // Timeout after 10 seconds
        setTimeout(() => {
          pendingOperationsRef.current.delete(operationId);
          resolve(null);
        }, 10000);
      });

      if (!transportParams) {
        console.error('[Voice] Transport creation timeout');
        return null;
      }

      const transport = direction === 'send'
        ? deviceRef.current.createSendTransport(transportParams.params)
        : deviceRef.current.createRecvTransport(transportParams.params);

      transport.on('connect', async ({ dtlsParameters }, callback, errback) => {
        try {
          sendMessage({
            type: 'voice:connectTransport',
            connectionId,
            transportId: transport.id,
            dtlsParameters,
          });

          // Wait for connection confirmation
          const result = await new Promise<boolean>((resolve) => {
            const operationId = `connect_${transport.id}_${Date.now()}`;
            pendingOperationsRef.current.set(operationId, (data) => {
              if (data.type === 'voice:transportConnected') {
                resolve(true);
              }
            });

            setTimeout(() => {
              pendingOperationsRef.current.delete(operationId);
              resolve(false);
            }, 10000);
          });

          if (result) {
            callback();
          } else {
            errback(new Error('Transport connection timeout'));
          }
        } catch (error) {
          errback(error as Error);
        }
      });

      if (direction === 'send') {
        transport.on('produce', async ({ kind, rtpParameters }, callback, errback) => {
          try {
            sendMessage({
              type: 'voice:produce',
              connectionId,
              transportId: transport.id,
              kind,
              rtpParameters,
            });

            // Wait for producer ID
            const result = await new Promise<string | null>((resolve) => {
              const operationId = `produce_${transport.id}_${Date.now()}`;
              pendingOperationsRef.current.set(operationId, (data) => {
                if (data.type === 'voice:produced') {
                  resolve(data.producerId);
                }
              });

              setTimeout(() => {
                pendingOperationsRef.current.delete(operationId);
                resolve(null);
              }, 10000);
            });

            if (result) {
              callback({ id: result });
            } else {
              errback(new Error('Produce timeout'));
            }
          } catch (error) {
            errback(error as Error);
          }
        });
      }

      return transport;
    } catch (error) {
      console.error('[Voice] Transport creation error:', error);
      return null;
    }
  }, [sendMessage]);

  // Join voice channel
  const joinChannel = useCallback(async (connectionId: string) => {
    if (!user?.id) {
      console.error('[Voice] Cannot join channel - user not authenticated');
      return;
    }

    try {
      setState(prev => ({ ...prev, isConnecting: true }));

      // Request microphone access
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      localStreamRef.current = stream;

      // Initialize mediasoup device
      const device = new mediasoupClient.Device();
      deviceRef.current = device;

      // Send join request to server
      sendMessage({
        type: 'voice:join',
        connectionId,
      });

      // Wait for join response with RTP capabilities
      const joinResponse = await new Promise<any>((resolve, reject) => {
        const operationId = `join_${connectionId}_${Date.now()}`;
        pendingOperationsRef.current.set(operationId, (data) => {
          if (data.type === 'voice:joined') {
            pendingOperationsRef.current.delete(operationId);
            resolve(data);
          }
        });

        setTimeout(() => {
          pendingOperationsRef.current.delete(operationId);
          reject(new Error('Join timeout'));
        }, 10000);
      });

      // Load device with router RTP capabilities
      await device.load({ routerRtpCapabilities: joinResponse.rtpCapabilities });

      // Create send transport
      const sendTransport = await createTransport('send', connectionId);
      if (!sendTransport) throw new Error('Failed to create send transport');
      sendTransportRef.current = sendTransport;

      // Create receive transport
      const recvTransport = await createTransport('recv', connectionId);
      if (!recvTransport) throw new Error('Failed to create receive transport');
      recvTransportRef.current = recvTransport;

      // Produce audio track
      const audioTrack = stream.getAudioTracks()[0];
      const producer = await sendTransport.produce({ track: audioTrack });
      producerRef.current = producer;

      // Get existing producers
      sendMessage({
        type: 'voice:getProducers',
        connectionId,
      });

      setState(prev => ({
        ...prev,
        connectionId,
        isInChannel: true,
        isConnecting: false,
        participants: joinResponse.participants || [],
      }));

      console.log('[Voice] Successfully joined channel');
    } catch (error) {
      console.error('[Voice] Join error:', error);
      cleanup();
      setState(prev => ({
        ...prev,
        isConnecting: false,
      }));
    }
  }, [user, sendMessage, createTransport, cleanup]);

  // Leave voice channel
  const leaveChannel = useCallback(async () => {
    if (!state.connectionId) return;

    try {
      sendMessage({
        type: 'voice:leave',
        connectionId: state.connectionId,
      });

      cleanup();
      setState({
        connectionId: null,
        isInChannel: false,
        isMuted: false,
        isConnecting: false,
        participants: [],
      });
    } catch (error) {
      console.error('[Voice] Leave error:', error);
    }
  }, [state.connectionId, sendMessage, cleanup]);

  // Toggle mute
  const toggleMute = useCallback(async () => {
    if (!state.connectionId || !producerRef.current) return;

    const newMutedState = !state.isMuted;
    
    if (newMutedState) {
      producerRef.current.pause();
    } else {
      producerRef.current.resume();
    }

    sendMessage({
      type: newMutedState ? 'voice:mute' : 'voice:unmute',
      connectionId: state.connectionId,
    });

    setState(prev => ({ ...prev, isMuted: newMutedState }));
  }, [state.connectionId, state.isMuted, sendMessage]);

  // Consume remote producer
  const consumeProducer = useCallback(async (producerId: string, userId: string) => {
    if (!recvTransportRef.current || !deviceRef.current || !state.connectionId) return;

    try {
      sendMessage({
        type: 'voice:consume',
        connectionId: state.connectionId,
        transportId: recvTransportRef.current.id,
        producerId,
        rtpCapabilities: deviceRef.current.rtpCapabilities,
      });

      // Wait for consumer params
      const consumerData = await new Promise<any>((resolve, reject) => {
        const operationId = `consume_${producerId}_${Date.now()}`;
        pendingOperationsRef.current.set(operationId, (data) => {
          if (data.type === 'voice:consumed') {
            pendingOperationsRef.current.delete(operationId);
            resolve(data);
          }
        });

        setTimeout(() => {
          pendingOperationsRef.current.delete(operationId);
          reject(new Error('Consume timeout'));
        }, 10000);
      });

      const consumer = await recvTransportRef.current.consume(consumerData.consumer);
      consumersRef.current.set(producerId, consumer);

      // Create audio element for this participant
      const audioElement = new Audio();
      audioElement.autoplay = true;
      audioElement.srcObject = new MediaStream([consumer.track]);
      audioElementsRef.current.set(userId, audioElement);

      console.log('[Voice] Consuming remote producer:', producerId, 'from user:', userId);
    } catch (error) {
      console.error('[Voice] Consume error:', error);
    }
  }, [state.connectionId, sendMessage]);

  // Handle WebSocket messages
  useEffect(() => {
    if (!lastMessage) return;

    const { type, ...messageData } = lastMessage as any;

    // Resolve pending operations
    pendingOperationsRef.current.forEach((resolver, operationId) => {
      resolver(lastMessage);
    });

    // Handle other message types
    if (type === 'voice:producers') {
      // Consume all existing producers
      messageData.producers?.forEach((producer: any) => {
        consumeProducer(producer.producerId, producer.userId);
      });
    } else if (type === 'voice:newProducer' && messageData.connectionId === state.connectionId) {
      // New participant started producing
      consumeProducer(messageData.producerId, messageData.userId);
    } else if (type === 'voice:participant_joined' && messageData.connectionId === state.connectionId) {
      setState(prev => ({
        ...prev,
        participants: [...prev.participants, {
          userId: messageData.userId,
          gamertag: messageData.gamertag,
          profileImageUrl: messageData.profileImageUrl,
          isMuted: false,
        }],
      }));
    } else if (type === 'voice:participant_left' && messageData.connectionId === state.connectionId) {
      // Remove audio element
      const audioElement = audioElementsRef.current.get(messageData.userId);
      if (audioElement) {
        audioElement.srcObject = null;
        audioElement.remove();
        audioElementsRef.current.delete(messageData.userId);
      }

      setState(prev => ({
        ...prev,
        participants: prev.participants.filter(p => p.userId !== messageData.userId),
      }));
    } else if (type === 'voice:participant_muted' && messageData.connectionId === state.connectionId) {
      setState(prev => ({
        ...prev,
        participants: prev.participants.map(p =>
          p.userId === messageData.userId ? { ...p, isMuted: messageData.isMuted } : p
        ),
      }));
    } else if (type === 'voice:left') {
      cleanup();
      setState({
        connectionId: null,
        isInChannel: false,
        isMuted: false,
        isConnecting: false,
        participants: [],
      });
    }
  }, [lastMessage, state.connectionId, consumeProducer, cleanup]);

  return (
    <VoiceContext.Provider value={{ state, joinChannel, leaveChannel, toggleMute }}>
      {children}
    </VoiceContext.Provider>
  );
}

export function useVoice() {
  const context = useContext(VoiceContext);
  if (!context) {
    throw new Error('useVoice must be used within VoiceProvider');
  }
  return context;
}
