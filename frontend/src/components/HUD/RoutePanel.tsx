import React, { useState } from 'react';
import { useGameStore } from '../../stores/useGameStore';
import { clientPathfinder } from '../../services/pathfinding';
import { Navigation, Zap, Accessibility, Footprints, X, ChevronDown, MapPin, Clock, Route as RouteIcon } from 'lucide-react';

const DESTINATIONS = [
  { id: 'n_f1_r101_inside', name: 'Room 101 - Robotics Lab', floor: 1 },
  { id: 'n_f1_r102_inside', name: 'Room 102 - IoT Studio', floor: 1 },
  { id: 'n_f1_r103_inside', name: 'Room 103 - Admin & Registration', floor: 1 },
  { id: 'n_f2_r201_inside', name: 'Room 201 - AI & Data Science', floor: 2 },
  { id: 'n_f2_r202_inside', name: 'Room 202 - Seminar Hall', floor: 2 },
  { id: 'n_f2_r203_inside', name: 'Room 203 - Cyber Security', floor: 2 },
  { id: 'n_f3_r301_inside', name: 'Room 301 - Innovation Incubation', floor: 3 },
  { id: 'n_f3_r302_inside', name: 'Room 302 - Executive Board', floor: 3 },
  { id: 'n_f3_r303_inside', name: 'Room 303 - Dean & Faculty Lounge', floor: 3 },
  { id: 'n_f1_entrance', name: 'Main South Entrance', floor: 1 },
];

