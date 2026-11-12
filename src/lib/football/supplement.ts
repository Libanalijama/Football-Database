import type { Metric, ProviderId } from './types';
export type EntityReference={provider:ProviderId;id:string;kind:'player'|'team'|'match'};
export type EntityMapping={primary:EntityReference;secondary:EntityReference;verifiedBy:string;verifiedAt:string;sourceUrl:string};
export type SupplementalMetric={entity:EntityReference;metric:Metric;definition:string};
/** Supplementation is opt-in and requires explicit IDs plus matching scope and definition.
 * Conflicts remain separate selectable records; no numeric values are combined here. */
export function reconcileMetrics(primary:SupplementalMetric,secondary:SupplementalMetric,mapping:EntityMapping){
 const mapped=(a:EntityReference,b:EntityReference)=>a.provider===b.provider&&a.id===b.id&&a.kind===b.kind;
 if(!mapped(primary.entity,mapping.primary)||!mapped(secondary.entity,mapping.secondary)||!mapping.verifiedBy||!mapping.sourceUrl)throw new Error('Explicit verified entity mapping required');
 const a=primary.metric,b=secondary.metric,ap=a.provenance,bp=b.provenance;
 if(a.key!==b.key||a.unit!==b.unit||primary.definition!==secondary.definition||ap.competition!==bp.competition||ap.season!==bp.season||ap.scope!==bp.scope||ap.teamId!==bp.teamId)throw new Error('Metric scope, units or definition differ');
 return {records:[primary,secondary],conflict:a.value!==b.value,selectedProvider:primary.entity.provider};
}
