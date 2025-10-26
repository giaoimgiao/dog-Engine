
'use client';

import { Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { useState, useEffect, FormEvent } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import Header from '@/components/Header';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Search, BookText, User, Tag, ArrowLeft } from 'lucide-react';
import type { BookstoreBook, BookSource } from '@/lib/types';
import { Badge } from '@/components/ui/badge';
import { DeconstructOutline } from '@/components/DeconstructOutline';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Label } from '@/components/ui/label';
import { Loader2 } from 'lucide-react';

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

function SearchResults() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const q = (searchParams && searchParams.get('q')) || '';
    const sourceIdParam = (searchParams && searchParams.get('sourceId')) || '';
    
    const [allSources, setAllSources] = useState<BookSource[]>([]);
    const [enabledSources, setEnabledSources] = useState<BookSource[]>([]);
    const [selectedSourceId, setSelectedSourceId] = useState(sourceIdParam);
    
    const [searchQuery, setSearchQuery] = useState(q);
    const [results, setResults] = useState<BookstoreBook[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

     useEffect(() => {
        fetchSources().then(sources => {
            setAllSources(sources);
            const activeSources = sources.filter(s => s.enabled);
            setEnabledSources(activeSources);
            if(sourceIdParam) {
                setSelectedSourceId(sourceIdParam);
            } else if (activeSources.length > 0) {
                setSelectedSourceId(activeSources[0].id);
            }
        });
    }, [sourceIdParam]);

    const performSearch = async (query: string, sourceId: string) => {
        if (!query || !sourceId) {
            setResults([]);
            return;
        };

        setIsLoading(true);
        setError(null);
        try {
            const res = await fetch(`/api/bookstore/search?q=${encodeURIComponent(query)}&sourceId=${sourceId}`);
            if (!res.ok) {
                const errData = await res.json();
                throw new Error(errData.details || '搜索失败，请稍后再试');
            }
            const data = await res.json();
            if(data.success) {
                setResults(data.books);
            } else {
                throw new Error(data.error || '未能成功获取搜索结果');
            }
        } catch (err: any) {
            setError(err.message);
        } finally {
            setIsLoading(false);
        }
    }

    useEffect(() => {
        // This effect will run when `q` or `selectedSourceId` changes from the URL or user selection
        if (q && selectedSourceId) {
            performSearch(q, selectedSourceId);
        }
    // We only want to trigger search based on URL params `q` and the `selectedSourceId`
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [q, selectedSourceId]);

    const handleSearch = (e: FormEvent) => {
        e.preventDefault();
        if(searchQuery.trim() && selectedSourceId){
            // Use router.push to trigger a re-render with new search params
            router.push(`/bookstore/search?q=${encodeURIComponent(searchQuery)}&sourceId=${selectedSourceId}`);
        }
    }
    
    const renderContent = () => {
        if (isLoading) {
            return (
                <div className="space-y-4">
                    {[...Array(5)].map((_, i) => (
                        <Card key={i} className="flex gap-4 p-4">
                            <Skeleton className="h-32 w-24 rounded flex-shrink-0" />
                            <div className="flex-grow space-y-2">
                                <Skeleton className="h-6 w-3/4" />
                                <Skeleton className="h-4 w-1/4" />
                                <Skeleton className="h-4 w-1/2" />
                                <Skeleton className="h-4 w-2/3" />
                            </div>
                        </Card>
                    ))}
                </div>
            );
        }
        
        if (error) {
            return <div className="text-center py-10 text-destructive">{error}</div>
        }
        
        if (results.length === 0 && q) {
            return (
                 <div className="text-center py-20 border-2 border-dashed rounded-lg">
                    <h2 className="text-xl font-semibold text-muted-foreground">未能找到与“{q}”相关的书籍</h2>
                    <p className="text-muted-foreground mt-2">请尝试更换关键词、检查输入是否有误或切换书源。</p>
                </div>
            )
        }
        
        return (
            <div className="space-y-4">
                {results.map((book, index) => (
                    <Card key={book.detailUrl || `book-${index}`} className="hover:shadow-md transition-shadow group relative">
                        <div className="absolute top-2 left-2 z-10 transition-opacity">
                            <DeconstructOutline bookDetailUrl={book.detailUrl} sourceId={book.sourceId} />
                        </div>
                        <Link href={`/bookstore/book?url=${encodeURIComponent(book.detailUrl)}&sourceId=${book.sourceId}`} passHref>
                            <div className="flex items-start gap-4 p-4">
                                <div className="flex-shrink-0">
                                    <Image
                                      src={book.cover ? `/api/proxy-image?url=${encodeURIComponent(book.cover)}` : `https://placehold.co/120x160.png`}
                                      alt={book.title}
                                      width={90}
                                      height={120}
                                      className="object-cover rounded"
                                      data-ai-hint="book cover"
                                    />
                                </div>
                                <div className="flex-grow overflow-hidden">
                                    <h3 className="text-lg font-bold font-headline truncate">{book.title}</h3>
                                    <div className="text-sm text-muted-foreground mt-1 space-y-1">
                                       <p className="flex items-center gap-2 truncate"><User className="w-4 h-4 flex-shrink-0"/> {book.author}</p>
                                       <p className="flex items-center gap-2 truncate"><Tag className="w-4 h-4 flex-shrink-0"/> {book.category || '未知分类'}</p>
                                       <p className="flex items-center gap-2 truncate"><BookText className="w-4 h-4 flex-shrink-0"/> <span className="truncate">{book.latestChapter || '暂无最新章节'}</span></p>
                                    </div>
                                </div>
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
                                <Select onValueChange={setSelectedSourceId} value={selectedSourceId}>
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
                            <Button type="submit" disabled={isLoading} className="w-full h-10">
                                {isLoading ? <Loader2 className="animate-spin" /> : "搜索"}
                            </Button>
                        </div>
                    </form>
                </div>
                
                <div className="mb-4">
                    <Button variant="ghost" onClick={() => router.push('/bookstore')}>
                        <ArrowLeft className="mr-2"/>
                        返回书城
                    </Button>
                </div>
                
                {q && (
                  <div className="flex items-center gap-2 mb-4">
                    <h1 className="text-2xl font-bold font-headline">搜索结果</h1>
                     <Badge variant="secondary">“{q}”</Badge>
                  </div>
                )}
                
                {renderContent()}
            </main>
        </div>
    );
}


export default function SearchPage() {
    return (
        <Suspense fallback={<div>Loading...</div>}>
            <SearchResults />
        </Suspense>
    )
}
