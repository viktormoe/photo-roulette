-- Create enum for game status
CREATE TYPE game_status AS ENUM ('lobby', 'uploading', 'playing', 'finished');

-- Create enum for player colors
CREATE TYPE player_color AS ENUM ('purple', 'blue', 'green', 'yellow', 'orange', 'red', 'pink', 'cyan');

-- Rooms table
CREATE TABLE public.rooms (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT NOT NULL UNIQUE,
  host_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  max_players INTEGER NOT NULL DEFAULT 8,
  photos_per_player INTEGER NOT NULL DEFAULT 3,
  allow_videos BOOLEAN NOT NULL DEFAULT false,
  status game_status NOT NULL DEFAULT 'lobby',
  current_round INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Players table
CREATE TABLE public.players (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id UUID REFERENCES public.rooms(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  nickname TEXT NOT NULL,
  avatar_color player_color NOT NULL,
  score INTEGER NOT NULL DEFAULT 0,
  is_ready BOOLEAN NOT NULL DEFAULT false,
  joined_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(room_id, nickname)
);

-- Photos table
CREATE TABLE public.photos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id UUID REFERENCES public.rooms(id) ON DELETE CASCADE NOT NULL,
  player_id UUID REFERENCES public.players(id) ON DELETE CASCADE NOT NULL,
  storage_path TEXT NOT NULL,
  is_video BOOLEAN NOT NULL DEFAULT false,
  uploaded_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Rounds table
CREATE TABLE public.rounds (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id UUID REFERENCES public.rooms(id) ON DELETE CASCADE NOT NULL,
  photo_id UUID REFERENCES public.photos(id) ON DELETE CASCADE NOT NULL,
  correct_player_id UUID REFERENCES public.players(id) ON DELETE CASCADE NOT NULL,
  round_number INTEGER NOT NULL,
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  ended_at TIMESTAMPTZ,
  UNIQUE(room_id, round_number)
);

-- Guesses table
CREATE TABLE public.guesses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  round_id UUID REFERENCES public.rounds(id) ON DELETE CASCADE NOT NULL,
  player_id UUID REFERENCES public.players(id) ON DELETE CASCADE NOT NULL,
  guessed_player_id UUID REFERENCES public.players(id) ON DELETE CASCADE NOT NULL,
  points INTEGER NOT NULL DEFAULT 0,
  guessed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(round_id, player_id)
);

-- Enable RLS
ALTER TABLE public.rooms ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.players ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.photos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rounds ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.guesses ENABLE ROW LEVEL SECURITY;

-- RLS Policies for rooms (public read)
CREATE POLICY "Anyone can view rooms"
  ON public.rooms FOR SELECT
  USING (true);

CREATE POLICY "Anyone can create rooms"
  ON public.rooms FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Host can update their rooms"
  ON public.rooms FOR UPDATE
  USING (auth.uid() = host_id);

-- RLS Policies for players (public read)
CREATE POLICY "Anyone can view players"
  ON public.players FOR SELECT
  USING (true);

CREATE POLICY "Anyone can join as player"
  ON public.players FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Players can update themselves"
  ON public.players FOR UPDATE
  USING (user_id = auth.uid());

-- RLS Policies for photos
CREATE POLICY "Anyone in room can view photos"
  ON public.photos FOR SELECT
  USING (true);

CREATE POLICY "Players can upload photos"
  ON public.photos FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Players can delete their photos"
  ON public.photos FOR DELETE
  USING (player_id IN (SELECT id FROM players WHERE user_id = auth.uid()));

-- RLS Policies for rounds
CREATE POLICY "Anyone can view rounds"
  ON public.rounds FOR SELECT
  USING (true);

CREATE POLICY "Host can create rounds"
  ON public.rounds FOR INSERT
  WITH CHECK (EXISTS (
    SELECT 1 FROM rooms WHERE id = room_id AND host_id = auth.uid()
  ));

-- RLS Policies for guesses
CREATE POLICY "Anyone can view guesses"
  ON public.guesses FOR SELECT
  USING (true);

CREATE POLICY "Players can submit guesses"
  ON public.guesses FOR INSERT
  WITH CHECK (player_id IN (SELECT id FROM players WHERE user_id = auth.uid()));

-- Enable realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.rooms;
ALTER PUBLICATION supabase_realtime ADD TABLE public.players;
ALTER PUBLICATION supabase_realtime ADD TABLE public.photos;
ALTER PUBLICATION supabase_realtime ADD TABLE public.rounds;
ALTER PUBLICATION supabase_realtime ADD TABLE public.guesses;

-- Create storage bucket for photos
INSERT INTO storage.buckets (id, name, public) 
VALUES ('game-photos', 'game-photos', true);

-- Storage policies
CREATE POLICY "Anyone can upload photos"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'game-photos');

CREATE POLICY "Anyone can view photos"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'game-photos');

-- Function to generate unique room codes
CREATE OR REPLACE FUNCTION generate_room_code()
RETURNS TEXT
LANGUAGE plpgsql
AS $$
DECLARE
  chars TEXT := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  result TEXT := '';
  i INTEGER;
BEGIN
  FOR i IN 1..6 LOOP
    result := result || substr(chars, floor(random() * length(chars) + 1)::integer, 1);
  END LOOP;
  RETURN result;
END;
$$;

-- Trigger to update updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER update_rooms_updated_at
  BEFORE UPDATE ON public.rooms
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();