import {genkit} from 'genkit';
import {googleAI} from '@genkit-ai/googleai';
import { HttpsProxyAgent } from 'https-proxy-agent';

// 配置代理支持
const proxyUrl = process.env.HTTPS_PROXY || process.env.HTTP_PROXY || process.env.ALL_PROXY;
let fetchOptions = {};

if (proxyUrl) {
  console.log('[Genkit Proxy] Using proxy:', proxyUrl.replace(/\/\/([^:]+):([^@]+)@/, '//$1:****@'));
  const agent = new HttpsProxyAgent(proxyUrl);
  fetchOptions = {
    // @ts-ignore - agent is valid for fetch options
    dispatcher: agent,
  };
} else {
  console.log('[Genkit Proxy] No proxy configured, using direct connection');
}

export const ai = genkit({
  plugins: [
    googleAI({
      // @ts-ignore - fetchOptions is valid for googleAI plugin
      fetchOptions,
    })
  ],
  model: 'googleai/gemini-2.5-flash',
});
