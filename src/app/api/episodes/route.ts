import { z } from 'zod';
import { assertProducer } from '@/lib/server/auth';
import { body, errorResponse, json } from '@/lib/server/http';
import { episodeSchema } from '@/lib/server/models';
import { createEpisode, listEpisodes, missingMedia } from '@/lib/server/store';
export const runtime = 'nodejs';
export async function GET(request: Request) { try { assertProducer(request); return json({ episodes: await listEpisodes(new URL(request.url).searchParams.get('archived') === '1') }); } catch (error) { return errorResponse(error); } }
export async function POST(request: Request) {
  try {
    assertProducer(request, true);
    const data = await body(request, z.union([z.object({ name: z.string().min(1).max(200) }), z.object({ import: episodeSchema })]));
    const episode = 'import' in data ? await createEpisode(data.import.name, data.import) : await createEpisode(data.name);
    return json({ episode, missingMedia: await missingMedia(episode) }, 201);
  } catch (error) { return errorResponse(error); }
}
