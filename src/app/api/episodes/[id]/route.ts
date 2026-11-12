import { assertProducer } from '@/lib/server/auth';
import { body, errorResponse, HttpError, json } from '@/lib/server/http';
import { episodeUpdateSchema } from '@/lib/server/models';
import { createEpisode, getEpisode, missingMedia, updateEpisode } from '@/lib/server/store';
import { z } from 'zod';
export const runtime = 'nodejs';
type Context = { params: Promise<{ id: string }> };
export async function GET(request: Request, context: Context) { try { assertProducer(request); const episode = await getEpisode((await context.params).id); return json({ episode, missingMedia: await missingMedia(episode) }); } catch (error) { return errorResponse(error); } }
export async function PUT(request: Request, context: Context) { try { assertProducer(request, true); return json({ episode: await updateEpisode((await context.params).id, await body(request, episodeUpdateSchema)) }); } catch (error) { return errorResponse(error); } }
export async function POST(request: Request, context: Context) { try { assertProducer(request, true); await body(request, z.object({ action: z.literal('duplicate') })); const original = await getEpisode((await context.params).id); return json({ episode: await createEpisode(`${original.name} copy`, original) }, 201); } catch (error) { return errorResponse(error); } }
export async function DELETE(request: Request, context: Context) { try { assertProducer(request, true); const version = Number(new URL(request.url).searchParams.get('version')); if (!Number.isInteger(version) || version < 1) throw new HttpError(400, 'Expected episode version required'); return json({ episode: await updateEpisode((await context.params).id, { expectedVersion: version, archived: true }) }); } catch (error) { return errorResponse(error); } }
