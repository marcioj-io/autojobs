ALTER TABLE profiles
ADD COLUMN search_location TEXT NOT NULL DEFAULT 'Brasil';

ALTER TABLE profiles
ADD COLUMN allowed_modalities TEXT NOT NULL DEFAULT '["remoto", "híbrido"]';

ALTER TABLE profiles
ADD COLUMN hybrid_cities TEXT NOT NULL DEFAULT '["são paulo", "sp"]';