import { useRef, useEffect, useState } from 'react';
import Map, { Marker } from 'react-map-gl/maplibre';
import 'maplibre-gl/dist/maplibre-gl.css';
import { MapPin } from 'lucide-react';

const MAP_STYLE = 'https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json';

const HYDERABAD_REGIONS = [
  {
    id: 'tolichowki',
    name: 'Tolichowki',
    coords: [78.4005, 17.3984],
    status: 'Needs Attention',
    statusColor: 'amber',
    received: 1240,
    solved: 890,
    issue: 'Frequent drainage overflow and water logging.',
    avgFixTime: '4 days',
    resolutionRate: '71%',
    sdg: 'SDG-06: Clean Water',
  },
  {
    id: 'hitech',
    name: 'Hitech City',
    coords: [78.3812, 17.4435],
    status: 'Critical',
    statusColor: 'red',
    received: 3450,
    solved: 1200,
    issue: 'High structural stress on utility grids.',
    avgFixTime: '9 days',
    resolutionRate: '34%',
    sdg: 'SDG-09: Innovation',
  },
  {
    id: 'charminar',
    name: 'Charminar',
    coords: [78.4747, 17.3616],
    status: 'Needs Attention',
    statusColor: 'amber',
    received: 2100,
    solved: 1850,
    issue: 'Waste collection delays in heritage zones.',
    avgFixTime: '3 days',
    resolutionRate: '88%',
    sdg: 'SDG-11: Sustainable Cities',
  },
  {
    id: 'banjara',
    name: 'Banjara Hills',
    coords: [78.4232, 17.4156],
    status: 'Healthy',
    statusColor: 'green',
    received: 450,
    solved: 430,
    issue: 'Minor infrastructure maintenance scheduled.',
    avgFixTime: '24 hours',
    resolutionRate: '95%',
    sdg: 'SDG-11: Sustainable Cities',
  },
  {
    id: 'kukatpally',
    name: 'Kukatpally',
    coords: [78.4038, 17.4849],
    status: 'Monitored',
    statusColor: 'cyan',
    received: 1890,
    solved: 1560,
    issue: 'Routine monitoring of public works.',
    avgFixTime: '2 days',
    resolutionRate: '82%',
    sdg: 'SDG-16: Strong Institutions',
  },
  {
    id: 'secunderabad',
    name: 'Secunderabad',
    coords: [78.5016, 17.4399],
    status: 'Needs Attention',
    statusColor: 'amber',
    received: 2800,
    solved: 2100,
    issue: 'Persistent traffic gridlock reports.',
    avgFixTime: '5 days',
    resolutionRate: '75%',
    sdg: 'SDG-11: Sustainable Cities',
  },
  {
    id: 'miyapur',
    name: 'Miyapur',
    coords: [78.3489, 17.4933],
    status: 'Critical',
    statusColor: 'red',
    received: 1560,
    solved: 800,
    issue: 'Severe pothole density on main roads.',
    avgFixTime: '12 days',
    resolutionRate: '51%',
    sdg: 'SDG-09: Infrastructure',
  },
  {
    id: 'lbnagar',
    name: 'LB Nagar',
    coords: [78.5495, 17.3457],
    status: 'Needs Attention',
    statusColor: 'amber',
    received: 1950,
    solved: 1400,
    issue: 'Seasonal water logging in low-lying areas.',
    avgFixTime: '4 days',
    resolutionRate: '71%',
    sdg: 'SDG-06: Clean Water',
  },
];

const INITIAL_VIEW_STATE = {
  longitude: 78.45,
  latitude: 17.41,
  zoom: 11.5,
  pitch: 45,
  bearing: -10,
};

const HYDERABAD_BOUNDS = [
  [78.2, 17.2],
  [78.7, 17.65],
];

