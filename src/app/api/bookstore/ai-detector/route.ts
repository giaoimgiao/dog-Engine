import { NextRequest, NextResponse } from 'next/server';

const AILV_API_URL = 'https://a.ailv.run/analyze';

export async function POST(request: NextRequest) {
  const logPrefix = '[API/ai-detector]';
  try {
    const body = await request.json();
    const { text, lang = 'zh' } = body;

    if (!text || typeof text !== 'string' || text.trim().length === 0) {
      console.log(`${logPrefix} Bad Request: Text content is missing or invalid.`);
      return NextResponse.json(
        { error: '请提供有效的文本内容' },
        { status: 400 }
      );
    }

    const payload = {
      text: text.trim(),
      lang: lang
    };

    console.log(`${logPrefix} Sending request to AILV API:`, AILV_API_URL);
    
    const response = await fetch(AILV_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Origin': 'https://www.ailv.run',
        'Referer': 'https://www.ailv.run/',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/136.0.0.0 Safari/537.36',
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const errorBody = await response.text();
      console.error(`${logPrefix} AILV API Error:`, response.status, response.statusText, errorBody);
      
      let errorMessage = `AI检测服务暂时不可用 (${response.status})`;
      try {
        const errorData = JSON.parse(errorBody);
        errorMessage = errorData.error || errorData.message || errorMessage;
      } catch (e) {
        // Fallback to error text if not JSON
        errorMessage = errorBody || errorMessage;
      }
      
      return NextResponse.json(
        { error: errorMessage },
        { status: response.status }
      );
    }

    const data = await response.json();
    
    console.log(`${logPrefix} AILV API Raw Response:`, data);
    
    const aiProbability = typeof data.avgAiProbability === 'string' 
      ? parseFloat(data.avgAiProbability) 
      : data.avgAiProbability;
    const humanProbability = typeof data.avgHumanProbability === 'string' 
      ? parseFloat(data.avgHumanProbability) 
      : data.avgHumanProbability;

    const result = {
      avgAiProbability: aiProbability,
      avgHumanProbability: humanProbability
    };

    console.log(`${logPrefix} AI Detection Result:`, result);
    return NextResponse.json(result);

  } catch (error: any) {
    console.error(`${logPrefix} Internal Server Error:`, error);
    
    if (error instanceof TypeError && error.message.includes('fetch')) {
      return NextResponse.json(
        { error: '无法连接到AI检测服务，请检查网络连接' },
        { status: 503 }
      );
    }
    
    return NextResponse.json(
      { error: '处理请求时发生内部错误' },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
    return NextResponse.json({ error: '不支持GET方法，请使用POST。' }, { status: 405 });
}
