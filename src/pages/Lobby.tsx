import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Copy, Crown, Users, Upload } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Badge } from "@/components/ui/badge";

interface Player {
  id: string;
  nickname: string;
  avatar_color: string;
  is_ready: boolean;
  user_id: string;
}

interface Room {
  id: string;
  code: string;
  host_id: string;
  max_players: number;
  photos_per_player: number;
  status: string;
}

const colorMap: Record<string, string> = {
  purple: "bg-purple-500",
  blue: "bg-blue-500",
  green: "bg-green-500",
  yellow: "bg-yellow-500",
  orange: "bg-orange-500",
  red: "bg-red-500",
  pink: "bg-pink-500",
  cyan: "bg-cyan-500",
};

const Lobby = () => {
  const { roomId } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [room, setRoom] = useState<Room | null>(null);
  const [players, setPlayers] = useState<Player[]>([]);
  const [currentUserId, setCurrentUserId] = useState<string>("");

  useEffect(() => {
    if (!roomId) return;

    // Get current user
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        setCurrentUserId(session.user.id);
      }
    });

    // Fetch room data
    const fetchRoom = async () => {
      const { data, error } = await supabase
        .from("rooms")
        .select("*")
        .eq("id", roomId)
        .single();

      if (error) {
        console.error("Error fetching room:", error);
        toast({
          title: "Room not found",
          description: "Redirecting to home...",
          variant: "destructive",
        });
        navigate("/");
        return;
      }

      setRoom(data);
    };

    fetchRoom();

    // Subscribe to players
    const fetchPlayers = async () => {
      const { data, error } = await supabase
        .from("players")
        .select("*")
        .eq("room_id", roomId)
        .order("joined_at");

      if (!error && data) {
        setPlayers(data);
      }
    };

    fetchPlayers();

    const channel = supabase
      .channel("lobby-changes")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "players",
          filter: `room_id=eq.${roomId}`,
        },
        () => {
          fetchPlayers();
        }
      )
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "rooms",
          filter: `id=eq.${roomId}`,
        },
        (payload) => {
          const updatedRoom = payload.new as Room;
          setRoom(updatedRoom);
          if (updatedRoom.status === "uploading") {
            navigate(`/upload/${roomId}`);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [roomId, navigate, toast]);

  const copyRoomCode = () => {
    if (room) {
      navigator.clipboard.writeText(room.code);
      toast({
        title: "Copied!",
        description: "Room code copied to clipboard",
      });
    }
  };

  const startGame = async () => {
    if (!room || !currentUserId || room.host_id !== currentUserId) return;

    if (players.length < 2) {
      toast({
        title: "Not enough players",
        description: "You need at least 2 players to start",
        variant: "destructive",
      });
      return;
    }

    const { error } = await supabase
      .from("rooms")
      .update({ status: "uploading" })
      .eq("id", roomId);

    if (error) {
      console.error("Error starting game:", error);
      toast({
        title: "Failed to start game",
        description: "Please try again",
        variant: "destructive",
      });
    }
  };

  const isHost = room?.host_id === currentUserId;

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-primary/10 p-4">
      <div className="max-w-4xl mx-auto space-y-6 py-8">
        <div className="text-center space-y-4">
          <h1 className="text-4xl font-bold bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
            Game Lobby
          </h1>

          <Card className="inline-flex items-center gap-3 p-4 bg-card border-border">
            <span className="text-sm text-muted-foreground">Room Code:</span>
            <span className="text-3xl font-bold tracking-wider">{room?.code}</span>
            <Button variant="ghost" size="icon" onClick={copyRoomCode}>
              <Copy className="w-4 h-4" />
            </Button>
          </Card>
        </div>

        <Card className="p-6 bg-card border-border">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-2">
              <Users className="w-5 h-5 text-primary" />
              <h2 className="text-xl font-semibold">
                Players ({players.length}/{room?.max_players})
              </h2>
            </div>
            {isHost && (
              <Badge variant="secondary" className="bg-gradient-to-r from-primary to-accent">
                <Crown className="w-3 h-3 mr-1" />
                Host
              </Badge>
            )}
          </div>

          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {players.map((player) => (
              <Card
                key={player.id}
                className="p-4 bg-secondary border-border hover:border-primary/50 transition-colors"
              >
                <div className="flex flex-col items-center gap-2 text-center">
                  <Avatar className="w-16 h-16">
                    <AvatarFallback className={`${colorMap[player.avatar_color]} text-white font-bold text-xl`}>
                      {player.nickname.charAt(0).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <div className="space-y-1">
                    <p className="font-semibold truncate w-full">{player.nickname}</p>
                    {player.user_id === room?.host_id && (
                      <Crown className="w-4 h-4 mx-auto text-yellow-500" />
                    )}
                  </div>
                </div>
              </Card>
            ))}
          </div>
        </Card>

        {room && (
          <Card className="p-6 bg-card border-border space-y-4">
            <h3 className="text-lg font-semibold">Game Settings</h3>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div className="space-y-1">
                <p className="text-muted-foreground">Photos per player</p>
                <p className="font-semibold">{room.photos_per_player}</p>
              </div>
              <div className="space-y-1">
                <p className="text-muted-foreground">Max players</p>
                <p className="font-semibold">{room.max_players}</p>
              </div>
            </div>
          </Card>
        )}

        {isHost && (
          <Button
            onClick={startGame}
            className="w-full bg-gradient-to-r from-primary to-accent hover:opacity-90 text-white font-semibold py-6"
          >
            <Upload className="w-5 h-5 mr-2" />
            Start Game - Begin Photo Upload
          </Button>
        )}

        {!isHost && (
          <Card className="p-4 bg-secondary border-border text-center">
            <p className="text-muted-foreground">Waiting for host to start the game...</p>
          </Card>
        )}
      </div>
    </div>
  );
};

export default Lobby;
