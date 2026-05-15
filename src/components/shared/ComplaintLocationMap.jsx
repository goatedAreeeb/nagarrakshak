import { MapPin } from 'lucide-react';
import { cn } from '../../lib/utils';
import MapPreviewPanel from './MapPreviewPanel';

export default function ComplaintLocationMap({ lat, lng, address, className }) {
  if (lat == null || lng == null) return null;

  return (
    <section className={cn('glass-inset overflow-hidden', className)}>
      <div className="flex items-center justify-between gap-3 border-b border-white/10 px-4 py-3">
        <div className="flex min-w-0 items-center gap-2">
          <MapPin size={16} className="shrink-0 text-text-primary" />
          <div className="min-w-0">
            <p className="text-sm font-semibold text-text-primary">Location</p>
            {address && <p className="truncate text-xs text-text-muted">{address}</p>}
          </div>
        </div>
      </div>
      <MapPreviewPanel
        lat={lat}
        lng={lng}
        address={address}
        aspectClass="aspect-[16/10]"
        minHeight="200px"
        roundedClass="rounded-none border-0"
        showHeader={false}
        showActions
        className="border-0"
      />
    </section>
  );
}
