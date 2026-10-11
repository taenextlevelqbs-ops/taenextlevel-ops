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
