
'use client';

import { Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { useState, useEffect } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import Header from '@/components/Header';
import { generateUUID } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { ArrowLeft, BookUp, Library, Loader2, ArrowRight } from 'lucide-react';
import type { BookstoreBookDetail, Book as LocalBook, Chapter as LocalChapter } from '@/lib/types';
import { Badge } from '@/components/ui/badge';
import { useLocalStorage } from '@/hooks/useLocalStorage';
import { useToast } from '@/hooks/use-toast';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion"


function BookDetail() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const url = (searchParams && searchParams.get('url')) || '';
    const sourceId = (searchParams && searchParams.get('sourceId')) || '';
    
    const [books, setBooks] = useLocalStorage<LocalBook[]>('books', []);
    const { toast } = useToast();
    
    const [book, setBook] = useState<BookstoreBookDetail | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [isImporting, setIsImporting] = useState(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        async function fetchBook() {
            if (!url || !sourceId) {
                setIsLoading(false);
                setError('书籍URL或来源ID缺失');
                return;
            };
            setIsLoading(true);
            setError(null);
            try {
                const res = await fetch(`/api/bookstore/book?url=${encodeURIComponent(url)}&sourceId=${sourceId}`);
                if (!res.ok) {
                    const errorData = await res.json();
                    throw new Error(errorData.details || '获取书籍详情失败');
                }
                const data = await res.json();
                if(data.success) {
                    setBook(data.book);
                } else {
                    throw new Error(data.error || '未能成功获取书籍详情');
                }
            } catch (err: any) {
                setError(err.message);
            } finally {
                setIsLoading(false);
            }
        }
        fetchBook();
    }, [url, sourceId]);
    
    const handleImportBook = () => {
        if (!book) return;
        setIsImporting(true);
        
        const isAlreadyImported = books.some(b => b.detailUrl === url);
        if (isAlreadyImported) {
            toast({
                title: '书籍已在书架中',
                description: '这本书已经存在于您的本地书架了。',
                variant: 'default'
            });
            setIsImporting(false);
            router.push('/');
            return;
        }

        const newBook: LocalBook = {
            id: generateUUID(),
            title: book.title,
            description: book.description,
            author: book.author,
            category: book.category,
            cover: book.cover,
            latestChapter: book.latestChapter,
            detailUrl: url,
            sourceId: sourceId as any,
            chapters: book.chapters.map(ch => ({
                id: generateUUID(),
                title: ch.title,
                content: ``, // Content will be fetched on demand
                url: ch.url,
            })),
        };
        
        setBooks([...books, newBook]);
        
        toast({
            title: '导入成功',
            description: `《${book.title}》已成功加入您的书架。`,
        });

        setTimeout(() => {
            setIsImporting(false);
            router.push('/');
        }, 1000);
    }

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

    if (!book) {
        return null;
    }

    return (
        <div className="flex flex-col min-h-screen">
            <Header />
            <main className="flex-grow container mx-auto p-4 md:p-6 lg:p-8">
                 <div className="mb-6">
                    <Button variant="ghost" onClick={() => router.back()}>
                        <ArrowLeft className="mr-2"/>
                        返回
                    </Button>
                </div>
                
                <div className="grid md:grid-cols-4 gap-8">
                    <div className="md:col-span-1">
                        <Image
                          src={book.cover ? `/api/proxy-image?url=${encodeURIComponent(book.cover)}` : `https://placehold.co/300x400.png`}
                          alt={book.title}
                          width={300}
                          height={400}
                          className="object-cover rounded-lg w-full shadow-lg"
                          data-ai-hint="book cover"
                        />
                        <div className="mt-4 flex flex-col gap-2">
                             <Button onClick={handleImportBook} disabled={isImporting}>
                                {isImporting ? <Loader2 className="animate-spin mr-2"/> : <BookUp className="mr-2"/>}
                                {isImporting ? "正在加入书架..." : "加入我的书架"}
                            </Button>
                            {book.chapters.length > 0 && (
                                <Link href={`/bookstore/read?url=${encodeURIComponent(book.chapters[0].url)}&sourceId=${sourceId}`} passHref>
                                    <Button variant="outline" className="w-full">
                                        开始阅读
                                        <ArrowRight className="ml-2"/>
                                    </Button>
                                </Link>
                            )}
                        </div>
                    </div>
                    
                    <div className="md:col-span-3">
                        <h1 className="text-3xl lg:text-4xl font-bold font-headline">{book.title}</h1>
                        <div className="flex items-center gap-4 mt-2 text-muted-foreground">
                            <span>{book.author}</span>
                            <Badge variant="outline">{book.category}</Badge>
                        </div>
                        <p className="mt-4 text-muted-foreground line-clamp-1">最新章节：{book.latestChapter}</p>
                        
                        <Accordion type="single" collapsible defaultValue="description" className="w-full mt-6">
                          <AccordionItem value="description">
                            <AccordionTrigger>简介</AccordionTrigger>
                            <AccordionContent>
                              <div 
                                className="text-foreground/80 prose prose-sm max-w-none dark:prose-invert [&>br]:my-1 [&>p]:my-2"
                                dangerouslySetInnerHTML={{ __html: book.description || "暂无简介" }}
                              />
                              
                              {/* 动态展示额外信息 */}
                              {book.extraInfo && Object.keys(book.extraInfo).length > 0 && (
                                <div className="mt-4 pt-4 border-t border-border/50">
                                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm">
                                    {Object.entries(book.extraInfo).map(([key, value]) => (
                                      <div key={key} className="flex gap-2">
                                        <span className="font-medium text-muted-foreground">{key}：</span>
                                        <span className="text-foreground">{value}</span>
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              )}
                            </AccordionContent>
                          </AccordionItem>
                          <AccordionItem value="chapters">
                            <AccordionTrigger>目录（共 {book.chapters.length} 章）</AccordionTrigger>
                            <AccordionContent>
                                {(() => {
                                  const safeChapters = (book.chapters || []).filter((ch) => typeof ch?.url === 'string' && ch.url.trim().length > 0);
                                  return (
                                    <div className="space-y-1 max-h-96 overflow-y-auto">
                                      {safeChapters.map((chapter, index) => (
                                        <Link key={`${index}-${chapter.url}`} href={`/bookstore/read?url=${encodeURIComponent(chapter.url)}&sourceId=${sourceId}`} passHref>
                                            <div className="group hover:bg-accent/50 p-2 rounded-md transition-colors">
                                                <div className="text-sm font-medium group-hover:text-primary transition-colors">
                                                    {chapter.title}
                                                </div>
                                                {chapter.intro && (
                                                    <div className="text-xs text-muted-foreground mt-1 line-clamp-2">
                                                        {chapter.intro}
                                                    </div>
                                                )}
                                            </div>
                                        </Link>
                                      ))}
                                    </div>
                                  );
                                })()}
                            </AccordionContent>
                          </AccordionItem>
                        </Accordion>
                    </div>
                </div>

            </main>
        </div>
    );
}

function LoadingState() {
     return (
        <div className="flex flex-col min-h-screen">
            <Header />
            <main className="flex-grow container mx-auto p-4 md:p-6 lg:p-8">
                 <div className="mb-6">
                    <Skeleton className="h-10 w-28" />
                </div>
                <div className="grid md:grid-cols-4 gap-8">
                    <div className="md:col-span-1">
                        <Skeleton className="w-full aspect-[3/4] rounded-lg" />
                         <div className="mt-4 flex flex-col gap-2">
                            <Skeleton className="h-10 w-full" />
                            <Skeleton className="h-10 w-full" />
                         </div>
                    </div>
                    <div className="md:col-span-3">
                        <Skeleton className="h-12 w-3/4" />
                        <div className="flex items-center gap-4 mt-4">
                            <Skeleton className="h-6 w-24" />
                            <Skeleton className="h-6 w-16" />
                        </div>
                         <Skeleton className="h-5 w-1/2 mt-4" />
                         <Skeleton className="h-20 w-full mt-6" />
                         <Skeleton className="h-12 w-full mt-2" />
                    </div>
                </div>
            </main>
        </div>
    );
}


export default function BookstoreBookPage() {
    return (
        <Suspense fallback={<LoadingState />}>
            <BookDetail />
        </Suspense>
    )
}
