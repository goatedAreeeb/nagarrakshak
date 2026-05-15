import { Link } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import './civic.css';
import CivicMap from './map/CivicMap';
import MapLegend from './map/MapLegend';
import WardAnalyticsPanel from './panels/WardAnalyticsPanel';
import AreaSearchBar from './search/AreaSearchBar';

export default function CivicDashboard() {
  return (
    <div className="dashboard-layout">
      <Link to="/dashboard" className="civic-back-btn" aria-label="Back to dashboard">
        <ArrowLeft className="civic-back-btn__icon" strokeWidth={2.25} aria-hidden />
        <span>Dashboard</span>
      </Link>
      <CivicMap />
      <AreaSearchBar />
      <MapLegend />
      <WardAnalyticsPanel />
    </div>
  );
}
