import { assertProducer } from '@/lib/server/auth';
import { errorResponse, json } from '@/lib/server/http';
import { outputAccessConfigured, rotateOutputToken } from '@/lib/server/store';
export const runtime = 'nodejs';
export async function GET(request: Request) { try { assertProducer(request); return json({ configured: await outputAccessConfigured() }); } catch (error) { return errorResponse(error); } }
export async function POST(request: Request) { try { assertProducer(request, true); const token = await rotateOutputToken(); return json({ token, path: `/output?token=${token}` }); } catch (error) { return errorResponse(error); } }
