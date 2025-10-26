


import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs/promises';
import path from 'path';
// 不依赖外部类型，内部自行读取配置

// Node 18+ has fetch built-in.
let fetch = global.fetch;

// Constants for local saving (though current logic will bypass local saving if urls are returned)
const AI_GENERATED_AVATARS_SUBDIR = 'ai_generated_avatars';
const PUBLIC_UPLOADS_PATH = path.join(process.cwd(), 'public', 'uploads');
const AVATAR_SAVE_DIR = path.join(PUBLIC_UPLOADS_PATH, AI_GENERATED_AVATARS_SUBDIR);
const AVATAR_FILENAME = 'doubao_avatar.png'; // Consistent filename if local saving is used

async function ensureDirExists(dirPath: string) {
  try {
    await fs.mkdir(dirPath, { recursive: true });
    console.log(`[Doubao Image API] Ensured directory exists: ${dirPath}`);
  } catch (error: any) {
    if (error.code === 'EEXIST') {
      console.log(`[Doubao Image API] Directory already exists: ${dirPath}`);
      return;
    }
    console.error(`[Doubao Image API] Error creating directory ${dirPath}:`, error);
    throw error;
  }
}

const generateUUID = () => {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
};

function getEnvFirst(keys: string[]): string | undefined {
  for (const k of keys) {
    const v = process.env[k];
    if (v && String(v).trim()) return String(v);
  }
  return undefined;
}

function getDoubaoConfigStrict(): {
  COOKIE: string; X_MS_TOKEN: string; DEVICE_ID: string; TEA_UUID: string; WEB_ID: string; MS_TOKEN: string; A_BOGUS: string; ROOM_ID: string;
} {
  const cfg = {
    COOKIE: getEnvFirst(['DOUBAO_COOKIE', 'DDB_COOKIE', 'COOKIE']),
    X_MS_TOKEN: getEnvFirst(['DOUBAO_X_MS_TOKEN', 'DDB_X_MS_TOKEN', 'X_MS_TOKEN']),
    DEVICE_ID: getEnvFirst(['DOUBAO_DEVICE_ID', 'DDB_DEVICE_ID', 'DEVICE_ID']),
    TEA_UUID: getEnvFirst(['DOUBAO_TEA_UUID', 'DDB_TEA_UUID', 'TEA_UUID']),
    WEB_ID: getEnvFirst(['DOUBAO_WEB_ID', 'DDB_WEB_ID', 'WEB_ID']),
    MS_TOKEN: getEnvFirst(['DOUBAO_MS_TOKEN', 'DDB_MS_TOKEN', 'MS_TOKEN']),
    A_BOGUS: getEnvFirst(['DOUBAO_A_BOGUS', 'DDB_A_BOGUS', 'A_BOGUS']),
    ROOM_ID: getEnvFirst(['DOUBAO_ROOM_ID', 'DDB_ROOM_ID', 'ROOM_ID']),
  } as const;
  for (const [k, v] of Object.entries(cfg)) {
    if (!v) {
      throw new Error(`后端缺少环境变量: ${k}`);
    }
  }
  return cfg as unknown as { COOKIE: string; X_MS_TOKEN: string; DEVICE_ID: string; TEA_UUID: string; WEB_ID: string; MS_TOKEN: string; A_BOGUS: string; ROOM_ID: string };
}

