import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Timer, Trophy } from "lucide-react";
import GuessGrid from "@/components/GuessGrid";
import { Progress } from "@/components/ui/progress";

interface Player {
  id: string;
  nickname: string;
  avatar_color: string;
  score: number;
  user_id: string;
}

interface Round {
  id: string;
  photo_id: string;
  correct_player_id: string;
  round_number: number;
}

interface Photo {
  id: string;
  storage_path: string;
  player_id: string;
}

const Game = () => {
  const { roomId } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  
  const [room, setRoom] = useState<any>(null);
  const [players, setPlayers] = useState<Player[]>([]);
  const [currentPlayer, setCurrentPlayer] = useState<Player | null>(null);
  const [currentRound, setCurrentRound] = useState<Round | null>(null);
  const [currentPhoto, setCurrentPhoto] = useState<Photo | null>(null);
  const [selectedGuess, setSelectedGuess] = useState<string | null>(null);
  const [hasGuessed, setHasGuessed] = useState(false);
  const [timer, setTimer] = useState(20);
  const [totalRounds, setTotalRounds] = useState(0);

  useEffect(() => {
    if (!roomId) return;

    const initGame = async () => {
      // Get current user
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      // Fetch room
      const { data: roomData } = await supabase
        .from("rooms")
        .select("*")
        .eq("id", roomId)
        .maybeSingle();

      if (roomData) {
        setRoom(roomData);
        
        // Check if we need to initialize rounds
        if (roomData.status === "uploading") {
          await initializeGameRounds(roomData);
        }
      }

      // Fetch players
      const { data: playersData } = await supabase
        .from("players")
        .select("*")
        .eq("room_id", roomId)
        .order("score", { ascending: false });

      if (playersData) {
        setPlayers(playersData);
        const current = playersData.find(p => p.user_id === session.user.id);
        setCurrentPlayer(current || null);
      }

      // Get total rounds count
      const { count } = await supabase
        .from("photos")
        .select("*", { count: "exact", head: true })
        .eq("room_id", roomId);
      
      setTotalRounds(count || 0);
    };

    initGame();

    // Subscribe to room updates
    const channel = supabase
      .channel("game-updates")
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "rooms",
          filter: `id=eq.${roomId}`,
        },
        async (payload) => {
          const updatedRoom = payload.new;
          setRoom(updatedRoom);
          
          if (updatedRoom.status === "finished") {
            navigate(`/results/${roomId}`);
          } else {
            // Load the current round
            await loadCurrentRound(updatedRoom.current_round);
          }
        }
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "players",
          filter: `room_id=eq.${roomId}`,
        },
        async () => {
          const { data: playersData } = await supabase
            .from("players")
            .select("*")
            .eq("room_id", roomId)
            .order("score", { ascending: false });

          if (playersData) setPlayers(playersData);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [roomId, navigate]);

  useEffect(() => {
    if (room && room.current_round !== null) {
      loadCurrentRound(room.current_round);
    }
  }, [room?.current_round]);

  useEffect(() => {
    if (!hasGuessed && timer > 0) {
      const interval = setInterval(() => {
        setTimer(t => Math.max(0, t - 1));
      }, 1000);
      return () => clearInterval(interval);
    }
  }, [timer, hasGuessed]);

  const initializeGameRounds = async (roomData: any) => {
    if (roomData.host_id !== (await supabase.auth.getSession()).data.session?.user.id) {
      return;
    }

    // Get all photos
    const { data: photos } = await supabase
      .from("photos")
      .select("*")
      .eq("room_id", roomId);

    if (!photos || photos.length === 0) return;

    // Shuffle photos
    const shuffled = [...photos].sort(() => Math.random() - 0.5);

    // Create rounds
    const rounds = shuffled.map((photo, index) => ({
      room_id: roomId,
      photo_id: photo.id,
      correct_player_id: photo.player_id,
      round_number: index + 1,
    }));

    await supabase.from("rounds").insert(rounds);

    // Update room status
    await supabase
      .from("rooms")
      .update({ status: "playing", current_round: 1 })
      .eq("id", roomId);
  };

  const loadCurrentRound = async (roundNumber: number) => {
    if (!roomId || roundNumber === null) return;

    setHasGuessed(false);
    setSelectedGuess(null);
    setTimer(20);

    const { data: roundData } = await supabase
      .from("rounds")
      .select("*")
      .eq("room_id", roomId)
      .eq("round_number", roundNumber)
      .maybeSingle();

    if (roundData) {
      setCurrentRound(roundData);

      const { data: photoData } = await supabase
        .from("photos")
        .select("*")
        .eq("id", roundData.photo_id)
        .single();

      setCurrentPhoto(photoData);

      // Check if current player already guessed
      if (currentPlayer) {
        const { data: existingGuess } = await supabase
          .from("guesses")
          .select("*")
          .eq("round_id", roundData.id)
          .eq("player_id", currentPlayer.id)
          .maybeSingle();

        if (existingGuess) {
          setHasGuessed(true);
          setSelectedGuess(existingGuess.guessed_player_id);
        }
      }
    }
  };

  const submitGuess = async () => {
    if (!selectedGuess || !currentRound || !currentPlayer || hasGuessed) return;

    const isCorrect = selectedGuess === currentRound.correct_player_id;
    const timeBonus = Math.max(0, timer * 5); // 5 points per second remaining
    const points = isCorrect ? 100 + timeBonus : 0;

    // Submit guess
    await supabase.from("guesses").insert({
      round_id: currentRound.id,
      player_id: currentPlayer.id,
      guessed_player_id: selectedGuess,
      points,
    });

    // Update player score
    await supabase
      .from("players")
      .update({ score: currentPlayer.score + points })
      .eq("id", currentPlayer.id);

    setHasGuessed(true);

    toast({
      title: isCorrect ? "Correct! 🎉" : "Wrong guess",
      description: isCorrect
        ? `+${points} points (${timeBonus} time bonus)`
        : "Better luck next round!",
    });
  };

  const nextRound = async () => {
    if (!room || !roomId) return;

    const nextRoundNumber = (room.current_round || 0) + 1;

    if (nextRoundNumber > totalRounds) {
      // Game finished
      await supabase
        .from("rooms")
        .update({ status: "finished" })
        .eq("id", roomId);
    } else {
      // Move to next round
      await supabase
        .from("rooms")
        .update({ current_round: nextRoundNumber })
        .eq("id", roomId);
    }
  };

  const isHost = room?.host_id === currentPlayer?.user_id;
  const photoUrl = currentPhoto
    ? supabase.storage.from("game-photos").getPublicUrl(currentPhoto.storage_path).data.publicUrl
    : "";

  // Filter out the photo owner from guessing options
  const guessablePlayers = players.filter(p => p.id !== currentPhoto?.player_id);

  const progress = room?.current_round ? (room.current_round / totalRounds) * 100 : 0;

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-primary/10 p-4">
      <div className="max-w-6xl mx-auto space-y-6 py-8">
        <div className="flex justify-between items-center">
          <div className="space-y-1">
            <h1 className="text-3xl font-bold bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
              Round {room?.current_round || 0} of {totalRounds}
            </h1>
            <Progress value={progress} className="h-2 w-64" />
          </div>
          <Card className="p-4 bg-card border-border">
            <div className="flex items-center gap-2">
              <Timer className="w-5 h-5 text-primary" />
              <span className="text-2xl font-bold">{timer}s</span>
            </div>
          </Card>
        </div>

        <div className="grid lg:grid-cols-2 gap-6">
          <Card className="p-6 bg-card border-border space-y-4">
            <h2 className="text-xl font-semibold">Who's in this photo?</h2>
            {photoUrl && (
              <div className="aspect-square rounded-lg overflow-hidden bg-secondary">
                <img
                  src={photoUrl}
                  alt="Mystery"
                  className="w-full h-full object-cover"
                />
              </div>
            )}
          </Card>

          <Card className="p-6 bg-card border-border space-y-4">
            <h2 className="text-xl font-semibold">Make your guess</h2>
            
            {currentPhoto?.player_id === currentPlayer?.id ? (
              <div className="flex items-center justify-center h-full">
                <p className="text-muted-foreground text-center">
                  This is your photo! Wait for other players...
                </p>
              </div>
            ) : (
              <>
                <GuessGrid
                  players={guessablePlayers}
                  selectedPlayerId={selectedGuess}
                  onSelectPlayer={setSelectedGuess}
                  disabled={hasGuessed}
                />

                {!hasGuessed && (
                  <Button
                    onClick={submitGuess}
                    disabled={!selectedGuess}
                    className="w-full bg-gradient-to-r from-primary to-accent hover:opacity-90 text-white font-semibold py-6"
                  >
                    Submit Guess
                  </Button>
                )}

                {hasGuessed && (
                  <div className="text-center space-y-4">
                    <p className="text-muted-foreground">
                      Waiting for other players to guess...
                    </p>
                    {isHost && (
                      <Button
                        onClick={nextRound}
                        className="w-full bg-gradient-to-r from-primary to-accent hover:opacity-90 text-white font-semibold py-6"
                      >
                        Next Round
                      </Button>
                    )}
                  </div>
                )}
              </>
            )}
          </Card>
        </div>

        <Card className="p-6 bg-card border-border">
          <div className="flex items-center gap-2 mb-4">
            <Trophy className="w-5 h-5 text-yellow-500" />
            <h2 className="text-xl font-semibold">Leaderboard</h2>
          </div>
          <div className="space-y-2">
            {players.map((player, index) => (
              <div
                key={player.id}
                className={`flex items-center justify-between p-3 rounded-lg ${
                  player.id === currentPlayer?.id ? "bg-primary/10 border border-primary" : "bg-secondary"
                }`}
              >
                <div className="flex items-center gap-3">
                  <span className="text-2xl font-bold text-muted-foreground w-8">
                    #{index + 1}
                  </span>
                  <span className="font-semibold">{player.nickname}</span>
                </div>
                <span className="text-xl font-bold text-primary">{player.score}</span>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
};

export default Game;
