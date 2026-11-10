const CYCLING_TYPES = new Set(['Ride', 'VirtualRide', 'GravelRide', 'MountainBikeRide', 'EBikeRide', 'TrackRide']);

export const isCycling = (type: string | null | undefined): boolean => !!type && CYCLING_TYPES.has(type);
