import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Card } from "@/components/ui/card";
import { Check } from "lucide-react";

interface Player {
  id: string;
  nickname: string;
  avatar_color: string;
}

interface GuessGridProps {
  players: Player[];
  selectedPlayerId: string | null;
  onSelectPlayer: (playerId: string) => void;
  disabled?: boolean;
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

const GuessGrid = ({ players, selectedPlayerId, onSelectPlayer, disabled }: GuessGridProps) => {
  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
      {players.map((player) => {
        const isSelected = selectedPlayerId === player.id;
        
        return (
          <Card
            key={player.id}
            onClick={() => !disabled && onSelectPlayer(player.id)}
            className={`p-4 cursor-pointer transition-all ${
              isSelected
                ? "border-primary border-2 bg-primary/10 scale-105"
                : "bg-secondary border-border hover:border-primary/50"
            } ${disabled ? "opacity-50 cursor-not-allowed" : ""}`}
          >
            <div className="flex flex-col items-center gap-2 text-center relative">
              <Avatar className="w-16 h-16">
                <AvatarFallback className={`${colorMap[player.avatar_color]} text-white font-bold text-xl`}>
                  {player.nickname.charAt(0).toUpperCase()}
                </AvatarFallback>
              </Avatar>
              {isSelected && (
                <div className="absolute -top-2 -right-2 bg-primary rounded-full p-1">
                  <Check className="w-4 h-4 text-white" />
                </div>
              )}
              <p className="font-semibold truncate w-full">{player.nickname}</p>
            </div>
          </Card>
        );
      })}
    </div>
  );
};

export default GuessGrid;
