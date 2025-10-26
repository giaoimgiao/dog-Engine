'use client';

import { useState, useEffect, FormEvent } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import Header from '@/components/Header';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Search, Flame, Tag, BookText, ChevronRight } from 'lucide-react';
import type { BookstoreBook, BookstoreCategory, BookSource } from '@/lib/types';
import { DeconstructOutline } from '@/components/DeconstructOutline';
import { BookSourceSettings } from '@/components/BookSourceSettings';
import Image from 'next/image';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Label } from '@/components/ui/label';

async function fetchSources(): Promise<BookSource[]> {
    try {
        const res = await fetch('/api/get-book-sources');
        if (!res.ok) return [];
        const data = await res.json();
        return data.sources || [];
    } catch (e) {
        return [];
    }
}


function BookCard({ book }: { book: BookstoreBook }) {
  // 如果没有detailUrl，不显示链接
  if (!book.detailUrl) {
    return (
      <Card className="flex flex-col opacity-50">
        <CardContent className="p-0">
          <div className="relative aspect-[3/4] w-full">
            <Image
              src={book.cover || `https://placehold.co/300x400.png`}
              alt={book.title}
              fill
              className="object-cover rounded-t-lg"
            />
          </div>
        </CardContent>
        <div className="p-3 flex-grow flex flex-col">
          <h3 className="text-sm font-bold line-clamp-1 font-headline">{book.title}</h3>
          <p className="text-xs line-clamp-1 text-muted-foreground mt-1">{book.author}</p>
          <p className="text-xs text-red-500 mt-1">URL解析失败</p>
        </div>
      </Card>
    );
  }
  
  return (
    <Card className="flex flex-col hover:shadow-lg transition-shadow duration-200 group relative">
      <div className="absolute top-2 left-2 z-10 transition-opacity">
        <DeconstructOutline bookDetailUrl={book.detailUrl} sourceId={book.sourceId} />
      </div>
      <Link href={`/bookstore/book?url=${encodeURIComponent(book.detailUrl)}&sourceId=${book.sourceId}`} passHref className="flex flex-col flex-grow">
        <CardContent className="p-0">
            <div className="relative aspect-[3/4] w-full">
              <Image
                src={book.cover || `https://placehold.co/300x400.png`}
                alt={book.title}
                fill
                className="object-cover rounded-t-lg"
                data-ai-hint="book cover"
              />
            </div>
        </CardContent>
        <div className="p-3 flex-grow flex flex-col">
          <h3 className="text-sm font-bold line-clamp-1 font-headline">{book.title}</h3>
          <p className="text-xs line-clamp-1 text-muted-foreground mt-1">{book.author}</p>
        </div>
      </Link>
    </Card>
  );
}

function CategoryLinkCard({ category }: { category: BookstoreCategory }) {
    // 如果没有URL，显示为提示卡片（不可点击）
    if (!category.url) {
        return (
            <Card className="bg-muted/50 h-full flex items-center justify-center p-3 text-center border-dashed">
                <p className="text-xs text-muted-foreground">{category.title}</p>
            </Card>
        );
    }
    
    return (
        <Link href={`/bookstore/category?url=${encodeURIComponent(category.url)}&name=${encodeURIComponent(category.title)}&sourceId=${category.sourceId}`} passHref>
             <Card className="bg-card/80 hover:bg-card hover:shadow-md transition-all h-full flex items-center justify-center p-3 text-center">
                <h3 className="text-sm font-semibold font-headline">{category.title}</h3>
            </Card>
        </Link>
    )
}

function LoadingState() {
    return (
        <div>
            <div className="flex items-center gap-2 mb-4">
                <Flame className="text-primary" />
                <h2 className="text-2xl font-bold font-headline">热门推荐</h2>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4 mb-8">
                {[...Array(6)].map((_, i) => (
                    <div key={i}>
                        <Skeleton className="aspect-[3/4] w-full rounded-lg" />
                        <Skeleton className="h-5 w-3/4 mt-2" />
                        <Skeleton className="h-4 w-1/2 mt-1" />
                    </div>
                ))}
            </div>
             <div className="flex items-center gap-2 mb-4">
                <Tag className="text-primary" />
                <h2 className="text-2xl font-bold font-headline">分类导航</h2>
            </div>
            <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8 gap-3">
                {[...Array(16)].map((_, i) => (
                    <Skeleton key={i} className="h-10 w-full" />
                ))}
            </div>
        </div>
    );
}

