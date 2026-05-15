import { supabase } from './supabase';

function haversineMeters(lat1, lng1, lat2, lng2) {
  const R = 6371000;
  const toRad = (d) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export async function checkDuplicate(lat, lng, dept) {
  const { data, error } = await supabase
    .from('complaints')
    .select('*')
    .in('status', ['open', 'assigned', 'in_progress', 'reopened']);

  if (error || !data?.length) {
    return { isDuplicate: false };
  }

  const nearby = data.filter((c) => {
    if (c.dept !== dept) return false;
    return haversineMeters(lat, lng, c.lat, c.lng) <= 150;
  });

  if (nearby.length === 0) {
    return { isDuplicate: false };
  }

  const master = nearby.sort(
    (a, b) => new Date(a.created_at) - new Date(b.created_at)
  )[0];

  return {
    isDuplicate: true,
    masterId: master.id,
    masterComplaint: master,
  };
}
