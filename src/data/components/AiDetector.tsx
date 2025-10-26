'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogTrigger,
} from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { Loader2, ScanLine, Brain, User } from 'lucide-react';
import { Progress } from '@/components/ui/progress';

interface AiDetectorProps {
  text: string;
}

interface DetectionResult {
  avgAiProbability: number;
  avgHumanProbability: number;
}

export default function AiDetector({ text }: AiDetectorProps) {
  const { toast } = useToast();
  const [isOpen, setIsOpen] = useState(false);
  const [result, setResult] = useState<DetectionResult | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleDetection = async () => {
    if (!text.trim()) {
      toast({
        title: '内容为空',
        description: '请输入一些文字后再进行检测。',
        variant: 'destructive',
      });
      return;
    }
    
    setIsLoading(true);
    setError(null);
    setResult(null);

    try {
      const response = await fetch('/api/bookstore/ai-detector', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'AI检测服务发生未知错误。');
      }

      setResult(data);
    } catch (err: any) {
      setError(err.message);
      toast({
        title: '检测失败',
        description: err.message,
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const onOpenChange = (open: boolean) => {
    setIsOpen(open);
    if (open) {
      // Reset state when opening
      setResult(null);
      setError(null);
      handleDetection();
    }
  };
  
  // 显示后端原始数值，不进行*100或取整
  const aiRaw = result ? Number(result.avgAiProbability) : 0;
  const humanRaw = result ? Number(result.avgHumanProbability) : 0;

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogTrigger asChild>
        <Button variant="outline">
            <ScanLine className="mr-2" />
            AI检测
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><ScanLine /> AI 内容分析</DialogTitle>
          <DialogDescription>
            分析文本由AI生成和人类创作的可能性。
          </DialogDescription>
        </DialogHeader>
        <div className="py-4 min-h-[120px] flex items-center justify-center">
            {isLoading && (
                <div className="flex flex-col items-center gap-2 text-muted-foreground">
                    <Loader2 className="h-8 w-8 animate-spin" />
                    <p>正在分析文本...</p>
                </div>
            )}
            {error && !isLoading && (
                <div className="text-center text-destructive">
                    <p>检测失败</p>
                    <p className="text-sm">{error}</p>
                </div>
            )}
            {result && !isLoading && (
                 <div className="w-full space-y-4">
                    <div className="space-y-2">
                        <div className="flex justify-between items-center text-sm font-medium">
                           <div className="flex items-center gap-2">
                             <Brain className="text-purple-500" />
                             <span>AI 生成概率</span>
                           </div>
                           <span className="font-bold text-purple-500">{String(aiRaw)}</span>
                        </div>
                        <Progress value={aiRaw} className="[&>div]:bg-purple-500" />
                    </div>
                     <div className="space-y-2">
                        <div className="flex justify-between items-center text-sm font-medium">
                            <div className="flex items-center gap-2">
                                <User className="text-green-500" />
                                <span>人类原创概率</span>
                            </div>
                           <span className="font-bold text-green-500">{String(humanRaw)}</span>
                        </div>
                        <Progress value={humanRaw} className="[&>div]:bg-green-500"/>
                    </div>
                </div>
            )}
        </div>
        <DialogFooter>
          <Button onClick={handleDetection} disabled={isLoading}>
            {isLoading ? <Loader2 className="mr-2 animate-spin" /> : null}
            重新检测
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