export default function LandingMapPanel({ activeSection }) {
  const mapRef = useRef(null);
  const [hoveredRegion, setHoveredRegion] = useState(null);
  const [selectedRegion, setSelectedRegion] = useState(null);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    switch (activeSection) {
      case 0:
        map.flyTo({
          center: [78.45, 17.41],
          zoom: 11.5,
          pitch: 45,
          bearing: -10,
          duration: 4000,
          essential: true,
        });
        break;
      case 1:
        map.flyTo({
          center: [78.4005, 17.3984],
          zoom: 12.5,
          pitch: 50,
          bearing: 0,
          duration: 4000,
          essential: true,
        });
        break;
      case 2:
        map.flyTo({
          center: [78.3812, 17.4435],
          zoom: 12.5,
          pitch: 30,
          bearing: 15,
          duration: 4000,
          essential: true,
        });
        break;
      case 3:
        map.flyTo({
          center: [78.45, 17.41],
          zoom: 11.5,
          pitch: 20,
          bearing: 0,
          duration: 4000,
          essential: true,
        });
        break;
      default:
        break;
    }
  }, [activeSection]);

  return (
    <div className="relative h-full w-full overflow-hidden border-l border-border/50 bg-background shadow-[-10px_0_30px_rgba(0,0,0,0.8)]">
      <div className="pointer-events-none absolute inset-0 z-10 shadow-[inset_0_0_100px_rgba(5,5,5,1)]" />

      <div className="pointer-events-none absolute left-8 top-8 z-20">
        <h3 className="font-mono text-xs font-black uppercase tracking-[0.3em] text-white/40">
          Nagar Rakshak // Live City Matrix
        </h3>
      </div>

      <Map
        ref={mapRef}
        initialViewState={INITIAL_VIEW_STATE}
        mapStyle={MAP_STYLE}
        maxBounds={HYDERABAD_BOUNDS}
        maxZoom={14}
        attributionControl={false}
        antialias
        style={{ width: '100%', height: '100%' }}
        onClick={() => setSelectedRegion(null)}
      >
        {HYDERABAD_REGIONS.map((region) => {
          const isSelected = selectedRegion === region.id;
          const isHovered = hoveredRegion === region.id;
          const showTooltip = isHovered || isSelected;

          let pinColorClass = 'text-accent-cyan drop-shadow-[0_0_10px_rgba(0,229,255,0.8)]';
          let glowColor = 'bg-accent-cyan';
          if (region.statusColor === 'red') {
            pinColorClass = 'text-accent-red drop-shadow-[0_0_10px_rgba(255,61,0,0.8)]';
            glowColor = 'bg-accent-red';
          } else if (region.statusColor === 'amber') {
            pinColorClass = 'text-accent-amber drop-shadow-[0_0_10px_rgba(255,179,0,0.8)]';
            glowColor = 'bg-accent-amber';
          } else if (region.statusColor === 'green') {
            pinColorClass = 'text-accent-green drop-shadow-[0_0_10px_rgba(0,230,118,0.8)]';
            glowColor = 'bg-accent-green';
          }

          return (
            <Marker
              key={region.id}
              longitude={region.coords[0]}
              latitude={region.coords[1]}
              anchor="center"
              onClick={(e) => {
                e.originalEvent.stopPropagation();
                if (selectedRegion === region.id) {
                  setSelectedRegion(null);
                } else {
                  setSelectedRegion(region.id);
                  mapRef.current?.flyTo({
                    center: region.coords,
                    zoom: 13,
                    pitch: 45,
                    duration: 1500,
                  });
                }
              }}
            >
              <div
                className="group relative cursor-pointer"
                onMouseEnter={() => setHoveredRegion(region.id)}
                onMouseLeave={() => setHoveredRegion(null)}
              >
                <div
                  className={`relative z-30 flex origin-bottom items-center justify-center transition-transform duration-300 ${
                    isHovered ? 'scale-110 -translate-y-1' : 'scale-100'
                  }`}
                >
                  <div
                    className={`absolute -inset-4 rounded-full ${glowColor} opacity-10 duration-1000 animate-ping ${
                      isHovered ? 'opacity-30' : ''
                    }`}
                  />
                  <div className={`relative ${pinColorClass}`}>
                    <MapPin className="h-8 w-8 fill-background/80" />
                    <div className="absolute left-1/2 top-2 h-1.5 w-1.5 -translate-x-1/2 rounded-full bg-white shadow-[0_0_5px_#fff]" />
                  </div>
                </div>

                <div
                  className={`pointer-events-none absolute bottom-0 left-12 z-20 w-[300px] rounded-lg border border-border bg-surface/95 p-4 shadow-[0_20px_50px_rgba(0,0,0,0.9)] backdrop-blur-xl transition-all duration-300 ${
                    showTooltip ? 'translate-x-0 opacity-100' : '-translate-x-3 opacity-0'
                  }`}
                >
                  <div className="mb-3 flex items-start justify-between border-b border-border pb-2">
                    <div>
                      <span className="mb-0.5 block font-mono text-[8px] tracking-widest text-gray-500">
                        AREA
                      </span>
                      <h4 className="font-mono text-xs font-black uppercase tracking-widest text-white">
                        {region.name}
                      </h4>
                    </div>
                    <span
                      className={`inline-block rounded border px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-wider ${
                        region.statusColor === 'red'
                          ? 'border-accent-red/30 bg-accent-red/10 text-accent-red'
                          : region.statusColor === 'amber'
                            ? 'border-accent-amber/30 bg-accent-amber/10 text-accent-amber'
                            : region.statusColor === 'green'
                              ? 'border-accent-green/30 bg-accent-green/10 text-accent-green'
                              : 'border-accent-cyan/30 bg-accent-cyan/10 text-accent-cyan'
                      }`}
                    >
                      {region.status}
                    </span>
                  </div>

                  <p className="mb-3 font-mono text-[10px] leading-relaxed text-gray-300">{region.issue}</p>

                  <div className="grid grid-cols-2 gap-2 font-mono text-[10px]">
                    <div className="border border-border bg-background/40 p-2">
                      <span className="mb-1 block text-[8px] uppercase text-gray-500">Complaints</span>
                      <span className="font-bold text-white">{region.received.toLocaleString()}</span>
                    </div>
                    <div className="border border-border bg-background/40 p-2">
                      <span className="mb-1 block text-[8px] uppercase text-gray-500">Resolved</span>
                      <span className="font-bold text-white">{region.solved.toLocaleString()}</span>
                    </div>
                    <div className="border border-border bg-background/40 p-2">
                      <span className="mb-1 block text-[8px] uppercase text-gray-500">Avg fix</span>
                      <span className="font-bold text-white">{region.avgFixTime}</span>
                    </div>
                    <div className="border border-border bg-background/40 p-2">
                      <span className="mb-1 block text-[8px] uppercase text-gray-500">Resolution</span>
                      <span className="font-bold text-white">{region.resolutionRate}</span>
                    </div>
                  </div>

                  <div className="mt-2 flex items-center justify-between border-t border-border pt-2 font-mono text-[9px]">
                    <span className="uppercase text-gray-500">Impact</span>
                    <span className="font-bold text-accent-cyan">{region.sdg}</span>
                  </div>
                </div>
              </div>
            </Marker>
          );
        })}
      </Map>
    </div>
  );
}
