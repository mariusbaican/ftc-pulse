/**
 * Strict TypeScript domain models for the FTC BrickBot #15996 Mobile Companion.
 * Matches exact JSON payloads returned by server/app.py, server/services/analytics.py,
 * and server/services/mock_event.py.
 */

export interface HealthResponse {
  status: string;
  season: number;
  targetTeam: number;
  dataSource: 'live_api' | 'fallback_snapshot' | string;
  fetchedAt: string;
  eventsCount: number;
}

export interface TeamProfile {
  teamNumber: number;
  displayTeamNumber: string;
  nameShort: string;
  nameFull: string;
  city: string;
  stateProv: string;
  country: string;
  displayLocation: string;
  rookieYear: number;
  season: number;
  seasonName: string;
}

export interface TeamSearchResponse {
  query: string;
  count: number;
  teams: TeamProfile[];
  pocNotice: string | null;
}

export interface SeasonRecord {
  wins: number;
  losses: number;
  ties: number;
  winRate: number;
  matchesPlayed: number;
}

export interface OprBreakdown {
  totalOpr: number;
  autoOpr: number;
  teleopOpr: number;
  endgameOpr: number;
}

export interface PeriodAverages {
  autoAvg: number;
  teleopAvg: number;
  endgameAvg: number;
  totalAvg: number;
}

export interface BestMatchPerformance {
  score: number;
  nonFoulScore: number;
  matchDescription: string;
  matchNumber: number;
  tournamentLevel: string;
  alliance: 'Red' | 'Blue' | string;
  eventCode: string;
  eventName: string;
}

export interface BestEventSummary {
  eventCode: string;
  eventName: string;
  rank: number | null;
  totalOpr: number;
  wins: number;
  losses: number;
  ties: number;
}

export type EventStatus = 'IN_PROGRESS' | 'COMPLETED' | 'UPCOMING';

export interface EventSummaryItem {
  eventCode: string;
  name: string;
  typeName: string;
  city: string;
  stateprov?: string;
  country: string;
  venue: string;
  dateStart: string;
  dateEnd: string;
  status: EventStatus;
  rank: number | null;
  totalTeams: number;
  record: string;
  wins: number;
  losses: number;
  ties: number;
  winRate: number;
  totalOpr: number;
  autoOpr: number;
  teleopOpr: number;
  endgameOpr: number;
  matchesPlayed: number;
  highScore: number;
}

export interface SeasonSummaryResponse {
  teamNumber: number;
  season: number;
  seasonName: string;
  record: SeasonRecord;
  globalOpr: OprBreakdown;
  periodAverages: PeriodAverages;
  bestMatch: BestMatchPerformance | null;
  bestEvent: BestEventSummary | null;
  events: EventSummaryItem[];
}

export interface EventMetadata {
  code: string;
  name: string;
  typeName: string;
  city: string;
  stateprov?: string;
  country: string;
  venue: string;
  dateStart: string;
  dateEnd: string;
  status: EventStatus;
  liveStreamUrl: string | null;
  fieldCount?: number;
}

export interface EventStats {
  teamNumber: number;
  rank: number | null;
  totalTeams: number;
  wins: number;
  losses: number;
  ties: number;
  winRate: number;
  matchesPlayed: number;
  opr: OprBreakdown;
  averages: PeriodAverages;
  highScore: number;
  highScoreMatch: string;
}

export interface AllianceMember {
  teamNumber: number;
  teamName: string;
  station: string;
  isTargetTeam: boolean;
}

export interface MatchAllianceBreakdown {
  auto: number;
  teleop: number;
  endgame: number;
  foulCommitted: number;
  total: number;
}

export interface MatchPeriodBreakdown {
  red: MatchAllianceBreakdown;
  blue: MatchAllianceBreakdown;
}

export type MatchStatus = 'COMPLETED' | 'QUEUED' | 'UPCOMING';
export type MatchResult = 'WIN' | 'LOSS' | 'TIE' | 'PENDING';

export interface MatchItem {
  matchId: string;
  description: string;
  tournamentLevel: string;
  matchNumber: number;
  series: number;
  status: MatchStatus;
  field: string;
  scheduledTime: string | null;
  actualStartTime: string | null;
  redAlliance: AllianceMember[];
  blueAlliance: AllianceMember[];
  scoreRedFinal: number | null;
  scoreBlueFinal: number | null;
  scoreRedAuto: number | null;
  scoreBlueAuto: number | null;
  targetTeamAlliance: 'Red' | 'Blue' | null;
  result: MatchResult;
  vodUrl: string | null;
  vodTimestampSeconds: number | null;
  periodBreakdown: MatchPeriodBreakdown | null;
}

export interface QueueAlert {
  alertId: number;
  teamNumber: number;
  teamName: string;
  eventCode: string;
  eventName: string;
  matchNumber: string;
  field: string;
  alliance: 'Red' | 'Blue' | string;
  estimatedTime: string;
  title: string;
  message: string;
  triggeredAt: string;
}

export interface QueueAlertResponse {
  active: boolean;
  alert: QueueAlert | null;
}

export interface EventDetailsResponse {
  event: EventMetadata;
  stats: EventStats;
  matches: MatchItem[];
  activeAlert?: QueueAlert | null;
}

export interface TriggerAlertPayload {
  matchNumber?: string;
  field?: string;
  estimatedTime?: string;
  alliance?: 'Red' | 'Blue' | string;
}
