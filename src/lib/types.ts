export interface Trip {
  id: string;
  name: string;
  startDate: string;
  endDate: string;
  budgetTotal: number;
  travelers: number;
  vehicleMpg: number;
  coldThresholdF: number;
  defaultNightlyRate: number;
  stops: Stop[];
}

export interface Stop {
  id: string;
  name: string;
  lat: number;
  lon: number;
  state: string;
  arriveDate: string;
  departDate: string;
  nightlyRate?: number;
  weather?: {
    source: "climate" | "forecast";
    avgHighF: number;
    avgLowF: number;
    isCold: boolean;
    bestMonths?: number[];
  };
}

export interface Leg {
  fromStopId: string;
  toStopId: string;
  miles: number;
  durationHrs: number;
  polyline: [number, number][];
  milesByState: Record<string, number>;
  gasCost: number;
}

// Search responses are separate from the persisted plan data model.
export interface Place {
  id: string;
  name: string;
  label: string;
  lat: number;
  lon: number;
  state: string;
}
