import { isProducer } from '@/lib/server/auth';
import { errorResponse, HttpError } from '@/lib/server/http';
import { getAsset } from '@/lib/server/assets';
import { validOutputToken } from '@/lib/server/store';
export const runtime = 'nodejs';
export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    if (!isProducer(request) && !await validOutputToken(new URL(request.url).searchParams.get('token'))) throw new HttpError(401, 'Image access required');
    const asset = await getAsset((await context.params).id);
    if (asset.url) {
      const { get } = await import('@vercel/blob');
      const blob=await get(String(asset.url),{access:'private',token:process.env.BLOB_READ_WRITE_TOKEN,ifNoneMatch:request.headers.get('if-none-match')??undefined});
      if(!blob) throw new HttpError(404,'Image unavailable');
      if(blob.statusCode===304) return new Response(null,{status:304,headers:{'Cache-Control':'private, max-age=86400, immutable','ETag':blob.blob.etag}});
      return new Response(blob.stream,{headers:{'Content-Type':String(asset.mime),'Content-Length':String(blob.blob.size),'Cache-Control':'private, max-age=86400, immutable','ETag':blob.blob.etag,'X-Content-Type-Options':'nosniff'}});
    }
    const bytes = Buffer.from(String(asset.bytes_base64), 'base64');
    return new Response(bytes, { headers: { 'Content-Type': String(asset.mime), 'Content-Length': String(bytes.length), 'Cache-Control': 'private, max-age=86400, immutable', 'ETag': `"${asset.sha256}"`, 'X-Content-Type-Options': 'nosniff' } });
  } catch (error) { return errorResponse(error); }
}