export default function BookstorePage() {
    const router = useRouter();
    const [hotBooks, setHotBooks] = useState<BookstoreBook[]>([]);
    const [categories, setCategories] = useState<BookstoreCategory[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');

    const [allSources, setAllSources] = useState<BookSource[]>([]);
    const [enabledSources, setEnabledSources] = useState<BookSource[]>([]);
    const [selectedSourceId, setSelectedSourceId] = useState('');


    useEffect(() => {
        fetchSources().then(sources => {
            setAllSources(sources);
            const activeSources = sources.filter(s => s.enabled);
            setEnabledSources(activeSources);
            if (activeSources.length > 0) {
                const lastUsedSourceId = localStorage.getItem('last-used-source-id');
                if (lastUsedSourceId && activeSources.some(s => s.id === lastUsedSourceId)) {
                    setSelectedSourceId(lastUsedSourceId);
                } else {
                    setSelectedSourceId(activeSources[0].id);
                }
            } else {
                setIsLoading(false);
            }
        });
    }, []);

    const handleSourceChange = (sourceId: string) => {
        setSelectedSourceId(sourceId);
        localStorage.setItem('last-used-source-id', sourceId);
    }
    
    useEffect(() => {
        async function fetchData() {
            if (!selectedSourceId) {
                setIsLoading(false);
                return
            };

            setIsLoading(true);
            setHotBooks([]);
            setCategories([]);
            const source = enabledSources.find(s => s.id === selectedSourceId);
            if (!source) {
                 setIsLoading(false);
                 return;
            }
            
            const findRule = source.rules?.find;
            const findUrl = findRule?.url;
            const exploreUrl = source.exploreUrl;
            
            let apiUrl = '';
            // Avoid sending long URLs in query to prevent 431; use server-side mode instead
            if (exploreUrl) {
                apiUrl = `/api/bookstore/category?mode=explore&sourceId=${selectedSourceId}`;
            } else if (findUrl) {
                apiUrl = `/api/bookstore/category?mode=find&sourceId=${selectedSourceId}`;
            } else {
                setIsLoading(false);
                return;
            }

            try {
                const res = await fetch(apiUrl, { cache: 'no-store', next: { revalidate: 0 }, /* @ts-ignore */ signal: AbortSignal.timeout(15000) });
                if (res.ok) {
                    const data = await res.json();
                    if (data.success) {
                        if(data.books) {
                            setHotBooks(data.books.slice(0, 12));
                        } else if (data.categories) {
                            setCategories(data.categories);
                        }
                    }
                } else {
                    const text = await res.text().catch(() => '');
                    console.error('Bookstore API error:', res.status, text);
                }
            } catch (error) {
                console.error("Failed to fetch bookstore data:", error);
            } finally {
                setIsLoading(false);
            }
        }
        if (enabledSources.length > 0 && selectedSourceId) {
            fetchData();
        }
    }, [selectedSourceId, enabledSources]);
    
    const handleSearch = (e: FormEvent) => {
        e.preventDefault();
        if(searchQuery.trim() && selectedSourceId){
            router.push(`/bookstore/search?q=${encodeURIComponent(searchQuery)}&sourceId=${selectedSourceId}`);
        }
    }

    return (
        <div className="flex flex-col min-h-screen">
            <Header />
            <main className="flex-grow container mx-auto p-4 md:p-6 lg:p-8">
                <div className="max-w-2xl mx-auto mb-8">
                    <form onSubmit={handleSearch} className="flex flex-col gap-4">
                        <div className="relative">
                            <Input 
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                placeholder="搜索书名或作者..." 
                                className="text-lg py-6 pl-12"
                            />
                            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground" />
                        </div>
                         <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
                            <div className="md:col-span-2">
                               <Label htmlFor="source-select">选择书源</Label>
                                <Select onValueChange={handleSourceChange} value={selectedSourceId}>
                                    <SelectTrigger id="source-select">
                                        <SelectValue placeholder="请选择一个书源" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {enabledSources.map(source => (
                                            <SelectItem key={source.id} value={source.id}>{source.name}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="flex gap-2">
                                {selectedSourceId && enabledSources.find(s => s.id === selectedSourceId) && (
                                    <BookSourceSettings 
                                        source={enabledSources.find(s => s.id === selectedSourceId)!}
                                        onSettingsChange={() => {
                                            // 重新加载数据
                                            const source = enabledSources.find(s => s.id === selectedSourceId);
                                            if (source) {
                                                setIsLoading(true);
                                                setTimeout(() => {
                                                    setSelectedSourceId('');
                                                    setTimeout(() => setSelectedSourceId(source.id), 100);
                                                }, 100);
                                            }
                                        }}
                                    />
                                )}
                                <Button type="submit" disabled={isLoading} className="flex-1 h-10">搜索</Button>
                            </div>
                        </div>
                    </form>
                </div>
                
                {isLoading ? <LoadingState /> : (
                    <>
                        <div className="mb-12">
                             {hotBooks.length > 0 && (
                                <>
                                <div className="flex items-center gap-2 mb-4">
                                    <Flame className="text-primary" />
                                    <h2 className="text-2xl font-bold font-headline">热门推荐</h2>
                                </div>
                                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
                                    {hotBooks.map(book => <BookCard key={`${book.detailUrl}-${book.sourceId}`} book={book} />)}
                                </div>
                                </>
                             )}
                              {categories.length > 0 && (
                                <>
                                <div className="flex items-center gap-2 mb-4">
                                    <Tag className="text-primary" />
                                    <h2 className="text-2xl font-bold font-headline">分类导航</h2>
                                </div>
                                <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-8 gap-3">
                                    {categories.map((cat, index) => <CategoryLinkCard key={`${cat.sourceId}-${index}-${cat.title}-${cat.url || 'no-url'}`} category={cat} />)}
                                </div>
                                </>
                             )}

                             {hotBooks.length === 0 && categories.length === 0 && (
                                <p className="text-muted-foreground text-center py-10">无法加载推荐或分类。请检查您的书源配置或网络。</p>
                             )}
                        </div>
                    </>
                )}
            </main>
        </div>
    );
}
