export interface TodayCard {
  id: string;
  companyId: number;
  reference: string;
  product: string;
  quantity: string;
  responsible: string;
  status: string;
}

export interface TodayOverview {
  companyId: number;
  now: TodayCard | null;
  next: TodayCard[];
  waiting: TodayCard[];
  labelsReady: TodayCard[];
  clarify: (TodayCard & { reason: string })[];
}
