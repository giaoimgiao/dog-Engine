import { BookList } from '@/components/BookList';
import Header from '@/components/Header';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { FileScan, Library, Users, Settings, Sparkles } from 'lucide-react';
import Link from 'next/link';

export default function Home() {
  return (
    <div className="flex flex-col min-h-screen">
      <Header />
      <main className="flex-grow container mx-auto p-4 md:p-6 lg:p-8">
        <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card className="bg-card/50 border-dashed">
             <CardHeader>
                <CardTitle className="font-headline flex items-center gap-2">
                  <Library className="w-6 h-6 text-primary" />
                  在线书城
                </CardTitle>
                <CardDescription>
                  从海量网络小说中发现灵感，一键将任意书籍导入你的书架，作为创作的起点或参考。
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Link href="/bookstore" passHref>
                  <Button variant="outline">进入书城</Button>
                </Link>
              </CardContent>
          </Card>
          <Card className="bg-card/50 border-dashed">
             <CardHeader>
                <CardTitle className="font-headline flex items-center gap-2">
                  <Sparkles className="w-6 h-6 text-primary" />
                  网文天赋测试
                </CardTitle>
                <CardDescription>
                  一套轻量问答，实时扣分显示，测测你的网文创作天赋。
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Link href="/talent-test" passHref>
                  <Button variant="outline">开始测试</Button>
                </Link>
              </CardContent>
          </Card>
          <Card className="bg-card/50 border-dashed">
             <CardHeader>
                <CardTitle className="font-headline flex items-center gap-2">
                  <FileScan className="w-6 h-6 text-primary" />
                  网文审稿
                </CardTitle>
                <CardDescription>
                  让 AI 模拟资深网文编辑，为你的作品开头提供一针见血的专业反馈，判断是否达到签约标准。
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Link href="/review" passHref>
                  <Button variant="outline">开始审稿</Button>
                </Link>
              </CardContent>
          </Card>
           <Card className="bg-card/50 border-dashed">
             <CardHeader>
                <CardTitle className="font-headline flex items-center gap-2">
                  <Users className="w-6 h-6 text-primary" />
                  创作社区
                </CardTitle>
                <CardDescription>
                  分享和发现优秀的 AI 角色设定，激发你的创作灵感，让笔下的人物更加生动。
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Link href="/community" passHref>
                  <Button variant="outline">进入社区</Button>
                </Link>
              </CardContent>
          </Card>
          <Card className="bg-card/50 border-dashed">
             <CardHeader>
                <CardTitle className="font-headline flex items-center gap-2">
                  <Settings className="w-6 h-6 text-primary" />
                  书源管理
                </CardTitle>
                <CardDescription>
                  添加或编辑你的专属网络小说书源，打造个性化的在线书库，让AI续写永不间断。
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Link href="/settings" passHref>
                  <Button variant="outline">配置书源</Button>
                </Link>
              </CardContent>
          </Card>
        </div>
        <div className="mt-8">
          <BookList />
        </div>
      </main>
    </div>
  );
}
