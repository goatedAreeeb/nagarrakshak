/**
 * GHMC-style circles / zones covering Greater Hyderabad.
 * Coordinates are ward centroids; hex polygons are generated in wardGeoJSON.js.
 */
export const HYDERABAD_WARDS = [
  { ward_id: 1, ward_name: 'Charminar', lat: 17.3616, lng: 78.4747, population: 310000, zone: 'South', open_issues: 42, resolved_issues: 128, health_score: 32, dominant_category: 'Roads' },
  { ward_id: 2, ward_name: 'Secunderabad', lat: 17.4399, lng: 78.4983, population: 420000, zone: 'North', open_issues: 28, resolved_issues: 156, health_score: 58, dominant_category: 'Sanitation' },
  { ward_id: 3, ward_name: 'Kukatpally', lat: 17.4849, lng: 78.3995, population: 580000, zone: 'West', open_issues: 18, resolved_issues: 210, health_score: 74, dominant_category: 'Drainage' },
  { ward_id: 4, ward_name: 'LB Nagar', lat: 17.3469, lng: 78.5538, population: 390000, zone: 'East', open_issues: 12, resolved_issues: 198, health_score: 82, dominant_category: 'Parks' },
  { ward_id: 5, ward_name: 'Uppal', lat: 17.401, lng: 78.5597, population: 410000, zone: 'East', open_issues: 35, resolved_issues: 142, health_score: 51, dominant_category: 'Traffic' },
  { ward_id: 6, ward_name: 'Serilingampally', lat: 17.4889, lng: 78.3277, population: 620000, zone: 'West', open_issues: 8, resolved_issues: 245, health_score: 88, dominant_category: 'Street Lighting' },
  { ward_id: 7, ward_name: 'Malakpet', lat: 17.377, lng: 78.5003, population: 280000, zone: 'South', open_issues: 48, resolved_issues: 95, health_score: 38, dominant_category: 'Public Health' },
  { ward_id: 8, ward_name: 'Ameerpet', lat: 17.4374, lng: 78.4487, population: 350000, zone: 'Central', open_issues: 22, resolved_issues: 167, health_score: 65, dominant_category: 'HMWSSB' },
  { ward_id: 9, ward_name: 'Saidabad', lat: 17.3525, lng: 78.5145, population: 265000, zone: 'South', open_issues: 31, resolved_issues: 112, health_score: 44, dominant_category: 'Drainage' },
  { ward_id: 10, ward_name: 'Falaknuma', lat: 17.3382, lng: 78.4655, population: 218000, zone: 'South', open_issues: 39, resolved_issues: 88, health_score: 36, dominant_category: 'Sanitation' },
  { ward_id: 11, ward_name: 'Rajendranagar', lat: 17.3488, lng: 78.4285, population: 295000, zone: 'South', open_issues: 19, resolved_issues: 134, health_score: 61, dominant_category: 'Roads' },
  { ward_id: 12, ward_name: 'Khairatabad', lat: 17.4152, lng: 78.462, population: 385000, zone: 'Central', open_issues: 26, resolved_issues: 175, health_score: 62, dominant_category: 'Traffic' },
  { ward_id: 13, ward_name: 'Nampally', lat: 17.392, lng: 78.4685, population: 242000, zone: 'Central', open_issues: 33, resolved_issues: 121, health_score: 48, dominant_category: 'Roads' },
  { ward_id: 14, ward_name: 'Mehdipatnam', lat: 17.3845, lng: 78.442, population: 318000, zone: 'Central', open_issues: 24, resolved_issues: 149, health_score: 59, dominant_category: 'HMWSSB' },
  { ward_id: 15, ward_name: 'Malkajgiri', lat: 17.4548, lng: 78.5355, population: 452000, zone: 'North', open_issues: 21, resolved_issues: 188, health_score: 68, dominant_category: 'Sanitation' },
  { ward_id: 16, ward_name: 'Alwal', lat: 17.5055, lng: 78.512, population: 378000, zone: 'North', open_issues: 15, resolved_issues: 201, health_score: 76, dominant_category: 'Parks' },
  { ward_id: 17, ward_name: 'Hayathnagar', lat: 17.3285, lng: 78.592, population: 336000, zone: 'East', open_issues: 27, resolved_issues: 156, health_score: 55, dominant_category: 'Drainage' },
  { ward_id: 18, ward_name: 'Kapra', lat: 17.472, lng: 78.568, population: 362000, zone: 'East', open_issues: 17, resolved_issues: 172, health_score: 71, dominant_category: 'Street Lighting' },
  { ward_id: 19, ward_name: 'Miyapur', lat: 17.4965, lng: 78.358, population: 518000, zone: 'West', open_issues: 14, resolved_issues: 220, health_score: 79, dominant_category: 'Roads' },
  { ward_id: 20, ward_name: 'Gachibowli', lat: 17.4405, lng: 78.3485, population: 405000, zone: 'West', open_issues: 11, resolved_issues: 235, health_score: 85, dominant_category: 'IT Corridor' },
];

/** Default map view framing all GHMC areas. */
export const HYDERABAD_MAP_VIEW = {
  longitude: 78.47,
  latitude: 17.41,
  zoom: 10.15,
  pitch: 42,
  bearing: -18,
};
