import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { espn, providerStatus } from '@/lib/football/espn';
import { ProviderError, withFreshProviderData } from '@/lib/football/http';
import { HttpError } from '@/lib/server/http';
import { assertProducer } from '@/lib/server/auth';
export const dynamic='force-dynamic';
const querySchema=z.object({kind:z.enum(['competitions','league','team','player','match','search','status']),competition:z.string().default('eng.1'),season:z.coerce.number().int().min(1900).max(2100).optional(),id:z.string().regex(/^\d{1,14}$/).optional(),teamId:z.string().regex(/^\d{1,14}$/).optional(),q:z.string().max(80).optional(),refresh:z.literal('1').optional()});
export async function GET(request:NextRequest){
 try{
  assertProducer(request);
  const parsed=querySchema.safeParse(Object.fromEntries(request.nextUrl.searchParams));
  if(!parsed.success)return NextResponse.json({error:'Invalid football request.',code:'INVALID_REQUEST'}, {status:400});
  const {kind,competition,season,id,teamId,q,refresh}=parsed.data;
  const data=await withFreshProviderData(refresh==='1',async()=>{
  let result:unknown;
  if(kind==='status')result=providerStatus();
  else if(kind==='competitions')result=await espn.getCompetitions();
  else if(kind==='league')result=await espn.getLeague(competition,season);
  else if(kind==='team'&&id)result=await espn.getTeam(competition,id,season);
  else if(kind==='player'&&id)result=await espn.getPlayer(competition,id,season,teamId);
  else if(kind==='match'&&id)result=await espn.getMatch(competition,id);
  else if(kind==='search'&&q)result=await espn.search(competition,q,season,teamId);
  else throw new ProviderError('INVALID_REQUEST','Select a record.',400);
  return result;
  });
  return NextResponse.json({data},{headers:{'Cache-Control':'no-store'}});
 }catch(error){
  if(error instanceof HttpError)return NextResponse.json({error:error.message,code:'ACCESS_DENIED'},{status:error.status});
  const known=error instanceof ProviderError;
  return NextResponse.json({error:known?error.message:'Football data is unavailable.',code:known?error.code:'SOURCE_ERROR'},{status:known?error.status:503,headers:{'Cache-Control':'no-store'}});
 }
}
