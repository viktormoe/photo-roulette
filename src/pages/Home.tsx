import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Dices, Users } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

const Home = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [nickname, setNickname] = useState("");
  const [roomCode, setRoomCode] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const createGame = async () => {
    if (!nickname.trim()) {
      toast({
        title: "Nickname required",
        description: "Please enter a nickname to continue",
        variant: "destructive",
      });
      return;
    }

    setIsLoading(true);
    try {
      // Generate room code
      const { data: codeData } = await supabase.rpc("generate_room_code");
      const code = codeData as string;

      // Create anonymous user
      const { data: authData, error: authError } = await supabase.auth.signInAnonymously();
      if (authError) throw authError;

      // Create room
      const { data: room, error: roomError } = await supabase
        .from("rooms")
        .insert({
          code,
          host_id: authData.user.id,
          max_players: 8,
          photos_per_player: 3,
        })
        .select()
        .single();

      if (roomError) throw roomError;

      // Join as player
      const colors: Array<"purple" | "blue" | "green" | "yellow" | "orange" | "red" | "pink" | "cyan"> = 
        ["purple", "blue", "green", "yellow", "orange", "red", "pink", "cyan"];
      const randomColor = colors[Math.floor(Math.random() * colors.length)];

      const { error: playerError } = await supabase.from("players").insert({
        room_id: room.id,
        user_id: authData.user.id,
        nickname: nickname.trim(),
        avatar_color: randomColor,
      });

      if (playerError) throw playerError;

      navigate(`/lobby/${room.id}`);
    } catch (error) {
      console.error("Error creating game:", error);
      toast({
        title: "Failed to create game",
        description: "Please try again",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const joinGame = async () => {
    if (!nickname.trim() || !roomCode.trim()) {
      toast({
        title: "Missing information",
        description: "Please enter both nickname and room code",
        variant: "destructive",
      });
      return;
    }

    setIsLoading(true);
    try {
      // Find room
      const { data: room, error: roomError } = await supabase
        .from("rooms")
        .select("*")
        .eq("code", roomCode.toUpperCase())
        .single();

      if (roomError || !room) {
        throw new Error("Room not found");
      }

      // Check if room is full
      const { count } = await supabase
        .from("players")
        .select("*", { count: "exact", head: true })
        .eq("room_id", room.id);

      if (count && count >= room.max_players) {
        throw new Error("Room is full");
      }

      // Create anonymous user
      const { data: authData, error: authError } = await supabase.auth.signInAnonymously();
      if (authError) throw authError;

      // Join as player
      const colors: Array<"purple" | "blue" | "green" | "yellow" | "orange" | "red" | "pink" | "cyan"> = 
        ["purple", "blue", "green", "yellow", "orange", "red", "pink", "cyan"];
      const randomColor = colors[Math.floor(Math.random() * colors.length)];

      const { error: playerError } = await supabase.from("players").insert({
        room_id: room.id,
        user_id: authData.user.id,
        nickname: nickname.trim(),
        avatar_color: randomColor,
      });

      if (playerError) throw playerError;

      navigate(`/lobby/${room.id}`);
    } catch (error: any) {
      console.error("Error joining game:", error);
      toast({
        title: "Failed to join game",
        description: error.message || "Please check the room code and try again",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-primary/10 flex items-center justify-center p-4">
      <div className="w-full max-w-md space-y-8">
        <div className="text-center space-y-4">
          <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-gradient-to-br from-primary to-accent shadow-lg">
            <Dices className="w-10 h-10 text-white" />
          </div>
          <h1 className="text-5xl font-bold bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
            Photo Roulette
          </h1>
          <p className="text-muted-foreground text-lg">
            Upload photos, guess who's who, and win!
          </p>
        </div>

        <div className="space-y-6">
          <Card className="p-6 space-y-4 bg-card border-border shadow-2xl">
            <div className="space-y-2">
              <Label htmlFor="nickname">Your Nickname</Label>
              <Input
                id="nickname"
                placeholder="Enter your nickname"
                value={nickname}
                onChange={(e) => setNickname(e.target.value)}
                maxLength={20}
                className="bg-background border-border"
              />
            </div>

            <Button
              onClick={createGame}
              disabled={isLoading}
              className="w-full bg-gradient-to-r from-primary to-accent hover:opacity-90 text-white font-semibold py-6"
            >
              <Users className="w-5 h-5 mr-2" />
              Create New Game
            </Button>
          </Card>

          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <span className="w-full border-t border-border" />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-background px-2 text-muted-foreground">Or join existing</span>
            </div>
          </div>

          <Card className="p-6 space-y-4 bg-card border-border shadow-2xl">
            <div className="space-y-2">
              <Label htmlFor="roomCode">Room Code</Label>
              <Input
                id="roomCode"
                placeholder="Enter 6-digit code"
                value={roomCode}
                onChange={(e) => setRoomCode(e.target.value.toUpperCase())}
                maxLength={6}
                className="bg-background border-border text-center text-2xl tracking-wider font-bold"
              />
            </div>

            <Button
              onClick={joinGame}
              disabled={isLoading}
              variant="secondary"
              className="w-full font-semibold py-6"
            >
              Join Game
            </Button>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default Home;
