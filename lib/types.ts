export type Metric = {
  value: number | null;
  source: string;
  reason: string | null;
  measuredAt: string | null;
  previous?: number | null;
  change?: number | null;
};
export type Site = {
  id: string;
  name: string;
  repository: string;
  url: string | null;
  category: string;
  color: string;
  envPrefix: string;
  business: string[];
  ga4Property: string;
  vercelProject: string;
  sentryProject: string;
};
export type Breakdown = { label: string; value: number };
export type Row = {
  site: Site;
  metrics: Record<string, Metric>;
  traffic: {
    visitors: Metric;
    pageviews: Metric;
    live: Metric;
    status: string;
    series: { date: string; views: number; visitors: number }[];
    topPages: Breakdown[];
    sources: Breakdown[];
    devices: Breakdown[];
  };
  git: {
    status: string;
    failures: Metric;
    activity: { title: string; date: string; url: string; kind: string }[];
    runs?: { title: string; state: string; url: string; date: string }[];
  };
  deployment: {
    status: string;
    deployments: {
      id: string;
      state: string;
      date: string;
      url: string;
      target: string;
    }[];
  };
  health: {
    status: string;
    reason: string | null;
    response: Metric;
    availability: Metric;
    samples: number;
    unknownSamples?: number;
    truncated?: boolean;
    checkedAt: string | null;
    series: {
      status: string;
      response_ms: number | null;
      checked_at: string;
    }[];
  };
  archive: {
    status: string;
    rows: {
      day: string;
      metrics: Record<string, Metric>;
      captured_at: string;
    }[];
  };
  paymentAmounts: { currency: string; minorUnits: number }[];
};
export type DashboardData = {
  rows: Row[];
  sites: Site[];
  range: {
    period: string;
    days: number;
    start: string;
    end: string;
    previousStart: string;
    previousEnd: string;
  };
  registryStatus: string;
  refreshedAt: string;
};
export type Connection<T> =
  | { status: "Unavailable"; reason: string; items: never[]; measuredAt: null }
  | ({ status: "Connected"; reason: null; measuredAt: string } & T);
export type CalendarEvent = {
  id: string;
  title: string;
  start: string;
  end: string;
  business: string;
  source: string;
  url: string;
  location?: string;
};
export type PaymentConnection = Connection<{
  items: {
    id: string;
    amount: number;
    currency: string;
    status: string;
    date: string;
  }[];
  accountId: string;
  hasMore: boolean;
}>;
export type OperationsData = {
  bookings: Connection<{ items: CalendarEvent[] }>;
  coachPayments: PaymentConnection;
  dmvPayments: PaymentConnection;
  records: Connection<{
    items: {
      id: string;
      athlete_first_name: string;
      athlete_last_name: string;
      age_group: string;
      payment_status: string;
    }[];
    teams: {
      id: string;
      name: string;
      age_group: string;
      season: string;
      active: boolean;
    }[];
    fees: { id: string; outstanding: number }[];
  }>;
  nova: Connection<{
    items: never[];
    finals: number;
    overdue: number;
    calculatedAt: string;
    throughDate: string;
    stale: boolean;
    unresolved: Record<string, number>;
    playoff: { regions: number; ratedSchools: number };
    officialSeedsVerified: boolean;
  }>;
  tournaments: CalendarEvent[];
};
