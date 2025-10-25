import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Upload as UploadIcon, X, Check } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Progress } from "@/components/ui/progress";

interface Photo {
  id: string;
  storage_path: string;
}

const Upload = () => {
  const { roomId } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [room, setRoom] = useState<any>(null);
  const [player, setPlayer] = useState<any>(null);
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [previewUrls, setPreviewUrls] = useState<string[]>([]);
  const [uploading, setUploading] = useState(false);
  const [required, setRequired] = useState(3);

  useEffect(() => {
    if (!roomId) return;

    const fetchData = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const { data: roomData } = await supabase
        .from("rooms")
        .select("*")
        .eq("id", roomId)
        .single();

      const { data: playerData } = await supabase
        .from("players")
        .select("*")
        .eq("room_id", roomId)
        .eq("user_id", session.user.id)
        .single();

      const { data: photosData } = await supabase
        .from("photos")
        .select("*")
        .eq("room_id", roomId)
        .eq("player_id", playerData?.id);

      if (roomData) {
        setRoom(roomData);
        setRequired(roomData.photos_per_player);
      }
      if (playerData) setPlayer(playerData);
      if (photosData) setPhotos(photosData);
    };

    fetchData();

    // Subscribe to room status changes
    const channel = supabase
      .channel("room-status")
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "rooms",
          filter: `id=eq.${roomId}`,
        },
        (payload) => {
          const updatedRoom = payload.new;
          if (updatedRoom.status === "playing") {
            navigate(`/game/${roomId}`);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [roomId, navigate]);

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (photos.length + files.length > required) {
      toast({
        title: "Too many photos",
        description: `You can only upload ${required} photos`,
        variant: "destructive",
      });
      return;
    }

    setUploading(true);

    for (const file of files) {
      try {
        const fileExt = file.name.split(".").pop();
        const fileName = `${roomId}/${player.id}/${Math.random()}.${fileExt}`;

        const { error: uploadError } = await supabase.storage
          .from("game-photos")
          .upload(fileName, file);

        if (uploadError) throw uploadError;

        const { error: dbError } = await supabase.from("photos").insert({
          room_id: roomId,
          player_id: player.id,
          storage_path: fileName,
          is_video: file.type.startsWith("video/"),
        });

        if (dbError) throw dbError;

        const { data: newPhotos } = await supabase
          .from("photos")
          .select("*")
          .eq("room_id", roomId)
          .eq("player_id", player.id);

        if (newPhotos) setPhotos(newPhotos);
      } catch (error) {
        console.error("Upload error:", error);
        toast({
          title: "Upload failed",
          description: "Please try again",
          variant: "destructive",
        });
      }
    }

    setUploading(false);
  };

  const deletePhoto = async (photo: Photo) => {
    try {
      await supabase.storage.from("game-photos").remove([photo.storage_path]);
      await supabase.from("photos").delete().eq("id", photo.id);

      setPhotos(photos.filter((p) => p.id !== photo.id));

      toast({
        title: "Photo deleted",
      });
    } catch (error) {
      console.error("Delete error:", error);
      toast({
        title: "Delete failed",
        description: "Please try again",
        variant: "destructive",
      });
    }
  };

  const markReady = async () => {
    if (photos.length < required) {
      toast({
        title: "Not enough photos",
        description: `Please upload ${required} photos`,
        variant: "destructive",
      });
      return;
    }

    await supabase
      .from("players")
      .update({ is_ready: true })
      .eq("id", player.id);

    toast({
      title: "Ready!",
      description: "Waiting for other players...",
    });
  };

  const progress = (photos.length / required) * 100;
  const isReady = photos.length >= required;

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-primary/10 p-4">
      <div className="max-w-4xl mx-auto space-y-6 py-8">
        <div className="text-center space-y-4">
          <h1 className="text-4xl font-bold bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
            Upload Your Photos
          </h1>
          <p className="text-muted-foreground">
            Upload {required} photos of yourself for other players to guess
          </p>
        </div>

        <Card className="p-6 bg-card border-border space-y-4">
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Progress</span>
              <span className="font-semibold">
                {photos.length} / {required}
              </span>
            </div>
            <Progress value={progress} className="h-2" />
          </div>

          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            {photos.map((photo) => {
              const { data } = supabase.storage
                .from("game-photos")
                .getPublicUrl(photo.storage_path);

              return (
                <div key={photo.id} className="relative group">
                  <Card className="aspect-square overflow-hidden bg-secondary border-border">
                    <img
                      src={data.publicUrl}
                      alt="Uploaded"
                      className="w-full h-full object-cover"
                    />
                  </Card>
                  <Button
                    size="icon"
                    variant="destructive"
                    className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity"
                    onClick={() => deletePhoto(photo)}
                  >
                    <X className="w-4 h-4" />
                  </Button>
                </div>
              );
            })}

            {photos.length < required && (
              <label className="cursor-pointer">
                <Card className="aspect-square flex items-center justify-center bg-secondary border-dashed border-2 border-border hover:border-primary transition-colors">
                  <div className="text-center space-y-2">
                    <UploadIcon className="w-8 h-8 mx-auto text-muted-foreground" />
                    <p className="text-sm text-muted-foreground">Upload Photo</p>
                  </div>
                </Card>
                <input
                  type="file"
                  accept="image/*"
                  multiple
                  className="hidden"
                  onChange={handleFileSelect}
                  disabled={uploading}
                />
              </label>
            )}
          </div>

          {isReady && (
            <Button
              onClick={markReady}
              className="w-full bg-gradient-to-r from-primary to-accent hover:opacity-90 text-white font-semibold py-6"
            >
              <Check className="w-5 h-5 mr-2" />
              I'm Ready!
            </Button>
          )}
        </Card>

        {player?.is_ready && (
          <Card className="p-4 bg-secondary border-border text-center">
            <p className="text-muted-foreground">Waiting for other players to finish uploading...</p>
          </Card>
        )}
      </div>
    </div>
  );
};

export default Upload;
