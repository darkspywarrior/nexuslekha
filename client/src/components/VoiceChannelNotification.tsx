import { useEffect } from "react";
import { useWebSocket } from "@/hooks/useWebSocket";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Phone, PhoneIncoming } from "lucide-react";

export function VoiceChannelNotification() {
  const { lastMessage } = useWebSocket();
  const { toast } = useToast();

  useEffect(() => {
    if (!lastMessage) return;

    const { type, ...data } = lastMessage as any;

    if (type === "voice:participant_joined" || type === "voice_participant_joined") {
      toast({
        title: "🎙️ Voice Channel",
        description: `${data.gamertag || "Someone"} joined the voice channel`,
        duration: 4000,
      });
    } else if (type === "voice:participant_left" || type === "voice_participant_left") {
      toast({
        title: "Voice Channel",
        description: `${data.gamertag || "Someone"} left the voice channel`,
        duration: 3000,
      });
    } else if (type === "voice:incoming_call") {
      toast({
        title: "📞 Incoming Voice Call",
        description: `${data.gamertag || "Someone"} is calling you to join voice chat`,
        action: (
          <Button
            size="sm"
            onClick={() => {
              window.location.href = `/ui?join_voice=${data.connectionId}`;
            }}
            data-testid="button-join-voice-call"
          >
            <Phone className="h-4 w-4 mr-2" />
            Join
          </Button>
        ),
        duration: 10000,
      });
    }
  }, [lastMessage, toast]);

  return null;
}
