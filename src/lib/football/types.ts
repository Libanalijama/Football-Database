export type ProviderId = 'espn' | 'api-football' | 'sportmonks' | 'editorial';
export type Provenance = { provider: ProviderId; sourceUrl: string; retrievedAt: string; competition: string; season: number | null; scope: 'competition-season' | 'match' | 'current-profile' | 'current-squad'; teamId?: string; note?: string };
export type Capability = { available: boolean; reason?: string };
export type Capabilities = Record<string, Capability>;
export type Metric = { key: string; label: string; value: number | null; displayValue: string | null; unit: string; provenance: Provenance };
export type Competition = { id: string; slug: string; name: string; logo: string | null };
export type Team = { id: string; provider: 'espn'; name: string; shortName: string; abbreviation: string; crest: string | null; color: string | null; venue: string | null; sourceUrl: string | null };
export type Player = { id: string; provider: 'espn'; name: string; firstName: string | null; lastName: string | null; portrait: string | null; position: string | null; jersey: string | null; nationality: string | null; birthDate: string | null; age: number | null; height: string | null; weight: string | null; team: Team | null; sourceUrl: string | null; scope?: Provenance };
export type MatchEvent = { id: string; kind: string; text: string; minute: string | null; clock: number | null; teamId: string | null; player: string | null; playerId: string | null; ownGoal: boolean; penalty: boolean; shootout: boolean; homeScore: number | null; awayScore: number | null };
export type LineupPlayer = { id: string; name: string; jersey: string | null; position: string | null; starter: boolean | null; substituted: boolean; statistics: Metric[] };
export type Lineup = { teamId: string; formation: string | null; players: LineupPlayer[] };
export type Match = { id: string; provider: 'espn'; competition: string; season: number | null; name: string; kickoff: string; status: string; state: 'pre' | 'in' | 'post' | 'unavailable'; completed: boolean; home: Team; away: Team; homeScore: number | null; awayScore: number | null; homeShootout: number | null; awayShootout: number | null; homeAggregate: number | null; awayAggregate: number | null; venue: string | null; attendance: number | null; events: MatchEvent[]; statistics: {teamId:string; metrics:Metric[]}[]; lineups: Lineup[]; note: string | null; sourceUrl: string | null; provenance: Provenance };
export type Standing = { rank: number | null; team: Team; played: number | null; won: number | null; drawn: number | null; lost: number | null; goalsFor: number | null; goalsAgainst: number | null; goalDifference: number | null; points: number | null; note: string | null; group: string | null; provenance: Provenance };
export type Leader = { category: string; label: string; rank: number; player: Player; value: number | null; displayValue: string | null; provenance: Provenance };
export type LeagueData = { competition: Competition; season: number; seasons: number[]; teams: Team[]; matches: Match[]; standings: Standing[]; leaders: Leader[]; capabilities: Capabilities; provenance: Provenance; notices: string[] };
export type TeamData = { team: Team; squad: Player[]; matches: Match[]; statistics: Metric[]; capabilities: Capabilities; provenance: Provenance; notices: string[] };
export type PlayerData = { player: Player; currentTeam?: Team | null; statistics: Metric[]; history: {team:Team; season:number|null; provenance:Provenance}[]; capabilities: Capabilities; provenance: Provenance; notices: string[] };
export type MatchData = { match: Match; capabilities: Capabilities; provenance: Provenance; notices: string[] };
export type SearchResult = { kind:'team'|'player'|'match'; id:string; name:string; detail:string; image:string|null; teamId?:string; origin:'remote'; competition:string; season:number };
export type SearchData = { results: SearchResult[]; boundary:string; provenance:Provenance; notices:string[] };
export interface FootballProvider {
 readonly id:ProviderId;
 getCompetitions():Promise<Competition[]>;
 getLeague(competition:string,season?:number):Promise<LeagueData>;
 getTeam(competition:string,id:string,season?:number):Promise<TeamData>;
 getPlayer(competition:string,id:string,season?:number,teamId?:string):Promise<PlayerData>;
 getMatch(competition:string,id:string):Promise<MatchData>;
 search(competition:string,query:string,season?:number,teamId?:string):Promise<SearchData>;
}
