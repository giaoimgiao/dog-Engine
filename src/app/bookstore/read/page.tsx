
'use client';

import { Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { useState, useEffect } from 'react';
import Link from 'next/link';
import Header from '@/components/Header';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { ArrowLeft, ArrowRight } from 'lucide-react';
import type { BookstoreChapterContent } from '@/lib/types';
import { ScrollArea } from '@/components/ui/scroll-area';

function ChapterReader() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const url = searchParams.get('url') || '';
    const sourceId = searchParams.get('sourceId') || '';
    
    const [chapter, setChapter] = useState<BookstoreChapterContent | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    
    // Function to fetch chapter content
    const fetchChapter = async (fetchUrl: string) => {
        setIsLoading(true);
        setError(null);
        // Update URL in browser without reloading the page
        router.replace(`/bookstore/read?url=${encodeURIComponent(fetchUrl)}&sourceId=${sourceId}`, { scroll: false });
        try {
            const res = await fetch(`/api/bookstore/chapter?url=${encodeURIComponent(fetchUrl)}&sourceId=${sourceId}`);
            if (!res.ok) {
                const errorData = await res.json();
                throw new Error(errorData.details || '获取章节内容失败');
            }
            const data = await res.json();
            if(data.success) {
                setChapter(data.chapter);
                window.scrollTo(0, 0); // Scroll to top on new chapter
            } else {
                throw new Error(data.error || '未能成功获取章节内容');
            }
        } catch (err: any) {
            setError(err.message);
        } finally {
            setIsLoading(false);
        }
    }

    // Initial fetch
    useEffect(() => {
        if (url && sourceId) {
            fetchChapter(url);
        } else {
             setIsLoading(false);
             setError('章节URL或来源ID缺失');
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []); // Only run once on initial load based on query param


    if (isLoading) {
        return <LoadingState />;
    }
    
    if (error) {
        return <div className="flex flex-col min-h-screen">
            <Header />
            <main className="flex-grow container mx-auto p-4 md:p-6 lg:p-8">
                 <div className="mb-6">
                    <Button variant="ghost" onClick={() => router.back()}>
                        <ArrowLeft className="mr-2"/>
                        返回
                    </Button>
                </div>
                <div className="text-center py-10 text-destructive">{error}</div>
            </main>
        </div>
    }

    if (!chapter) {
        return null;
    }

    return (
        <div className="flex flex-col min-h-screen">
            <Header>
                <div className="flex-grow flex justify-center items-center">
                    <h1 className="text-lg font-semibold truncate font-headline" title={chapter.title}>
                        {chapter.title}
                    </h1>
                </div>
            </Header>
            <main className="flex-grow container mx-auto px-4 md:px-6 lg:px-8 py-8">
                <ScrollArea className="h-[calc(100vh-200px)]">
                    <div className="max-w-3xl mx-auto">
                        <h1 className="text-3xl font-bold text-center mb-8 font-headline">{chapter.title}</h1>
                        <div 
                            className="prose dark:prose-invert max-w-none text-lg leading-relaxed whitespace-pre-wrap"
                            style={{ fontFamily: "'Literata', serif" }}
                        >
                            {chapter.content}
                        </div>
                    </div>
                </ScrollArea>
                <div className="flex justify-between items-center mt-8 max-w-3xl mx-auto">
                     <Button 
                        onClick={() => chapter.prevChapterUrl && fetchChapter(chapter.prevChapterUrl)}
                        disabled={!chapter.prevChapterUrl}
                        variant="outline"
                    >
                        <ArrowLeft className="mr-2"/>
                        上一章
                    </Button>
                     <Button 
                        onClick={() => router.back()}
                        variant="secondary"
                    >
                        目录
                    </Button>
                     <Button 
                        onClick={() => chapter.nextChapterUrl && fetchChapter(chapter.nextChapterUrl)}
                        disabled={!chapter.nextChapterUrl}
                        variant="outline"
                     >
                        下一章
                        <ArrowRight className="ml-2"/>
                    </Button>
                </div>
            </main>
        </div>
    );
}

function LoadingState() {
     return (
        <div className="flex flex-col min-h-screen">
            <Header>
                 <div className="flex-grow flex justify-center items-center">
                    <Skeleton className="h-6 w-48" />
                </div>
            </Header>
            <main className="flex-grow container mx-auto p-4 md:p-6 lg:p-8">
                 <div className="max-w-3xl mx-auto">
                    <Skeleton className="h-10 w-3/4 mx-auto mb-8" />
                    <div className="space-y-4">
                        <Skeleton className="h-6 w-full" />
                        <Skeleton className="h-6 w-full" />
                        <Skeleton className="h-6 w-5/6" />
                        <Skeleton className="h-6 w-full" />
                        <Skeleton className="h-6 w-full" />
                        <Skeleton className="h-6 w-3/4" />
                        <Skeleton className="h-6 w-full" />
                        <Skeleton className="h-6 w-full" />
                    </div>
                </div>
            </main>
        </div>
    );
}


export default function ReadPage() {
    return (
        <Suspense fallback={<LoadingState />}>
            <ChapterReader />
        </Suspense>
    )
}
