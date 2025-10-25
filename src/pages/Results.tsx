import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Trophy, Home, Crown } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

interface Player {
  id: string;
  nickname: string;
  avatar_color: string;
  score: number;
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

const Results = () => {
  const { roomId } = useParams();
  const navigate = useNavigate();
  const [players, setPlayers] = useState<Player[]>([]);
  const [roomCode, setRoomCode] = useState("");

  useEffect(() => {
    if (!roomId) return;

    const fetchResults = async () => {
      const { data: roomData } = await supabase
        .from("rooms")
        .select("code")
        .eq("id", roomId)
        .single();

      if (roomData) setRoomCode(roomData.code);

      const { data: playersData } = await supabase
        .from("players")
        .select("*")
        .eq("room_id", roomId)
        .order("score", { ascending: false });

      if (playersData) setPlayers(playersData);
    };

    fetchResults();
  }, [roomId]);

  const winner = players[0];
  const podium = players.slice(0, 3);

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-primary/10 p-4">
      <div className="max-w-4xl mx-auto space-y-8 py-8">
        <div className="text-center space-y-4">
          <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-gradient-to-br from-yellow-500 to-yellow-600 shadow-lg">
            <Trophy className="w-10 h-10 text-white" />
          </div>
          <h1 className="text-5xl font-bold bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
            Game Over!
          </h1>
          <p className="text-muted-foreground text-lg">Room: {roomCode}</p>
        </div>

        {winner && (
          <Card className="p-8 bg-gradient-to-br from-yellow-500/10 to-yellow-600/10 border-yellow-500/50 border-2">
            <div className="flex flex-col items-center gap-4 text-center">
              <Crown className="w-12 h-12 text-yellow-500" />
              <Avatar className="w-24 h-24 ring-4 ring-yellow-500">
                <AvatarFallback className={`${colorMap[winner.avatar_color]} text-white font-bold text-3xl`}>
                  {winner.nickname.charAt(0).toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <div>
                <h2 className="text-3xl font-bold">{winner.nickname}</h2>
                <p className="text-5xl font-bold text-yellow-500 mt-2">{winner.score}</p>
                <p className="text-muted-foreground">points</p>
              </div>
            </div>
          </Card>
        )}

        {podium.length > 1 && (
          <div className="grid grid-cols-3 gap-4">
            {podium.map((player, index) => {
              const medal = ["🥇", "🥈", "🥉"][index];
              const bgColor = index === 0 ? "from-yellow-500/10" : index === 1 ? "from-gray-400/10" : "from-orange-500/10";
              
              return (
                <Card key={player.id} className={`p-6 bg-gradient-to-br ${bgColor} border-border`}>
                  <div className="flex flex-col items-center gap-3 text-center">
                    <span className="text-4xl">{medal}</span>
                    <Avatar className="w-16 h-16">
                      <AvatarFallback className={`${colorMap[player.avatar_color]} text-white font-bold text-xl`}>
                        {player.nickname.charAt(0).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <div>
                      <p className="font-semibold">{player.nickname}</p>
                      <p className="text-2xl font-bold text-primary mt-1">{player.score}</p>
                    </div>
                  </div>
                </Card>
              );
            })}
          </div>
        )}

        <Card className="p-6 bg-card border-border">
          <h3 className="text-xl font-semibold mb-4">Final Standings</h3>
          <div className="space-y-2">
            {players.map((player, index) => (
              <div
                key={player.id}
                className="flex items-center justify-between p-4 rounded-lg bg-secondary"
              >
                <div className="flex items-center gap-4">
                  <span className="text-2xl font-bold text-muted-foreground w-8">
                    #{index + 1}
                  </span>
                  <Avatar className="w-12 h-12">
                    <AvatarFallback className={`${colorMap[player.avatar_color]} text-white font-bold`}>
                      {player.nickname.charAt(0).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <span className="font-semibold text-lg">{player.nickname}</span>
                </div>
                <span className="text-2xl font-bold text-primary">{player.score}</span>
              </div>
            ))}
          </div>
        </Card>

        <Button
          onClick={() => navigate("/")}
          className="w-full bg-gradient-to-r from-primary to-accent hover:opacity-90 text-white font-semibold py-6"
        >
          <Home className="w-5 h-5 mr-2" />
          Back to Home
        </Button>
      </div>
    </div>
  );
};

export default Results;
