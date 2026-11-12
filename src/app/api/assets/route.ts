import { assertProducer } from '@/lib/server/auth';
import { errorResponse, HttpError, json } from '@/lib/server/http';
import { saveAsset } from '@/lib/server/assets';
export const runtime = 'nodejs';
export async function POST(request: Request) {
  try {
    assertProducer(request, true);
    const declared = Number(request.headers.get('content-length') ?? 0);
    if (declared > 3_100_000) throw new HttpError(413, 'Image must be smaller than 3 MB');
    const form = await request.formData(); const file = form.get('file');
    if (!(file instanceof File)) throw new HttpError(400, 'Choose an image');
    const asset = await saveAsset(file, { origin: String(form.get('origin') ?? 'Manual upload'), attribution: String(form.get('attribution') ?? ''), rights: String(form.get('rights') ?? 'Usage rights require production review') });
    return json({ asset }, 201);
  } catch (error) { return errorResponse(error); }
}
