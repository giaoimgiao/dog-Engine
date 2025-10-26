import type { NextApiRequest, NextApiResponse } from 'next';
import { getBookSources } from '@/lib/book-source-storage';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
    if (req.method === 'GET') {
        try {
            const sources = await getBookSources();
            console.log(`[API/get-book-sources] 📖 返回 ${sources.length} 个书源`);
            res.status(200).json({ success: true, sources });
        } catch (error: any) {
            console.error('[API/get-book-sources] ❌ 读取失败:', error);
            res.status(500).json({ success: false, error: 'Failed to get book sources', details: error.message });
        }
    } else {
        res.setHeader('Allow', ['GET']);
        res.status(405).end(`Method ${req.method} Not Allowed`);
    }
}
