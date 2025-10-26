
'use client';

import { Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { useState, useEffect } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import Header from '@/components/Header';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { ArrowLeft, BookText, User, Tag } from 'lucide-react';
import type { BookstoreBook } from '@/lib/types';
import { DeconstructOutline } from '@/components/DeconstructOutline';

function CategoryBooks() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const name = searchParams.get('name') || '';
    const url = searchParams.get('url') || '';
    const sourceId = searchParams.get('sourceId') || '';
    
    const [books, setBooks] = useState<BookstoreBook[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        async function fetchBooks() {
            if (!url || !sourceId) {
                setIsLoading(false);
                setError('分类URL或来源ID缺失');
                return;
            };
            setIsLoading(true);
            setError(null);
            try {
                const res = await fetch(`/api/bookstore/category?url=${encodeURIComponent(url)}&sourceId=${sourceId}`);
                if (!res.ok) {
                    throw new Error('获取分类书籍失败，请稍后再试');
                }
                const data = await res.json();
                if(data.success) {
                    setBooks(data.books);
                } else {
                    throw new Error(data.error || '未能成功获取分类书籍');
                }
            } catch (err: any) {
                setError(err.message);
            } finally {
                setIsLoading(false);
            }
        }
        fetchBooks();
    }, [url, sourceId]);

    const renderContent = () => {
        if (isLoading) {
            return (
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
                    {[...Array(12)].map((_, i) => (
                        <Card key={i} className="flex flex-col">
                            <Skeleton className="aspect-[3/4] w-full rounded-t-lg" />
                            <div className="p-4 space-y-2">
                                <Skeleton className="h-5 w-3/4" />
                                <Skeleton className="h-4 w-1/2" />
                            </div>
                        </Card>
                    ))}
                </div>
            );
        }
        
        if (error) {
            return <div className="text-center py-10 text-destructive">{error}</div>
        }
        
        if (books.length === 0) {
            return (
                 <div className="text-center py-20 border-2 border-dashed rounded-lg">
                    <h2 className="text-xl font-semibold text-muted-foreground">该分类下暂无书籍</h2>
                    <p className="text-muted-foreground mt-2">请尝试浏览其他分类。</p>
                </div>
            )
        }
        
        return (
             <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
                {books.map((book, index) => (
                    <Card key={book.detailUrl || `book-${index}`} className="hover:shadow-md transition-shadow group relative">
                         <div className="absolute top-2 left-2 z-10 transition-opacity">
                            <DeconstructOutline bookDetailUrl={book.detailUrl} sourceId={book.sourceId} />
                        </div>
                        <Link href={`/bookstore/book?url=${encodeURIComponent(book.detailUrl)}&sourceId=${book.sourceId}`} passHref>
                            <div className="relative aspect-[3/4] w-full">
                                <Image
                                  src={book.cover ? `/api/proxy-image?url=${encodeURIComponent(book.cover)}` : `https://placehold.co/300x400.png`}
                                  alt={book.title}
                                  fill
                                  className="object-cover rounded-t-lg"
                                  data-ai-hint="book cover"
                                />
                            </div>
                            <div className="p-3">
                                <h3 className="text-sm font-bold font-headline line-clamp-1">{book.title}</h3>
                                <p className="text-xs text-muted-foreground mt-1 line-clamp-1">{book.author}</p>
                            </div>
                        </Link>
                    </Card>
                ))}
            </div>
        )
    }

    return (
        <div className="flex flex-col min-h-screen">
            <Header />
            <main className="flex-grow container mx-auto p-4 md:p-6 lg:p-8">
                <div className="mb-6">
                    <Button variant="ghost" onClick={() => router.push('/bookstore')}>
                        <ArrowLeft className="mr-2"/>
                        返回书城
                    </Button>
                </div>

                <div className="flex items-center gap-2 mb-6">
                    <h1 className="text-3xl font-bold font-headline">{name || '分类书籍'}</h1>
                </div>
                
                {renderContent()}
            </main>
        </div>
    );
}


export default function CategoryPage() {
    return (
        <Suspense fallback={<div>Loading...</div>}>
            <CategoryBooks />
        </Suspense>
    )
}
