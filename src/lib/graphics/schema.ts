import { z } from "zod";

export const templateIds = [
  "profile-player",
  "profile-manager",
  "profile-owner",
  "profile-executive",
  "transfer-announcement",
  "transfer-fees",
  "transfer-clubs",
  "transfer-contract",
  "comparison-player",
  "comparison-manager",
  "comparison-season",
  "comparison-finances",
  "comparison-arguments",
  "statistics-player",
  "statistics-match",
  "statistics-finances",
  "statistics-big-number",
  "timeline-player",
  "timeline-manager",
  "timeline-history",
  "scoreboard-result",
  "scoreboard-scorers",
  "scoreboard-details",
  "scoreboard-cup",
  "table-league",
  "table-extract",
  "ranking-players",
  "ranking-editorial",
] as const;
export const graphicValueSchema = z.union([
  z.string().max(1200),
  z.number().finite(),
  z.null(),
]);
export const metricProvenanceSchema = z.object({
  provider: z.enum(["espn", "api-football", "sportmonks", "editorial"]),
  sourceUrl: z.string().max(3000),
  retrievedAt: z.string().max(100),
  competition: z.string().max(180),
  season: z.number().int().nullable(),
  scope: z.enum([
    "competition-season",
    "match",
    "current-profile",
    "current-squad",
  ]),
  teamId: z.string().max(180).optional(),
  note: z.string().max(1000).optional(),
});
export const metricSchema = z.object({
  label: z.string().max(160),
  value: graphicValueSchema,
  other: graphicValueSchema.optional(),
  unit: z.string().max(40).optional(),
  source: z.string().max(2000).optional(),
  key: z.string().max(180).optional(),
  rawValue: z.number().finite().nullable().optional(),
  rawUnit: z.string().max(80).optional(),
  otherRawValue: z.number().finite().nullable().optional(),
  otherRawUnit: z.string().max(80).optional(),
  provenance: metricProvenanceSchema.optional(),
  otherProvenance: metricProvenanceSchema.optional(),
});
export const subjectSchema = z.object({
  id: z.string().max(180),
  teamId: z.string().max(180).optional(),
  provider: z
    .enum(["espn", "api-football", "sportmonks", "editorial"])
    .optional(),
  sourceIds: z.record(z.string(), z.string().max(180)).optional(),
  provenance: metricProvenanceSchema.optional(),
  name: z.string().max(220),
  role: z.string().max(120).optional(),
  team: z.string().max(180).optional(),
  image: z.string().max(3000).optional(),
  crest: z.string().max(3000).optional(),
  season: z.string().max(80).optional(),
  competition: z.string().max(160).optional(),
  facts: z.array(metricSchema).max(40).optional(),
});
export const graphicRowSchema = z.object({
  subjectId: z.string().max(180).optional(),
  provenance: metricProvenanceSchema.optional(),
  label: z.string().max(300),
  value: graphicValueSchema.optional(),
  other: graphicValueSchema.optional(),
  rank: z.number().int().positive().nullable().optional(),
  note: z.string().max(1000).optional(),
  image: z.string().max(3000).optional(),
  date: z.string().max(100).optional(),
  columns: z.array(graphicValueSchema).max(12).optional(),
});
export const goalEventSchema = z.object({
  team: z.enum(["home", "away"]),
  name: z.string().max(220),
  minute: z.string().max(50),
  ownGoal: z.boolean().optional(),
  penalty: z.boolean().optional(),
  homeScore: z.number().int().nonnegative().optional(),
  awayScore: z.number().int().nonnegative().optional(),
});
export const graphicSchema = z.object({
  id: z.string().max(180),
  templateId: z.enum(templateIds),
  title: z.string().max(240),
  subtitle: z.string().max(400),
  kicker: z.string().max(180),
  placement: z.enum(["left", "right"]),
  background: z.enum(["transparent", "navy"]),
  fields: z.record(z.string(), graphicValueSchema),
  subjects: z.array(subjectSchema).max(4),
  metrics: z.array(metricSchema).max(60),
  rows: z.array(graphicRowSchema).max(500),
  source: z.object({
    provider: z.string().max(180).optional(),
    url: z.string().max(3000).optional(),
    attribution: z.string().max(1000).optional(),
    reportingPeriod: z.string().max(200).optional(),
    retrievedAt: z.string().max(100).optional(),
    season: z.string().max(100).optional(),
    competition: z.string().max(180).optional(),
    scope: z.string().max(100).optional(),
    teamId: z.string().max(180).optional(),
  }),
  match: z
    .object({
      home: subjectSchema,
      away: subjectSchema,
      homeScore: z.number().int().nonnegative().nullable(),
      awayScore: z.number().int().nonnegative().nullable(),
      status: z.string().max(180),
      events: z.array(goalEventSchema).max(100),
      aggregate: z
        .object({
          home: z.number().nonnegative(),
          away: z.number().nonnegative(),
        })
        .optional(),
      shootout: z
        .object({
          home: z.number().nonnegative(),
          away: z.number().nonnegative(),
        })
        .optional(),
    })
    .optional(),
  page: z.number().int().nonnegative(),
});
export type GraphicDocument = z.infer<typeof graphicSchema>;
export type GraphicSubject = z.infer<typeof subjectSchema>;
export type GraphicMetric = z.infer<typeof metricSchema>;
export type GraphicRow = z.infer<typeof graphicRowSchema>;
export type GoalEvent = z.infer<typeof goalEventSchema>;
