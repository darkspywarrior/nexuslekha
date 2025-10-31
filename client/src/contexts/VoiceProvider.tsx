import { createContext, useContext, useState, useRef, useCallback, useEffect } from 'react';
import { useWebSocket } from '@/hooks/useWebSocket';
import { useAuth } from '@/hooks/useAuth';
import type { VoiceParticipantWithUser } from '@shared/schema';

interface VoiceState {
  connectionId: string | null;
  otherUserId: string | null;
  isInChannel: boolean;
  isMuted: boolean;
  isConnecting: boolean;
  participants: VoiceParticipantWithUser[];
}

interface VoiceContextType {
  state: VoiceState;
  joinChannel: (connectionId: string, otherUserId: string) => Promise<void>;
  leaveChannel: () => Promise<void>;
  toggleMute: () => void;
}

const VoiceContext = createContext<VoiceContextType | null>(null);

const ICE_SERVERS = [
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:stun1.l.google.com:19302' },
];

export function VoiceProvider({ children }: { children: React.ReactNode }) {
  const { sendMessage, lastMessage } = useWebSocket();
  const { user } = useAuth();
  
  const [state, setState] = useState<VoiceState>({
    connectionId: null,
    otherUserId: null,
    isInChannel: false,
    isMuted: false,
    isConnecting: false,
    participants: [],
  });

  const peerConnectionRef = useRef<RTCPeerConnection | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const remoteAudioRef = useRef<HTMLAudioElement | null>(null);

  // Initialize remote audio element
  useEffect(() => {
    if (!remoteAudioRef.current) {
      remoteAudioRef.current = new Audio();
      remoteAudioRef.current.autoplay = true;
    }
  }, []);

  // Clean up WebRTC resources
  const cleanup = useCallback(() => {
    if (peerConnectionRef.current) {
      peerConnectionRef.current.close();
      peerConnectionRef.current = null;
    }
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach(track => track.stop());
      localStreamRef.current = null;
    }
    if (remoteAudioRef.current) {
      remoteAudioRef.current.srcObject = null;
    }
  }, []);

  // Create peer connection
  const createPeerConnection = useCallback((otherUserId: string, connectionId: string) => {
    const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });

    pc.onicecandidate = (event) => {
      if (event.candidate) {
        sendMessage({
          type: 'webrtc_ice_candidate',
          targetUserId: otherUserId,
          connectionId: connectionId,
          candidate: event.candidate,
        });
      }
    };

    pc.ontrack = (event) => {
      if (remoteAudioRef.current && event.streams[0]) {
        remoteAudioRef.current.srcObject = event.streams[0];
      }
    };

    pc.onconnectionstatechange = () => {
      console.log('[Voice] Connection state:', pc.connectionState);
    };

    return pc;
  }, [sendMessage]);

  // Join voice channel
  const joinChannel = useCallback(async (connectionId: string, otherUserId: string) => {
    if (!user?.id) {
      console.error('[Voice] Cannot join channel - user not authenticated');
      return;
    }

    try {
      setState(prev => ({ ...prev, isConnecting: true }));

      // Request microphone access
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      localStreamRef.current = stream;

      // Join channel in backend
      const response = await fetch('/api/voice/join', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ connectionId }),
      });

      if (!response.ok) {
        throw new Error('Failed to join voice channel');
      }

      const data = await response.json();
      
      setState(prev => ({
        ...prev,
        connectionId,
        otherUserId,
        isInChannel: true,
        isConnecting: false,
        participants: data.participants,
      }));

      // Create peer connection and add local tracks
      const pc = createPeerConnection(otherUserId, connectionId);
      peerConnectionRef.current = pc;

      stream.getTracks().forEach(track => {
        pc.addTrack(track, stream);
      });

      // Deterministic caller selection to prevent "glare" (both users sending offers)
      // User with lexicographically smaller ID initiates the call
      const isCaller = user.id < otherUserId;
      
      console.log('[Voice] Joined channel. isCaller:', isCaller, 'userId:', user.id, 'otherUserId:', otherUserId);

      if (isCaller) {
        // Only the designated caller creates and sends the offer
        console.log('[Voice] This user is the caller - creating and sending offer');
        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);

        sendMessage({
          type: 'webrtc_offer',
          targetUserId: otherUserId,
          connectionId,
          offer,
        });
      } else {
        console.log('[Voice] This user is NOT the caller - waiting for offer from other user');
      }

    } catch (error) {
      console.error('[Voice] Join error:', error);
      cleanup();
      setState(prev => ({
        ...prev,
        isConnecting: false,
      }));
    }
  }, [user, createPeerConnection, sendMessage, cleanup]);

  // Leave voice channel
  const leaveChannel = useCallback(async () => {
    if (!state.connectionId) return;

    try {
      await fetch('/api/voice/leave', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ connectionId: state.connectionId }),
      });

      cleanup();
      setState({
        connectionId: null,
        otherUserId: null,
        isInChannel: false,
        isMuted: false,
        isConnecting: false,
        participants: [],
      });
    } catch (error) {
      console.error('[Voice] Leave error:', error);
    }
  }, [state.connectionId, cleanup]);

  // Toggle mute
  const toggleMute = useCallback(async () => {
    if (!state.connectionId || !localStreamRef.current) return;

    const newMutedState = !state.isMuted;
    
    // Mute/unmute local audio tracks
    localStreamRef.current.getAudioTracks().forEach(track => {
      track.enabled = !newMutedState;
    });

    // Update backend
    try {
      await fetch('/api/voice/mute', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ connectionId: state.connectionId, isMuted: newMutedState }),
      });

      setState(prev => ({ ...prev, isMuted: newMutedState }));
    } catch (error) {
      console.error('[Voice] Mute error:', error);
    }
  }, [state.connectionId, state.isMuted]);

  // Handle WebRTC signaling messages
  useEffect(() => {
    if (!lastMessage || !state.connectionId) return;

    const handleSignaling = async () => {
      const { type, data } = lastMessage;

      if (type === 'webrtc_offer' && data?.connectionId === state.connectionId) {
        try {
          if (!peerConnectionRef.current) {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            localStreamRef.current = stream;

            const pc = createPeerConnection(data.fromUserId, data.connectionId);
            peerConnectionRef.current = pc;

            stream.getTracks().forEach(track => {
              pc.addTrack(track, stream);
            });
          }

          await peerConnectionRef.current.setRemoteDescription(new RTCSessionDescription(data.offer));
          const answer = await peerConnectionRef.current.createAnswer();
          await peerConnectionRef.current.setLocalDescription(answer);

          sendMessage({
            type: 'webrtc_answer',
            targetUserId: data.fromUserId,
            connectionId: data.connectionId,
            answer,
          });
        } catch (error) {
          console.error('[Voice] Offer handling error:', error);
        }
      } else if (type === 'webrtc_answer' && data?.connectionId === state.connectionId) {
        try {
          if (peerConnectionRef.current) {
            await peerConnectionRef.current.setRemoteDescription(new RTCSessionDescription(data.answer));
          }
        } catch (error) {
          console.error('[Voice] Answer handling error:', error);
        }
      } else if (type === 'webrtc_ice_candidate' && data?.connectionId === state.connectionId) {
        try {
          if (peerConnectionRef.current && data.candidate) {
            await peerConnectionRef.current.addIceCandidate(new RTCIceCandidate(data.candidate));
          }
        } catch (error) {
          console.error('[Voice] ICE candidate error:', error);
        }
      } else if (type === 'voice_participant_joined' && data?.connectionId === state.connectionId) {
        setState(prev => ({ ...prev, participants: data.participants }));
      } else if (type === 'voice_participant_left' && data?.connectionId === state.connectionId) {
        setState(prev => ({ ...prev, participants: data.participants }));
        
        if (data.userId === state.otherUserId) {
          cleanup();
          setState(prev => ({ ...prev, isInChannel: false }));
        }
      } else if (type === 'voice_participant_muted' && data?.connectionId === state.connectionId) {
        setState(prev => ({ ...prev, participants: data.participants }));
      }
    };

    handleSignaling();
  }, [lastMessage, state.connectionId, state.otherUserId, createPeerConnection, sendMessage, cleanup]);

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