async function handleDoubaoSSE(
  stream: ReadableStream<Uint8Array>
): Promise<{ imageUrl: string | null; allImageUrls: string[]; nodeId: string | null }> {
  const decoder = new TextDecoder();
  const reader = stream.getReader();
  let buffer = '';
  let primaryImageUrl: string | null = null;
  const allImageUrls: string[] = [];
  let nodeId: string | null = null;
  let finalResultFromSSE: { imageUrl: string | null; allImageUrls: string[]; nodeId: string | null } | null = null;

  console.log('[Doubao Image API - SSE] Starting to process stream...');

  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) {
        console.log('[Doubao Image API - SSE] Stream finished.');
        break;
      }
      const chunk = decoder.decode(value, { stream: true });
      buffer += chunk;
      
      if (buffer.includes('event: gateway-error')) {
        const errorMatch = buffer.match(/data:\s*({.*})/);
        let errorMessage = `服务器返回网关错误: ${buffer.substring(0,200)}`;
        if (errorMatch && errorMatch[1]) {
            try {
                const errorData = JSON.parse(errorMatch[1]);
                console.error('[Doubao Image API - SSE] Doubao server gateway error (parsed):', errorData);
                errorMessage = `豆包服务器网关错误: ${errorData.code} - ${errorData.message}`;
            } catch (e) {
                console.error('[Doubao Image API - SSE] Doubao server gateway error (unparsed):', buffer);
            }
        } else {
            console.error('[Doubao Image API - SSE] Doubao server gateway error (no data):', buffer);
        }
        throw new Error(errorMessage);
      }
      
      const events = buffer.split('\n\n');
      buffer = events.pop() || ''; 

      for (const evtString of events) {
        if (!evtString.trim()) continue;
        const line = evtString.trim().split('\n').find(l => l.startsWith('data: '));
        if (!line) continue;

        try {
          const evtObj = JSON.parse(line.slice(6));
          
          if (evtObj.event_data) {
            // console.log(`[Doubao Image API - SSE] Event data (raw): <<<${JSON.stringify(evtObj.event_data).substring(0,100)}...>>>`);
          }

          if (evtObj.event_type === 2001) { 
            const inner = JSON.parse(evtObj.event_data); 

            if (!nodeId && inner.node_id) {
                nodeId = inner.node_id;
                console.log('[Doubao Image API - SSE] Captured node_id:', nodeId);
            }
            if (!nodeId && inner.message?.id) { 
                nodeId = inner.message.id;
                console.log('[Doubao Image API - SSE] Captured node_id from message.id:', nodeId);
            }

            if (inner.message?.content_type === 2074) { 
              const content = JSON.parse(inner.message.content); 
              
              let foundStatus2ImageInThisEvent = false;
              for (const creation of content.creations || []) {
                if (creation?.image?.status === 2) { 
                  const url = creation.image.image_ori?.url || creation.image.image_raw?.url || creation.image.image_thumb?.url;
                  if (url) {
                    console.log(`[Doubao Image API - SSE] ✅ Found image URL (status=2): ${url.substring(0,100)}...`);
                    if (!allImageUrls.includes(url)) {
                        allImageUrls.push(url);
                    }
                    if (!primaryImageUrl) {
                      primaryImageUrl = url; 
                    }
                    foundStatus2ImageInThisEvent = true;
                  }
                }
              }
              if (foundStatus2ImageInThisEvent) {
                 finalResultFromSSE = { imageUrl: primaryImageUrl, allImageUrls, nodeId };
              }
            } else if (inner.step) {
              // console.log(`[Doubao Image API - SSE] Generation progress: ${Math.round(inner.step * 100)}%`);
            }
          } else if (evtObj.event_type === 2003) { 
            console.log('[Doubao Image API - SSE] Stream end event (2003) received.');
            reader.releaseLock();
            return finalResultFromSSE || { imageUrl: primaryImageUrl, allImageUrls, nodeId };
          }
        } catch (e: any) { 
          // console.warn('[Doubao Image API - SSE] Error parsing SSE event JSON:', e.message);
        }
      }
    }
  } catch (err) {
    console.error('[Doubao Image API - SSE] Error reading from stream:', err);
    throw err;
  } finally {
    if (reader && !reader.closed) { // Check if reader exists before trying to release lock
        try {
            reader.releaseLock();
        } catch (e) {}
    }
  }
  return finalResultFromSSE || { imageUrl: primaryImageUrl, allImageUrls, nodeId };
}