export const RoutePanel: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [selectedDestId, setSelectedDestId] = useState<string>(DESTINATIONS[6].id); // Room 301 default
  const [loading, setLoading] = useState(false);

  const playerPos = useGameStore((state) => state.playerPosition);
  const currentFloor = useGameStore((state) => state.currentFloor);
  const availableRoutes = useGameStore((state) => state.availableRoutes);
  const activeRoute = useGameStore((state) => state.activeRoute);
  const selectedProfile = useGameStore((state) => state.selectedProfile);
  const isNavigating = useGameStore((state) => state.isNavigating);
  const targetPOIName = useGameStore((state) => state.targetPOIName);

  const setRoutes = useGameStore((state) => state.setRoutes);
  const selectProfile = useGameStore((state) => state.selectProfile);
  const clearNavigation = useGameStore((state) => state.clearNavigation);
  const setNotification = useGameStore((state) => state.setNotification);

  const handleComputeRoute = async () => {
    const dest = DESTINATIONS.find((d) => d.id === selectedDestId);
    if (!dest) return;

    setLoading(true);
    try {
      const response = await clientPathfinder.getRoutes(
        playerPos.x,
        playerPos.y,
        playerPos.z,
        dest.id,
        currentFloor
      );

      if (response.routes.length > 0) {
        setRoutes(response.routes, dest.id, dest.name);
        setNotification(`Route computed to ${dest.name}! (${response.routes.length} options available)`);
        setIsOpen(true);
      } else {
        setNotification(`No walkable route found to ${dest.name}`);
      }
    } catch (err) {
      console.error('Route calculation failed:', err);
      setNotification('Failed to compute route.');
    } finally {
      setLoading(false);
    }
  };

  const handleClear = () => {
    clearNavigation();
    setNotification('Navigation cleared.');
  };

  return (
    <div className="pointer-events-auto flex flex-col items-start gap-2">
      {/* Navigation Trigger Button */}
      {!isOpen && (
        <button
          onClick={() => setIsOpen(true)}
          className="glass-panel px-4 py-2.5 flex items-center gap-2.5 text-cyan-300 hover:text-white hover:border-cyan-400 transition-all shadow-lg hover:shadow-cyan-500/20 group"
        >
          <div className="p-1.5 rounded-lg bg-cyan-500/20 text-cyan-400 group-hover:bg-cyan-500 group-hover:text-black transition-colors">
            <Navigation size={18} />
          </div>
          <div className="text-left">
            <div className="text-[10px] uppercase font-bold tracking-wider text-slate-400">
              Indoor Wayfinder
            </div>
            <div className="text-xs font-bold text-white">
              {isNavigating ? `Navigating to ${targetPOIName}` : 'Search Destination'}
            </div>
          </div>
        </button>
      )}

      {/* Expanded Route Selection & Comparison Modal */}
      {isOpen && (
        <div className="glass-panel p-5 w-84 md:w-96 flex flex-col gap-4 border-cyan-500/40 animate-fade-in shadow-2xl">
          {/* Header */}
          <div className="flex items-center justify-between border-b border-slate-700/60 pb-3">
            <div className="flex items-center gap-2 text-cyan-400">
              <RouteIcon size={20} />
              <span className="font-bold text-sm tracking-wide text-white">
                3D Indoor Wayfinder
              </span>
            </div>
            <button
              onClick={() => setIsOpen(false)}
              className="text-slate-400 hover:text-white p-1 rounded hover:bg-slate-800 transition"
            >
              <X size={18} />
            </button>
          </div>

          {/* Destination Selector */}
          <div className="flex flex-col gap-1.5">
            <label className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
              <MapPin size={13} className="text-cyan-400" /> Select Destination
            </label>
            <div className="relative">
              <select
                value={selectedDestId}
                onChange={(e) => setSelectedDestId(e.target.value)}
                className="w-full appearance-none bg-slate-900/90 border border-slate-700 rounded-lg px-3 py-2.5 text-xs font-medium text-white focus:outline-none focus:border-cyan-400 cursor-pointer pr-8"
              >
                {DESTINATIONS.map((d) => (
                  <option key={d.id} value={d.id} className="bg-slate-900 text-white">
                    {d.name} (Floor {d.floor})
                  </option>
                ))}
              </select>
              <ChevronDown
                size={16}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none"
              />
            </div>
          </div>

          {/* Route Profile Criteria Tabs */}
          {availableRoutes.length > 0 && (
            <div className="flex flex-col gap-2">
              <label className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                Route Profiles ({availableRoutes.length} options)
              </label>
              <div className="grid grid-cols-3 gap-1.5 p-1 bg-slate-950/80 rounded-lg border border-slate-800">
                {/* Fastest */}
                <button
                  onClick={() => selectProfile('fastest')}
                  className={`px-2 py-2 rounded-md text-[11px] font-bold flex flex-col items-center gap-1 transition-all ${
                    selectedProfile === 'fastest'
                      ? 'bg-cyan-500 text-black shadow-md shadow-cyan-500/30'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  <Zap size={14} />
                  <span>Fastest</span>
                </button>

                {/* Accessible / Elevator */}
                <button
                  onClick={() => selectProfile('avoid_stairs')}
                  className={`px-2 py-2 rounded-md text-[11px] font-bold flex flex-col items-center gap-1 transition-all ${
                    selectedProfile === 'avoid_stairs'
                      ? 'bg-cyan-500 text-black shadow-md shadow-cyan-500/30'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  <Accessibility size={14} />
                  <span>Elevator</span>
                </button>

                {/* Stairs Only */}
                <button
                  onClick={() => selectProfile('stairs_only')}
                  className={`px-2 py-2 rounded-md text-[11px] font-bold flex flex-col items-center gap-1 transition-all ${
                    selectedProfile === 'stairs_only'
                      ? 'bg-cyan-500 text-black shadow-md shadow-cyan-500/30'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  <Footprints size={14} />
                  <span>Stairs</span>
                </button>
              </div>
            </div>
          )}

          {/* Active Route Telemetry Summary */}
          {activeRoute && (
            <div className="p-3.5 rounded-lg bg-slate-900/80 border border-cyan-500/30 flex flex-col gap-2">
              <div className="flex items-center justify-between text-xs font-bold text-cyan-300">
                <span>{activeRoute.title}</span>
                <span className="mono text-[11px] px-2 py-0.5 rounded bg-cyan-950 border border-cyan-400/40 text-cyan-200">
                  {activeRoute.floor_transitions.length > 1
                    ? `Floors: ${activeRoute.floor_transitions.join(' → ')}`
                    : `Floor ${activeRoute.floor_transitions[0]}`}
                </span>
              </div>

              <div className="grid grid-cols-2 gap-2 text-slate-300 text-xs mt-1">
                <div className="flex items-center gap-1.5">
                  <RouteIcon size={14} className="text-cyan-400" />
                  <span>Distance:</span>
                  <span className="mono font-bold text-white">
                    {activeRoute.total_distance_meters}m
                  </span>
                </div>
                <div className="flex items-center gap-1.5">
                  <Clock size={14} className="text-blue-400" />
                  <span>ETA:</span>
                  <span className="mono font-bold text-white">
                    {Math.floor(activeRoute.estimated_time_seconds / 60) > 0
                      ? `${Math.floor(activeRoute.estimated_time_seconds / 60)}m `
                      : ''}
                    {activeRoute.estimated_time_seconds % 60}s
                  </span>
                </div>
              </div>

              <div className="text-[11px] text-slate-400 flex items-center gap-2 mt-1">
                <span className="w-1.5 h-1.5 rounded-full bg-cyan-400"></span>
                <span>
                  Uses:{' '}
                  {activeRoute.uses_stairs && activeRoute.uses_elevator
                    ? 'Stairs & Elevator'
                    : activeRoute.uses_stairs
                    ? 'Stairs only (No elevator)'
                    : activeRoute.uses_elevator
                    ? 'Elevator only (Accessible)'
                    : 'Flat corridor'}
                </span>
              </div>
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex gap-2 pt-1">
            <button
              onClick={handleComputeRoute}
              disabled={loading}
              className="flex-1 py-2.5 rounded-lg bg-gradient-to-r from-cyan-500 to-blue-600 text-black font-bold text-xs uppercase tracking-wider hover:opacity-90 transition shadow-lg shadow-cyan-500/20 disabled:opacity-50"
            >
              {loading ? 'Calculating...' : isNavigating ? 'Recalculate Route' : 'Find Route'}
            </button>

            {isNavigating && (
              <button
                onClick={handleClear}
                className="px-3.5 py-2.5 rounded-lg bg-slate-800 text-slate-300 hover:text-white hover:bg-slate-700 text-xs font-semibold transition"
              >
                Clear
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
