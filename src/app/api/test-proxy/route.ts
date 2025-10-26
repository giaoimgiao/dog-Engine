import { NextResponse } from 'next/server';
import { testProxyConnection } from '@/lib/proxy-fetch';

/**
 * 测试代理连接的API端点
 * 访问: http://localhost:9002/api/test-proxy
 */
export async function GET() {
    const proxyUrl = process.env.HTTPS_PROXY || process.env.HTTP_PROXY || process.env.ALL_PROXY;
    
    console.log('=== Proxy Test ===');
    console.log('Proxy URL:', proxyUrl || 'Not configured');
    
    try {
        const result = await testProxyConnection();
        console.log('Test result:', result);
        
        return NextResponse.json({
            success: result.success,
            message: result.message,
            proxyConfigured: !!proxyUrl,
            proxyUrl: proxyUrl ? proxyUrl.replace(/\/\/([^:]+):([^@]+)@/, '//$1:****@') : null,
            timestamp: new Date().toISOString(),
        });
    } catch (error: any) {
        console.error('Test error:', error);
        
        return NextResponse.json({
            success: false,
            message: error.message || 'Unknown error',
            proxyConfigured: !!proxyUrl,
            proxyUrl: proxyUrl ? proxyUrl.replace(/\/\/([^:]+):([^@]+)@/, '//$1:****@') : null,
            timestamp: new Date().toISOString(),
        }, { status: 500 });
    }
}