async function pollDoubaoImageResult(
  nodeId: string, 
  getHeadersFn: () => any, 
  getQueryParamsFn: () => string,
  maxRetries = 10
): Promise<{ imageUrl: string | null; allImageUrls: string[] }> {
  const BASE_URL = 'https://www.doubao.com'; // Ensure BASE_URL is defined here or passed
  const url = `${BASE_URL}/samantha/aispace/message_node_info?${getQueryParamsFn()}`;
  const body = { node_id: nodeId };
  
  let primaryImageUrl: string | null = null;
  const allImageUrls: string[] = [];

  console.log(`[Doubao Image API - Polling] Starting for node_id: ${nodeId}`);
  
  for (let i = 0; i < maxRetries; i++) {
    try {
      console.log(`[Doubao Image API - Polling] Attempt ${i + 1}/${maxRetries}...`);
      const headers = getHeadersFn();
      const response = await fetch(url, { method: 'POST', headers, body: JSON.stringify(body) });
      
      if (!response.ok) {
        const errorText = await response.text();
        console.warn(`[Doubao Image API - Polling] Request failed. Status: ${response.status}, Details: ${errorText.substring(0, 200)}`);
        await new Promise(resolve => setTimeout(resolve, 2000 + i * 500)); 
        continue;
      }
      const data = await response.json();
      
      if (data.code !== 0) {
        console.warn(`[Doubao Image API - Polling] API returned error code: ${data.code}, Message: ${data.msg}`);
        await new Promise(resolve => setTimeout(resolve, 2000 + i * 500));
        continue;
      }

      if (data.data?.messages?.[0]?.content_type === 2074 && data.data.messages[0].content) {
        const payload = JSON.parse(data.data.messages[0].content);
        if (payload.creations?.length > 0) {
          let foundStatus2ImageInThisPoll = false;
          for (const creation of payload.creations) {
            if (creation.image?.status === 2) {
              const imgUrl = creation.image.image_ori?.url || creation.image.image_raw?.url || creation.image.image_thumb?.url;
              if (imgUrl) {
                console.log(`[Doubao Image API - Polling] ✅ Found image URL (status=2): ${imgUrl.substring(0,100)}...`);
                if (!allImageUrls.includes(imgUrl)) {
                    allImageUrls.push(imgUrl);
                }
                if (!primaryImageUrl) primaryImageUrl = imgUrl;
                foundStatus2ImageInThisPoll = true;
              }
            }
          }
          if (foundStatus2ImageInThisPoll) {
            console.log(`[Doubao Image API - Polling] Completed image(s) found. Primary: ${primaryImageUrl}, All: ${allImageUrls.length}`);
            return { imageUrl: primaryImageUrl, allImageUrls };
          }
        }
      }
      
      const status = data.data?.status || data.data?.messages?.[0]?.status;
      if (status === 'progress' || status === 'streaming' || status === 1 ) {
        console.log(`[Doubao Image API - Polling] Image still generating (status: ${status})...`);
      } else if (status) {
        console.log(`[Doubao Image API - Polling] Image generation status: ${status}`);
      } else {
        console.log('[Doubao Image API - Polling] No clear progress status, but no image found yet.');
      }

      await new Promise(resolve => setTimeout(resolve, 1500 + i * 200));
    } catch (err: any) {
      console.warn('[Doubao Image API - Polling] Error during polling attempt:', err.message);
    }
  }
  console.log('[Doubao Image API - Polling] Max retries reached or no image found from polling.');
  return { imageUrl: primaryImageUrl, allImageUrls };
}

