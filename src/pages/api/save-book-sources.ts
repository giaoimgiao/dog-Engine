import type { NextApiRequest, NextApiResponse } from 'next';
import type { BookSource } from '@/lib/types';
import { saveBookSources } from '@/lib/book-source-storage';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
    if (req.method === 'POST') {
        try {
            const { sources } = req.body as { sources: BookSource[] };

            if (!Array.isArray(sources)) {
                console.error('[API/save-book-sources] ❌ Invalid data format, not an array');
                return res.status(400).json({ success: false, error: 'Invalid data format: sources must be an array.' });
            }

            console.log(`[API/save-book-sources] 📚 接收到 ${sources.length} 个书源，准备保存...`);
            
            const success = await saveBookSources(sources);
            
            if (success) {
                console.log('[API/save-book-sources] ✅ API层确认保存成功');
                res.status(200).json({ success: true, message: 'Book sources saved successfully.' });
            } else {
                throw new Error('saveBookSources returned false');
            }
        } catch (error: any) {
            console.error('[API/save-book-sources] ❌ 保存失败:', error);
            res.status(500).json({ success: false, error: 'Failed to save book sources', details: error.message });
        }
    } else {
        res.setHeader('Allow', ['POST']);
        res.status(405).end(`Method ${req.method} Not Allowed`);
    }
}
