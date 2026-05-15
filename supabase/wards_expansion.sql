-- Optional: add 12 more GHMC circles to match the hologram map (run after seed.sql)
INSERT INTO wards (id, name, lat, lng, population, zone, open_issues, resolved_issues, health_score, dominant_category) VALUES
(9, 'Saidabad', 17.3525, 78.5145, 265000, 'South', 31, 112, 44.0, 'Drainage'),
(10, 'Falaknuma', 17.3382, 78.4655, 218000, 'South', 39, 88, 36.0, 'Sanitation'),
(11, 'Rajendranagar', 17.3488, 78.4285, 295000, 'South', 19, 134, 61.0, 'Roads'),
(12, 'Khairatabad', 17.4152, 78.462, 385000, 'Central', 26, 175, 62.0, 'Traffic'),
(13, 'Nampally', 17.392, 78.4685, 242000, 'Central', 33, 121, 48.0, 'Roads'),
(14, 'Mehdipatnam', 17.3845, 78.442, 318000, 'Central', 24, 149, 59.0, 'HMWSSB'),
(15, 'Malkajgiri', 17.4548, 78.5355, 452000, 'North', 21, 188, 68.0, 'Sanitation'),
(16, 'Alwal', 17.5055, 78.512, 378000, 'North', 15, 201, 76.0, 'Parks'),
(17, 'Hayathnagar', 17.3285, 78.592, 336000, 'East', 27, 156, 55.0, 'Drainage'),
(18, 'Kapra', 17.472, 78.568, 362000, 'East', 17, 172, 71.0, 'Street Lighting'),
(19, 'Miyapur', 17.4965, 78.358, 518000, 'West', 14, 220, 79.0, 'Roads'),
(20, 'Gachibowli', 17.4405, 78.3485, 405000, 'West', 11, 235, 85.0, 'IT Corridor')
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  lat = EXCLUDED.lat,
  lng = EXCLUDED.lng,
  population = EXCLUDED.population,
  zone = EXCLUDED.zone;