async function generateImageFromDoubao(promptText: string): Promise<{ primaryUrl: string | null; urls: string[] }> {
  const BASE_URL = 'https://www.doubao.com';
  const config = getDoubaoConfigStrict();
  const getQueryParamsInternal = () => {
    return `aid=497858&device_id=${config.DEVICE_ID}&device_platform=web&language=zh&pc_version=2.16.7&pkg_type=release_version&real_aid=497858&region=CN&samantha_web=1&sys_region=CN&tea_uuid=${config.TEA_UUID}&use-olympus-account=1&version_code=20800&web_id=${config.WEB_ID}&msToken=${config.MS_TOKEN}&a_bogus=${config.A_BOGUS}`;
  };
  const getHeadersInternal = () => ({
    'content-type': 'application/json',
    'accept': 'text/event-stream',
    'agw-js-conv': 'str',
    'cookie': config.COOKIE,
    'x-ms-token': config.X_MS_TOKEN,
    'origin': BASE_URL,
    'referer': `${BASE_URL}/chat/${config.ROOM_ID}`,
    'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/136.0.0.0 Safari/537.36'
  });

  const url = `${BASE_URL}/samantha/chat/completion?${getQueryParamsInternal()}`;
  const localMsgId = generateUUID();
  const localConvId = `local_${Math.floor(Math.random() * 10000000000000000)}`;
  
  const body = {
    completion_option: { is_regen: false, with_suggest: true, need_create_conversation: true, launch_stage: 1, reply_id: "0" },
    conversation_id: "0",
    local_conversation_id: localConvId,
    local_message_id: localMsgId,
    messages: [{ content: JSON.stringify({text: promptText}), content_type: 2001, attachments: [], references: [] }]
  };

  console.log('[Doubao Image API] Sending request to Doubao...');
  const controller = new AbortController();
  const timeoutId = setTimeout(() => {
    console.warn('[Doubao Image API] Request Aborted due to timeout (90s)');
    controller.abort();
  }, 90000); 

  let sseResult: { imageUrl: string | null; allImageUrls: string[]; nodeId: string | null } = { imageUrl: null, allImageUrls: [], nodeId: null };

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: getHeadersInternal(),
      body: JSON.stringify(body),
      signal: controller.signal,
    });
    clearTimeout(timeoutId); 

    console.log(`[Doubao Image API] Doubao response status: ${response.status} ${response.statusText}`);
    if (!response.ok) {
      const errorText = await response.text();
      console.error(`[Doubao Image API] Doubao request failed. Status: ${response.status}, Details: ${errorText.substring(0,500)}`);
      throw new Error(`豆包图片生成请求失败: ${response.status} ${response.statusText}`);
    }

    if (!response.body) {
      throw new Error('豆包图片生成请求返回异常: 无响应体');
    }

    sseResult = await handleDoubaoSSE(response.body);    
    console.log(`[Doubao Image API] After SSE: Primary URL: ${sseResult.imageUrl}, All URLs Count: ${sseResult.allImageUrls.length}, Node ID: ${sseResult.nodeId}`);

    if (sseResult.allImageUrls.length === 0 && sseResult.nodeId) { 
      console.log(`[Doubao Image API] No image URL from SSE. Polling with node_id: ${sseResult.nodeId}`);
      const pollResult = await pollDoubaoImageResult(sseResult.nodeId, getHeadersInternal, getQueryParamsInternal);
      if (pollResult.imageUrl) sseResult.imageUrl = pollResult.imageUrl;
      pollResult.allImageUrls.forEach(url => {
        if (!sseResult.allImageUrls.includes(url)) {
          sseResult.allImageUrls.push(url);
        }
      });
      if(!sseResult.imageUrl && sseResult.allImageUrls.length > 0) sseResult.imageUrl = sseResult.allImageUrls[0];
      console.log(`[Doubao Image API] After Polling: Primary URL: ${sseResult.imageUrl}, All URLs Count: ${sseResult.allImageUrls.length}`);
    }
    
  } catch (err: any) {
    clearTimeout(timeoutId);
    console.error('[Doubao Image API] Image generation request failed:', err.message);
    if (err.name === 'AbortError') {
        throw new Error('豆包图片生成请求超时 (90秒)。');
    }
    if (sseResult.allImageUrls.length > 0) {
        console.warn('[Doubao Image API] Error occurred, but some image URLs were retrieved. Returning what was found.');
        return { primaryUrl: sseResult.imageUrl || sseResult.allImageUrls[0], urls: sseResult.allImageUrls };
    }
    throw err;
  }

  if (!sseResult.imageUrl && sseResult.allImageUrls.length > 0) {
    sseResult.imageUrl = sseResult.allImageUrls[0];
  }

  if (sseResult.allImageUrls.length === 0) { 
    console.error('[Doubao Image API] Final check: No image URL obtained after SSE and polling.');
    throw new Error('未能从豆包服务获取到图片URL (API handler final check)。');
  }
  
  console.log(`[Doubao Image API] Successfully generated. Returning all URLs: ${sseResult.allImageUrls.length}, primary: ${sseResult.imageUrl}`);
  return { primaryUrl: sseResult.imageUrl, urls: sseResult.allImageUrls };
}


export async function POST(request: NextRequest) {
  try {
    let body: any = {};
    try { body = await request.json(); } catch {}
    const prompt = body?.prompt;

    if (!prompt) {
      return NextResponse.json({ error: '提示词 (prompt) 不能为空' }, { status: 400 });
    }
    
    console.log(`[Doubao Image API] Received request to generate image with prompt: "${prompt.substring(0, 50)}..."`);

    // Generate image and get ALL external URLs
    const { primaryUrl, urls } = await generateImageFromDoubao(prompt); 
    
    if (!urls || urls.length === 0) {
      console.error('[Doubao Image API] generateImageFromDoubao did not return any URLs.');
      return NextResponse.json({ success: false, error: '未能从豆包服务获取到任何图片URL。' }, { status: 500 });
    }
    
    // Directly return the external URLs to the frontend
    console.log(`[Doubao Image API] Successfully processed. Returning ${urls.length} external URLs. Primary: ${primaryUrl}`);
    return NextResponse.json({ 
      success: true, 
      urls: urls, // Array of external URLs
      primaryUrl: primaryUrl || urls[0] // The first URL as the primary/default
    });

  } catch (error: any) {
    console.error('[Doubao Image API] Handler error:', error.message, error.stack ? error.stack.substring(0,300): '');
    let errorMessage = error.message || '图片生成失败，服务器内部错误。';
    if (error.message.includes('未能从豆包服务获取到图片URL') || error.message.startsWith('豆包图片生成请求超时') || error.message.startsWith('豆包服务器网关错误')) {
        errorMessage = error.message;
    }
    return NextResponse.json({ 
      success: false,
      error: errorMessage,
      details: process.env.NODE_ENV !== 'production' && error.stack ? error.stack.substring(0, 300) : undefined
    }, { status: 500 });
  }
}

    