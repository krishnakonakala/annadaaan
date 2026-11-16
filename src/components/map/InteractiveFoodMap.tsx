import React, { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import { useApp } from '../../services/store.tsx';
import { Filter, MapPin, HeartHandshake, Truck, Clock } from 'lucide-react';

export const InteractiveFoodMap: React.FC<{
  selectedDonationId?: string;
  onSelectDonation?: (id: string) => void;
  heightClass?: string;
}> = ({ onSelectDonation, heightClass = 'h-[500px]' }) => {
  const { allUsers, donations, assignments } = useApp();
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const markersLayerRef = useRef<L.LayerGroup | null>(null);
  const [activeFilter, setActiveFilter] = useState<'ALL' | 'FOOD' | 'NGO' | 'VOLUNTEER'>('ALL');
  const [selectedEntityInfo, setSelectedEntityInfo] = useState<{
    title: string;
    subtitle: string;
    type: string;
    details: string;
  } | null>(null);

  useEffect(() => {
    if (!mapContainerRef.current) return;
    if (mapInstanceRef.current) return;

    const map = L.map(mapContainerRef.current, {
      center: [16.4649, 80.5320],
      zoom: 13,
      zoomControl: false,
      attributionControl: false,
    });

    L.control.zoom({ position: 'bottomright' }).addTo(map);

    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
    }).addTo(map);

    markersLayerRef.current = L.layerGroup().addTo(map);
    mapInstanceRef.current = map;

    return () => {
      map.remove();
      mapInstanceRef.current = null;
    };
  }, []);

  useEffect(() => {
    const map = mapInstanceRef.current;
    const layer = markersLayerRef.current;
    if (!map || !layer) return;

    layer.clearLayers();

    if (activeFilter === 'ALL' || activeFilter === 'NGO') {
      const ngos = allUsers.filter(
        (u) => u.role === 'ROLE_NGO' && u.verificationStatus === 'APPROVED'
      );
      ngos.forEach((ngo) => {
        const customIcon = L.divIcon({
          className: 'custom-map-marker',
          html: `
            <div class="flex items-center justify-center w-8 h-8 rounded-full bg-emerald-950 border-2 border-emerald-400 text-emerald-300 shadow-lg cursor-pointer">
              <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z"/></svg>
            </div>
          `,
          iconSize: [32, 32],
          iconAnchor: [16, 16],
        });

        const marker = L.marker([ngo.location.latitude, ngo.location.longitude], {
          icon: customIcon,
        });
        marker.bindPopup(`
          <div class="p-1">
            <div class="text-[10px] font-semibold text-emerald-400 mb-0.5">${
              ngo.organizationType || 'APPROVED NGO'
            }</div>
            <h4 class="font-bold text-sm mb-0.5">${ngo.organizationName || ngo.name}</h4>
            <p class="text-xs opacity-80 mb-1">${ngo.location.address}</p>
            <div class="text-[11px] opacity-80">Capacity: ${
              ngo.currentAvailableCapacityKg
            } kg · ${ngo.beneficiariesCount || 50} beneficiaries</div>
          </div>
        `);

        marker.on('click', () => {
          setSelectedEntityInfo({
            title: ngo.organizationName || ngo.name,
            subtitle: `${ngo.organizationType || 'Approved NGO'} · Capacity: ${
              ngo.currentAvailableCapacityKg
            } kg`,
            type: 'NGO',
            details: `${ngo.location.address}, ${ngo.location.city}`,
          });
        });

        layer.addLayer(marker);
      });
    }

    if (activeFilter === 'ALL' || activeFilter === 'FOOD') {
      donations.forEach((donation) => {
        if (['EXPIRED', 'COMPLETED', 'CANCELLED', 'REJECTED'].includes(donation.status))
          return;

        const customIcon = L.divIcon({
          className: 'custom-map-marker',
          html: `
            <div class="relative flex items-center justify-center w-9 h-9 rounded-full bg-amber-950 border-2 border-amber-400 text-amber-300 shadow-lg cursor-pointer">
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 8h1a4 4 0 0 1 0 8h-1"/><path d="M2 8h16v9a4 4 0 0 1-4 4H6a4 4 0 0 1-4-4V8z"/></svg>
              <span class="absolute -top-1 -right-1 px-1 text-[9px] rounded bg-amber-500 text-black font-bold">${donation.quantityKg}kg</span>
            </div>
          `,
          iconSize: [36, 36],
          iconAnchor: [18, 18],
        });

        const marker = L.marker(
          [donation.pickupLocation.latitude, donation.pickupLocation.longitude],
          { icon: customIcon }
        );
        marker.bindPopup(`
          <div class="p-1">
            <div class="text-[10px] font-bold text-amber-400 mb-0.5">${donation.status} · ${
              donation.isVegetarian ? 'VEG' : 'NON-VEG'
            }</div>
            <h4 class="font-bold text-sm mb-0.5">${donation.title}</h4>
            <p class="text-xs opacity-80 mb-1">${donation.donorName}</p>
            <div class="text-[11px] opacity-80">${donation.quantityKg} kg · ${
              donation.estimatedServings
            } servings</div>
          </div>
        `);

        marker.on('click', () => {
          if (onSelectDonation) onSelectDonation(donation.id);
          setSelectedEntityInfo({
            title: donation.title,
            subtitle: `${donation.donorName} · ${donation.quantityKg} kg`,
            type: 'DONATION',
            details: `${donation.pickupLocation.address}, ${donation.pickupLocation.city}`,
          });
        });

        layer.addLayer(marker);
      });
    }

    if (activeFilter === 'ALL' || activeFilter === 'VOLUNTEER') {
      assignments.forEach((asg) => {
        if (asg.status === 'PICKED_UP') {
          const polyline = L.polyline([asg.pickupCoordinates, asg.deliveryCoordinates], {
            color: '#38bdf8',
            weight: 3,
            dashArray: '8, 8',
            opacity: 0.85,
          });
          layer.addLayer(polyline);

          const midLat = (asg.pickupCoordinates[0] + asg.deliveryCoordinates[0]) / 2;
          const midLng = (asg.pickupCoordinates[1] + asg.deliveryCoordinates[1]) / 2;

          const volIcon = L.divIcon({
            className: 'custom-map-marker',
            html: `
              <div class="flex items-center justify-center w-8 h-8 rounded-full bg-sky-950 border-2 border-sky-400 text-sky-300 shadow-lg">
                <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 17h2c.6 0 1-.4 1-1v-3c0-.9-.7-1.7-1.5-1.9C18.7 10.6 16 10 16 10s-1.3-1.4-2.2-2.3c-.5-.4-1.1-.7-1.8-.7H5c-.6 0-1 .4-1 1v10c0 .6.4 1 1 1h2"/><circle cx="7" cy="17" r="2"/><path d="M9 17h6"/><circle cx="17" cy="17" r="2"/></svg>
              </div>
            `,
            iconSize: [32, 32],
            iconAnchor: [16, 16],
          });

          const volMarker = L.marker([midLat, midLng], { icon: volIcon });
          volMarker.bindPopup(`
            <div class="p-1">
              <div class="text-[10px] font-bold text-sky-400 mb-0.5">IN TRANSIT</div>
              <h4 class="font-bold text-sm mb-0.5">${asg.volunteerName}</h4>
              <p class="text-xs opacity-80">${asg.donorName} → ${asg.ngoName}</p>
            </div>
          `);
          layer.addLayer(volMarker);
        }
      });
    }
  }, [allUsers, donations, assignments, activeFilter, onSelectDonation]);

  return (
    <div className="relative w-full rounded-xl overflow-hidden border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950">
      <div className="absolute top-3 left-3 right-3 z-[1000] flex flex-wrap items-center justify-between gap-2 pointer-events-none">
        <div className="flex items-center gap-1 bg-white/95 dark:bg-zinc-900/95 backdrop-blur-md p-1 rounded-lg border border-zinc-200 dark:border-zinc-800 shadow-lg pointer-events-auto">
          <Filter className="w-3.5 h-3.5 text-zinc-500 mx-1.5" />
          {[
            { id: 'ALL', label: 'All Nodes' },
            {
              id: 'FOOD',
              label: `Food (${donations.filter((d) => ['AVAILABLE', 'REQUESTED'].includes(d.status)).length})`,
            },
            {
              id: 'NGO',
              label: `NGOs (${allUsers.filter((u) => u.role === 'ROLE_NGO' && u.verificationStatus === 'APPROVED').length})`,
            },
            { id: 'VOLUNTEER', label: 'Routes' },
          ].map((btn) => (
            <button
              key={btn.id}
              type="button"
              onClick={() => setActiveFilter(btn.id as typeof activeFilter)}
              className={`px-2.5 py-1 text-xs font-semibold rounded-md transition-colors whitespace-nowrap ${
                activeFilter === btn.id
                  ? 'bg-emerald-500 text-zinc-950'
                  : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white'
              }`}
            >
              {btn.label}
            </button>
          ))}
        </div>
      </div>

      <div ref={mapContainerRef} className={`w-full ${heightClass} z-0`} />

      {selectedEntityInfo && (
        <div className="absolute bottom-3 left-3 right-3 md:right-auto md:w-96 z-[1000] bg-white/95 dark:bg-zinc-900/95 backdrop-blur-md border border-zinc-200 dark:border-zinc-800 rounded-xl p-3.5 shadow-xl">
          <div className="flex items-start justify-between gap-2">
            <div className="flex items-center gap-2.5">
              <div className="p-1.5 rounded-lg bg-emerald-500/10 text-emerald-500">
                {selectedEntityInfo.type === 'NGO' ? (
                  <HeartHandshake className="w-4 h-4" />
                ) : selectedEntityInfo.type === 'DONATION' ? (
                  <Clock className="w-4 h-4" />
                ) : (
                  <Truck className="w-4 h-4" />
                )}
              </div>
              <div>
                <h4 className="text-sm font-bold text-zinc-900 dark:text-zinc-100">
                  {selectedEntityInfo.title}
                </h4>
                <p className="text-xs text-zinc-500 dark:text-zinc-400">
                  {selectedEntityInfo.subtitle}
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setSelectedEntityInfo(null)}
              className="text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 text-xs font-bold px-1"
            >
              ✕
            </button>
          </div>
          <p className="mt-2 text-xs text-zinc-600 dark:text-zinc-300 border-t border-zinc-200 dark:border-zinc-800 pt-2 flex items-center gap-1.5">
            <MapPin className="w-3.5 h-3.5 text-zinc-400 shrink-0" />
            <span className="truncate">{selectedEntityInfo.details}</span>
          </p>
        </div>
      )}
    </div>
  );
};
