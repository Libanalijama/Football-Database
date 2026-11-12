import { assertProducer, isProducer } from '@/lib/server/auth';
import { body, errorResponse, HttpError, json } from '@/lib/server/http';
import { programMutationSchema } from '@/lib/server/models';
import { getProgram, getProgramByOutputToken, mutateProgram } from '@/lib/server/store';
export const runtime = 'nodejs';
export async function GET(request: Request) {
  try { const state=isProducer(request)?await getProgram():await getProgramByOutputToken(new URL(request.url).searchParams.get('token')); if(!state) throw new HttpError(401, 'Output access required'); return json(state); } catch (error) { return errorResponse(error); }
}
export async function POST(request: Request) { try { assertProducer(request, true); return json(await mutateProgram(await body(request, programMutationSchema))); } catch (error) { return errorResponse(error); } }
