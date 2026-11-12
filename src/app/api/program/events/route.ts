import { isProducer } from '@/lib/server/auth';
import { errorResponse, HttpError } from '@/lib/server/http';
import { getProgram, getProgramByOutputToken } from '@/lib/server/store';
export const runtime = 'nodejs';
export const maxDuration = 30;
export async function GET(request: Request) {
  try {
    const token = new URL(request.url).searchParams.get('token'); const producer = isProducer(request);
    const initial=producer?await getProgram():await getProgramByOutputToken(token); if(!initial) throw new HttpError(401, 'Output access required');
    const encoder = new TextEncoder(); let version = -1; let closed = false;
    const stream = new ReadableStream<Uint8Array>({
      async start(controller) {
        const deadline = Date.now() + 25_000;
        request.signal.addEventListener('abort', () => { closed = true; });
        try {
          while (!closed && Date.now() < deadline) {
            const state = version < 0 ? initial : producer ? await getProgram() : await getProgramByOutputToken(token);
            if(!state) break;
            if (state.version > version) { controller.enqueue(encoder.encode(`id: ${state.version}\nevent: state\ndata: ${JSON.stringify(state)}\n\n`)); version = state.version; }
            await new Promise(resolve => setTimeout(resolve, 500));
          }
        } catch { /* clean output retains the last snapshot and reconnects */ }
        if (!closed) controller.close();
      },
      cancel() { closed = true; },
    });
    return new Response(stream, { headers: { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-store', 'Connection': 'keep-alive', 'X-Accel-Buffering': 'no' } });
  } catch (error) { return errorResponse(error); }
}
