import type { NextApiRequest, NextApiResponse } from 'next';
import { getAuth, saveAuth } from '@/lib/book-source-auth';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const { sourceId } = req.query;
  if (typeof sourceId !== 'string' || !sourceId) {
    return res.status(400).json({ success: false, error: 'sourceId is required' });
  }

  try {
    if (req.method === 'GET') {
      const auth = await getAuth(sourceId);
      return res.status(200).json({ success: true, auth });
    }
    if (req.method === 'POST') {
      const body = req.body || {};
      await saveAuth({ sourceId, cookies: body.cookies || {}, tokens: body.tokens || {} });
      return res.status(200).json({ success: true });
    }
    return res.status(405).json({ success: false, error: 'Method not allowed' });
  } catch (e: any) {
    return res.status(500).json({ success: false, error: e.message || 'Internal error' });
  }
}


