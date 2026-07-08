ALTER TABLE `profiles` ADD `searchLocation` text DEFAULT 'Brasil' NOT NULL;
ALTER TABLE `profiles` ADD `allowedModalities` text DEFAULT '["remoto", "híbrido"]' NOT NULL;
ALTER TABLE `profiles` ADD `hybridCities` text DEFAULT '["são paulo", "sp"]' NOT NULL;