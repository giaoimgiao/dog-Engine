'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useLocalStorage } from '@/hooks/useLocalStorage';
import { generateUUID } from '@/lib/utils';
import type { Book } from '@/lib/types';
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardFooter,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogTrigger,
  DialogClose,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Plus, BookOpen, Trash2, Book as BookIcon } from 'lucide-react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import { Skeleton } from './ui/skeleton';

export function BookList() {
  const [books, setBooks] = useLocalStorage<Book[]>('books', []);
  const [newBookTitle, setNewBookTitle] = useState('');
  const [newBookDescription, setNewBookDescription] = useState('');
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  const handleCreateBook = () => {
    if (newBookTitle.trim()) {
      const newBook: Book = {
        id: generateUUID(),
        title: newBookTitle.trim(),
        description: newBookDescription.trim(),
        chapters: [
          {
            id: generateUUID(),
            title: '第一章',
            content: '',
          },
        ],
      };
      setBooks([...books, newBook]);
      setNewBookTitle('');
      setNewBookDescription('');
      setIsDialogOpen(false);
    }
  };
  
  const handleDeleteBook = (bookId: string) => {
    setBooks(books.filter(book => book.id !== bookId));
  };

  if (!isMounted) {
    return (
        <div>
            <div className="flex justify-between items-center mb-6">
                <Skeleton className="h-10 w-48" />
                <Skeleton className="h-10 w-32" />
            </div>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                {[...Array(4)].map((_, i) => (
                    <Card key={i}>
                        <CardHeader>
                            <Skeleton className="h-6 w-3/4 mb-2" />
                            <Skeleton className="h-4 w-full" />
                             <Skeleton className="h-4 w-1/2" />
                        </CardHeader>
                        <CardFooter>
                           <Skeleton className="h-10 w-24" />
                        </CardFooter>
                    </Card>
                ))}
            </div>
        </div>
    );
  }

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold font-headline">我的书架</h1>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="mr-2 h-4 w-4" />
              创建新书
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[425px] bg-background">
            <DialogHeader>
              <DialogTitle className="font-headline">创建一本新书</DialogTitle>
              <DialogDescription>
                给你的新故事起一个名字和简介。
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="title" className="text-right">
                  书名
                </Label>
                <Input
                  id="title"
                  value={newBookTitle}
                  onChange={(e) => setNewBookTitle(e.target.value)}
                  className="col-span-3"
                  placeholder="请输入书名"
                />
              </div>
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="description" className="text-right">
                  简介
                </Label>
                <Textarea
                  id="description"
                  value={newBookDescription}
                  onChange={(e) => setNewBookDescription(e.target.value)}
                  className="col-span-3"
                  placeholder="简单描述一下你的故事"
                />
              </div>
            </div>
            <DialogFooter>
              <DialogClose asChild>
                <Button variant="secondary">取消</Button>
              </DialogClose>
              <Button onClick={handleCreateBook} disabled={!newBookTitle.trim()}>创建</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {books.length > 0 ? (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {books.map((book) => (
            <Card key={book.id} className="flex flex-col justify-between bg-card hover:shadow-lg transition-shadow duration-300">
              <CardHeader>
                <CardTitle className="font-headline flex items-center gap-2"><BookIcon className="w-5 h-5"/>{book.title}</CardTitle>
                <CardDescription className="line-clamp-3 h-[60px]">{book.description || '暂无简介'}</CardDescription>
              </CardHeader>
              <CardFooter className="flex justify-between">
                <Link href={`/books/${book.id}`} passHref>
                  <Button variant="outline">
                    <BookOpen className="mr-2 h-4 w-4" />
                    打开
                  </Button>
                </Link>
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button variant="ghost" size="icon" className="text-destructive/70 hover:text-destructive hover:bg-destructive/10">
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>确定要删除这本书吗？</AlertDialogTitle>
                      <AlertDialogDescription>
                        这个操作无法撤销。这本书以及其中所有的章节都将被永久删除。
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>取消</AlertDialogCancel>
                      <AlertDialogAction onClick={() => handleDeleteBook(book.id)} className="bg-destructive hover:bg-destructive/90">
                        删除
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </CardFooter>
            </Card>
          ))}
        </div>
      ) : (
        <div className="text-center py-20 border-2 border-dashed rounded-lg">
          <h2 className="text-xl font-semibold text-muted-foreground">书架是空的</h2>
          <p className="text-muted-foreground mt-2">点击“创建新书”开始你的创作之旅吧！</p>
        </div>
      )}
    </div>
  );
}
