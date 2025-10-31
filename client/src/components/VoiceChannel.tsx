import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Mic, MicOff, Phone, PhoneOff, Loader2, Users } from "lucide-react";
import { useVoice } from "@/contexts/VoiceProvider";
import { useWebSocket } from "@/hooks/useWebSocket";
import { queryClient } from "@/lib/queryClient";
import type { VoiceParticipantWithUser } from "@shared/schema";

interface VoiceChannelProps {
  connectionId: string;
  currentUserId: string;
  otherUserId: string;
  otherUserName?: string;
}

export function VoiceChannel({ connectionId, currentUserId, otherUserId, otherUserName }: VoiceChannelProps) {
  const { state: voiceState, joinChannel, leaveChannel, toggleMute } = useVoice();
  const { lastMessage: wsMessage } = useWebSocket();

  // Fetch voice channel participants
  const { data: voiceChannelData } = useQuery({
    queryKey: ['/api/voice/channel', connectionId],
    queryFn: async () => {
      const response = await fetch(`/api/voice/channel/${connectionId}`);
      if (!response.ok) {
        throw new Error('Failed to fetch voice channel');
      }
      return response.json() as Promise<{ channel: any; participants: VoiceParticipantWithUser[] }>;
    },
    retry: false,
    refetchInterval: 3000,
  });

  // Handle WebSocket voice events
  useEffect(() => {
    if (!wsMessage) return;

    const { type, data } = wsMessage;
    
    if ((type === 'voice_participant_joined' || type === 'voice_participant_left' || type === 'voice_participant_muted') && data?.connectionId === connectionId) {
      queryClient.invalidateQueries({ queryKey: ['/api/voice/channel', connectionId] });
    }
  }, [wsMessage, connectionId]);

  const isInVoiceChannel = voiceState.isInChannel && voiceState.connectionId === connectionId;
  const voiceParticipants = voiceChannelData?.participants || [];
  const participantsOtherThanMe = voiceParticipants.filter(p => p.userId !== currentUserId);
  const someoneIsWaiting = participantsOtherThanMe.length > 0;

  return (
    <div className="space-y-4">
      <Card className="p-6">
        <div className="space-y-4">
          {/* Header */}
          <div className="flex items-center gap-3 pb-4 border-b">
            <div className="p-3 bg-primary/10 rounded-lg">
              <Phone className="h-6 w-6 text-primary" />
            </div>
            <div>
              <h3 className="font-semibold text-lg">Voice Channel</h3>
              <p className="text-sm text-muted-foreground">
                Real-time voice communication with {otherUserName || 'teammate'}
              </p>
            </div>
          </div>

          {/* Voice Lobby - Show who's in the channel */}
          {voiceParticipants.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                <Users className="h-4 w-4" />
                <span>In Voice Channel — {voiceParticipants.length}</span>
              </div>
              <div className="space-y-2 bg-muted/30 rounded-lg p-3">
                {voiceParticipants.map(participant => {
                  const isMe = participant.userId === currentUserId;
                  const isMuted = participant.isMuted === 'true';
                  return (
                    <div 
                      key={participant.id} 
                      className={`flex items-center gap-3 p-2 rounded-md transition-colors ${
                        isMe ? 'bg-primary/10' : 'bg-background/50'
                      }`}
                      data-testid={`voice-lobby-participant-${participant.userId}`}
                    >
                      <Avatar className="h-8 w-8">
                        <AvatarFallback className={isMe ? "bg-primary text-primary-foreground" : ""}>
                          {(participant.gamertag?.[0] || 'U').toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">
                          {isMe ? 'You' : (participant.gamertag || 'User')}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {isMe && isInVoiceChannel ? 'Connected' : 'In lobby'}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        {isMuted ? (
                          <div className="flex items-center gap-1 text-muted-foreground">
                            <MicOff className="h-4 w-4" />
                            <span className="text-xs hidden sm:inline">Muted</span>
                          </div>
                        ) : (
                          <div className="flex items-center gap-1 text-green-600 dark:text-green-400">
                            <Mic className="h-4 w-4" />
                            <span className="text-xs hidden sm:inline">Live</span>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Empty state when no one is in the channel */}
          {voiceParticipants.length === 0 && !isInVoiceChannel && (
            <div className="text-center py-8 space-y-2">
              <div className="mx-auto w-16 h-16 bg-muted/50 rounded-full flex items-center justify-center">
                <Users className="h-8 w-8 text-muted-foreground" />
              </div>
              <p className="text-sm text-muted-foreground">
                No one is in the voice channel yet
              </p>
              <p className="text-xs text-muted-foreground">
                Be the first to join!
              </p>
            </div>
          )}

          {/* Join/Leave Controls */}
          {!isInVoiceChannel ? (
            <Button
              onClick={() => joinChannel(connectionId, otherUserId)}
              disabled={voiceState.isConnecting}
              size="lg"
              className="w-full"
              variant={someoneIsWaiting ? "default" : "outline"}
              data-testid="button-join-voice-channel"
            >
              {voiceState.isConnecting ? (
                <>
                  <Loader2 className="h-5 w-5 mr-2 animate-spin" />
                  Joining Voice...
                </>
              ) : someoneIsWaiting ? (
                <>
                  <Phone className="h-5 w-5 mr-2" />
                  Join Voice ({participantsOtherThanMe.length} waiting)
                </>
              ) : (
                <>
                  <Phone className="h-5 w-5 mr-2" />
                  Join Voice
                </>
              )}
            </Button>
          ) : (
            <div className="space-y-3">
              {/* Status indicator */}
              <div className="flex items-center gap-2 p-3 bg-green-500/10 border border-green-500/30 rounded-lg">
                <div className="h-2 w-2 bg-green-500 rounded-full animate-pulse"></div>
                <span className="text-sm font-medium text-green-600 dark:text-green-400">
                  Connected to Voice Channel
                </span>
              </div>

              {/* Controls */}
              <div className="flex gap-2">
                <Button
                  onClick={toggleMute}
                  size="lg"
                  variant={voiceState.isMuted ? "destructive" : "secondary"}
                  className="flex-1"
                  data-testid="button-toggle-mute-voice"
                >
                  {voiceState.isMuted ? (
                    <>
                      <MicOff className="h-5 w-5 mr-2" />
                      Unmute
                    </>
                  ) : (
                    <>
                      <Mic className="h-5 w-5 mr-2" />
                      Mute
                    </>
                  )}
                </Button>
                <Button
                  onClick={leaveChannel}
                  size="lg"
                  variant="destructive"
                  className="flex-1"
                  data-testid="button-leave-voice-channel"
                >
                  <PhoneOff className="h-5 w-5 mr-2" />
                  Leave
                </Button>
              </div>
            </div>
          )}

          {/* Info */}
          <div className="text-xs text-muted-foreground bg-muted/30 rounded-lg p-3 space-y-1">
            <p className="font-semibold">How it works:</p>
            <ul className="list-disc list-inside space-y-0.5 ml-2">
              <li>Click "Join Voice" to enter the voice channel</li>
              <li>You'll see who else is in the lobby above</li>
              <li>Voice uses WebRTC for peer-to-peer connection</li>
              <li>Both users need to be online for voice to work</li>
            </ul>
          </div>
        </div>
      </Card>
    </div>
  );
}
