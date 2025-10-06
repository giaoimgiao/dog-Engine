import Link from 'next/link';
import Logo from './Logo';
import { Book, Globe, Users, Library, Settings, Home } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { AIProviderSettings } from './AIProviderSettings';

type HeaderProps = {
  children?: React.ReactNode;
};

export default function Header({ children }: HeaderProps) {
  return (
    <header className="sticky top-0 z-40 w-full border-b bg-background/80 backdrop-blur-sm">
      <div className="container mx-auto flex h-16 items-center justify-between px-4">
        <div className="flex items-center gap-4">
            <Link href="/">
              <Logo />
            </Link>
            <nav className="hidden md:flex items-center gap-2">
                <Link href="/" passHref>
                    <Button variant="ghost" className="flex items-center gap-1">
                        <Home className="h-4 w-4" />
                        主页
                    </Button>
                </Link>
                 <Link href="/bookstore" passHref>
                    <Button variant="ghost" className="flex items-center gap-1">
                        <Library className="h-4 w-4" />
                        书城
                    </Button>
                </Link>
                 <Link href="/community" passHref>
                    <Button variant="ghost" className="flex items-center gap-1">
                        <Users className="h-4 w-4" />
                        社区
                    </Button>
                </Link>
                <Link href="/settings" passHref>
                    <Button variant="ghost" className="flex items-center gap-1">
                        <Settings className="h-4 w-4" />
                        设置
                    </Button>
                </Link>
            </nav>
        </div>
        <div className="flex items-center gap-2">
          <AIProviderSettings variant="ghost" showStatus={true} />
          {children}
        </div>
      </div>
    </header>
  );
}
