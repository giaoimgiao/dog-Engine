'use client';

import { useState, useMemo } from 'react';
import { useLocalStorage } from '@/hooks/useLocalStorage';
import Header from '@/components/Header';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Loader2, CheckCircle, XCircle, FileScan, Copy, BadgeHelp, WandSparkles } from 'lucide-react';
import type { Book, Chapter, ReviewResult } from '@/lib/types';
import { useToast } from '@/hooks/use-toast';
import copy from 'copy-to-clipboard';
import { Badge } from '@/components/ui/badge';
import { useAI } from '@/hooks/useAI';
import { useAIConfig } from '@/hooks/useAIConfig';
import ModelSelector from '@/components/ModelSelector';
import { AIProviderSettings } from '@/components/AIProviderSettings';

const MAX_CHAR_LIMIT = 10000;

export default function ReviewPage() {
  const [books] = useLocalStorage<Book[]>('books', []);
  const { toast } = useToast();

  const [selectedBookId, setSelectedBookId] = useState<string | null>(null);
  const [selectedChapterId, setSelectedChapterId] = useState<string | null>(null);
  const [pastedText, setPastedText] = useState('');
  
  const [isLoading, setIsLoading] = useState(false);
  const [reviewResult, setReviewResult] = useState<ReviewResult | null>(null);
  // 流式输出：实时显示审稿内容与动态判定
  const [liveOutput, setLiveOutput] = useState<string>('');
  const [liveDecision, setLiveDecision] = useState<'' | '过稿' | '拒稿' | '修订'>('');

  // 使用统一AI配置和调用
  const { selectedProviderId, selectedModelId, setSelectedProvider, setSelectedModel } = useAIConfig();
  const { generateContent: aiGenerateContent, generateContentStream: aiGenerateContentStream, canGenerate } = useAI();

  const selectedBook = useMemo(() => books.find(b => b.id === selectedBookId), [books, selectedBookId]);
  const selectedChapter = useMemo(() => selectedBook?.chapters.find(c => c.id === selectedChapterId), [selectedBook, selectedChapterId]);

  const manuscript = useMemo(() => {
    if (selectedChapter) return selectedChapter.content;
    return pastedText;
  }, [selectedChapter, pastedText]);

  const handleBookSelect = (bookId: string) => {
    setSelectedBookId(bookId);
    setSelectedChapterId(null);
    setReviewResult(null);
  };
  
  const handleChapterSelect = (chapterId: string) => {
    setSelectedChapterId(chapterId);
     setReviewResult(null);
  }

  const handlePastedTextChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const text = e.target.value;
    if (text.length <= MAX_CHAR_LIMIT) {
      setPastedText(text);
      setReviewResult(null);
    }
  };
  
  const handleReview = async () => {
    if (!manuscript.trim()) {
      toast({
        title: '稿件不能为空',
        description: '请输入或选择需要审阅的内容。',
        variant: 'destructive',
      });
      return;
    }

    if (!canGenerate) {
      toast({
        title: '请先配置AI提供商',
        description: '请点击右上角AI设置按钮配置您的AI提供商',
        variant: 'destructive',
      });
      return;
    }
    
    setIsLoading(true);
    setReviewResult(null);
    setLiveOutput('');
    setLiveDecision('');

    try {
      const systemInstruction = `你需要扮演一位有签约决策权的资深编辑，基于签约手册审阅来稿并给出清晰结论。

——签约手册:
"雷"点一：开篇拖沓、平淡或信息轰炸
（一）常见错误
1、拖沓冗长：开篇大量堆砌无关信息，如背景介绍、人物琐事等，导致节奏缓慢，核心冲突与亮点迟迟不出现，使读者在开篇丧失兴趣。

例如：作者开篇用了上千字描述朝代背景、家族关系等，直至第三段才引出主角，且未提及主角面临的关键矛盾，读者在大量信息中难以找到兴趣点。

2、平淡无奇：切入点缺乏吸引力，采用过于常规、老套的方式展开故事，难以勾起读者的好奇心与探索欲。

例如：一部都市小说，开篇描述主角日常上班、挤公交，这种常见场景缺乏新意，与众多同类小说开篇相似，难以吸引读者。

3、信息轰炸：开篇塞入大量世界观设定、人物背景等信息，让读者眼花缭乱。

例如：作者开篇直接抛出大段世界观设定、人物背景信息等，读者一时间无法消化吸收如此丰富的信息，看得一头雾水。

"雷"点二：世界观设定模糊或强行灌输
（一）常见错误
1、设定模糊：

例如：科幻文里的星际社会，没交代清楚各星球的势力划分和科技水平。

2、强行灌输：用大段文字解释世界观。

例如：奇幻文开篇用"世界起源于一块神石"的冗长说明，不但没有让作者理解世界观，还因为冗长的解释劝退读者。

"雷"点三：人设矛盾、节奏混乱、配角工具人
（一）常见错误
1、人设与情节矛盾：人物行为不符合既定人设。

2、情节逻辑混乱：部分稿件存在情节前后矛盾、缺乏合理性的问题。

3、配角工具人化：配角仅为推动剧情存在，如反派身边的小弟只会喊"大哥英明"，没有独立性格，通篇都是这种工具人，读者没有记忆点。
正确的写法是写出合理的行动动机比如：
  ①反派：如抢夺宝物是为了救治病危的亲人，并非单纯的与主角作对。
  ②盟友：如帮助主角是因为主角曾救过他的命，或两人有共同的敌人。

"雷"点四：视角杂乱或叙事方式不当
（一）常见错误
1、视角杂乱：在同一章节或场景中频繁切换视角，导致主次不分，读者难以理清故事脉络。

例如：在古代战争小说中，同一章节内，一会儿写将军在营帐中的谋划，一会儿写士兵在战场上的感受，一会儿又切换到敌方将领的想法，视角频繁转换，让读者难以理清故事的发展脉络。

2、叙事方式不当：部分稿件采用插叙、倒叙等叙事方式时处理不当。

"雷"点五：剧情主线不明确、过于平淡或剧情混乱
（一）常见错误
1、剧情主线不明确：故事没有清晰的主线脉络，或主线被大量支线、琐碎情节掩盖，读者难以把握故事核心走向。

例如：仙侠小说中，作者原本设定的主线是主角寻找失落的神器，提升实力拯救苍生。但在故事发展过程中，却花了大量篇幅描写主角在门派中的日常琐事，如与同门师兄弟的小摩擦、帮助长辈处理杂务等，而关于寻找神器的主线内容却寥寥无几，导致读者很难把握故事的核心走向。

2、剧情平淡无冲突：主线剧情缺乏冲突与挑战，主角的行动没有阻碍，故事发展过于顺利，缺乏吸引力。

例如：冒险小说中，故事设定了主角要穿越神秘丛林经历重重磨难，最终寻到宝藏。但在实际剧情中，主角一路上几乎没有遇到任何危险和困难，轻松地找到了宝藏。

3、剧情混乱：故事情节发展毫无逻辑，场景、情节转换突兀。

例如：在都市类作品里，主角前一刻还在神秘森林中与怪物战斗，下一刻却毫无过渡地出现在繁华都市街头，让读者难以跟上故事节奏，阅读体验大打折扣。

4、爽点突兀：矛盾冲突多基于模板化的情节堆砌，缺乏合理的逻辑支撑与情感积累，爽点的爆发显得突兀。

例如：在复仇类作品里，主角复仇过程过于轻松，没有充分展现出复仇成功后的畅快淋漓；或者在打脸情节中，对反派的反应描写不足，莫名其妙的就开始打脸复仇。

"雷"点六：描写无效、排版不规范、文笔华丽或文笔欠佳
（一）常见错误
1、描写无效：如过多无关对话、冗长的环境描写等，对推动剧情和塑造人物毫无作用。

2、排版不规范：段落过长、格式混乱，在电子阅读环境下，给读者造成视觉疲劳，影响阅读体验。

3、文笔太过华丽：过度的华丽描写反而造成信息冗余，导致故事的叙事节奏被削弱，让人阅读困难。

4、文笔欠佳：语言平淡、直白、啰嗦，描写缺乏感染力，无法生动展现故事场景与人物形象。

——

输出要求：
1) 仅输出自然语言评审意见，不要输出代码块/JSON/Markdown围栏。
2) 文末或正文中务必明确包含以下关键词之一以表示最终结论："过稿"、"拒稿"、或"修订"（含“修改后再投”等同义表达）。
3) 给出简洁且可执行的修改建议（如有）。`;
      // 流式输出 + 关键词实时判定（不过度约束模型格式）
      const stream = aiGenerateContentStream(`【稿件】\n${manuscript}`, {
        systemInstruction,
        maxOutputTokens: 1024,
        temperature: 0.2,
      });

      let output = '';
      let detected: '' | '过稿' | '拒稿' | '修订' = '';
      const PASS_REGEX = /(过稿|通过|过审|可签|建议签约|推荐签约)/i;
      const REJECT_REGEX = /(拒稿|拒绝|不通过|退稿|不采纳|不予采用|不予签约)/i;
      const REVISE_REGEX = /(修订|修改后再投|建议修改|需修改|调整后再投|完善后再投)/i;
      const detectDecisionByKeywords = (text: string): '' | '过稿' | '拒稿' | '修订' => {
        if (PASS_REGEX.test(text)) return '过稿';
        if (REJECT_REGEX.test(text)) return '拒稿';
        if (REVISE_REGEX.test(text)) return '修订';
        return '';
      };

      for await (const chunk of stream) {
        output += chunk;
        // 实时显示
        setLiveOutput(output);
        // 实时结论判定（只设置一次明确结论）
        if (!detected) {
          detected = detectDecisionByKeywords(output);
          if (detected) setLiveDecision(detected);
        }
      }

      const decision = detected as any;
      const reason = output.trim();
      setReviewResult({ decision, reason });
    } catch (error: any) {
      console.error("Review failed:", error);
      toast({
        title: '审稿失败',
        description: error.message || 'AI 在审稿时遇到问题，请稍后再试。',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleCopyReason = () => {
    if (reviewResult?.reason) {
      copy(reviewResult.reason);
      toast({
        title: '复制成功',
        description: '审稿理由已复制到剪贴板。',
      });
    }
  };

  return (
    <div className="flex flex-col min-h-screen bg-background/80">
      <Header />
      <main className="flex-grow container mx-auto p-4 md:p-6 lg:p-8">
        <div className="max-w-2xl mx-auto">
          <Card className="shadow-lg">
            <CardHeader className="text-center">
              <FileScan className="mx-auto h-12 w-12 text-primary" />
              <CardTitle className="text-2xl font-headline mt-2">网文审稿</CardTitle>
              <CardDescription>模拟专业编辑，为你的作品开头提供签约级水准的专业反馈。</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <Tabs defaultValue="paste" className="w-full">
                <TabsList className="grid w-full grid-cols-2">
                  <TabsTrigger value="paste">粘贴文本</TabsTrigger>
                  <TabsTrigger value="select">选择书籍</TabsTrigger>
                </TabsList>
                <TabsContent value="paste" className="mt-4">
                  <div className="space-y-2">
                    <Label htmlFor="paste-area">在此处粘贴您的稿件（开头1-3章为宜）</Label>
                    <Textarea
                      id="paste-area"
                      placeholder="请输入..."
                      value={pastedText}
                      onChange={handlePastedTextChange}
                      className="min-h-[200px] resize-y"
                    />
                    <div className='flex justify-between items-center'>
                      <div className="flex flex-wrap gap-2 items-center text-xs text-muted-foreground py-2">
                          <Badge variant="outline">起点主编:星河</Badge>
                          <Badge variant="outline">起点编辑:无书</Badge>
                          <Badge variant="outline">专业审稿模型</Badge>
                          <Badge variant="outline">符合商业化审美</Badge>
                          <Badge variant="outline">审稿准确率高达80%</Badge>
                      </div>
                      <p className="text-xs text-muted-foreground text-right shrink-0">
                        {pastedText.length} / {MAX_CHAR_LIMIT}
                      </p>
                    </div>
                  </div>
                </TabsContent>
                <TabsContent value="select" className="mt-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="book-select">选择书籍</Label>
                      <Select onValueChange={handleBookSelect} value={selectedBookId || ''}>
                        <SelectTrigger id="book-select">
                          <SelectValue placeholder="选择一本你的著作" />
                        </SelectTrigger>
                        <SelectContent>
                          {books.map(book => (
                            <SelectItem key={book.id} value={book.id}>{book.title}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="chapter-select">选择章节</Label>
                      <Select onValueChange={handleChapterSelect} value={selectedChapterId || ''} disabled={!selectedBook}>
                        <SelectTrigger id="chapter-select">
                          <SelectValue placeholder="选择一个章节" />
                        </SelectTrigger>
                        <SelectContent>
                          {selectedBook?.chapters.map(chapter => (
                            <SelectItem key={chapter.id} value={chapter.id}>{chapter.title}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </TabsContent>
              </Tabs>
              {/* AI模型选择 */}
              <div className="space-y-4">
                <div className="flex justify-between items-center">
                  <Label>AI模型选择</Label>
                  <AIProviderSettings variant="ghost" showStatus={true} />
                </div>
                <ModelSelector
                  selectedProviderId={selectedProviderId}
                  selectedModelId={selectedModelId}
                  onProviderChange={setSelectedProvider}
                  onModelChange={setSelectedModel}
                  showLabels={false}
                  showModelInfo={false}
                />
                <p className="text-xs text-muted-foreground">
                  {canGenerate ? (
                    <span className="text-green-600 dark:text-green-400">✓ AI配置已就绪</span>
                  ) : (
                    <span className="text-amber-600 dark:text-amber-400">⚠ 请先配置AI提供商</span>
                  )}
                </p>
              </div>
              
              <Button onClick={handleReview} disabled={isLoading || !manuscript.trim()} className="w-full text-lg py-6 font-headline">
                {isLoading ? (
                  <>
                    <Loader2 className="mr-2 h-5 w-5 animate-spin" /> 正在审稿中...
                  </>
                ) : (
                  <>
                  <WandSparkles className="mr-2 h-5 w-5"/>
                  开始审稿
                  </>
                )}
              </Button>

              {(isLoading || liveOutput) && !reviewResult && (
                <Card className={`transition-all duration-500 ${liveDecision === '过稿' ? 'bg-green-100/80 dark:bg-green-900/30 border-green-500/50' : liveDecision === '拒稿' ? 'bg-red-100/80 dark:bg-red-900/30 border-red-500/50' : 'bg-muted/40'}`}>
                  <CardHeader>
                    <div className="flex items-center gap-4">
                      {liveDecision === '过稿' ? (
                        <CheckCircle className="h-10 w-10 text-green-500 flex-shrink-0" />
                      ) : liveDecision === '拒稿' ? (
                        <XCircle className="h-10 w-10 text-red-500 flex-shrink-0" />
                      ) : (
                        <Loader2 className="h-10 w-10 animate-spin text-primary flex-shrink-0" />
                      )}
                      <div>
                        <CardTitle className="font-headline text-2xl">
                          {liveDecision ? `审稿结论：${liveDecision}` : '正在审稿...'}
                        </CardTitle>
                        <CardDescription>实时生成中，完成后将给出最终结论</CardDescription>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="flex justify-between items-center">
                      <Label className='font-headline'>审稿理由（生成中）</Label>
                    </div>
                    <div className="p-4 bg-background/50 rounded-md border text-sm text-foreground/80 whitespace-pre-wrap min-h-[120px]">
                      {liveOutput || '连接中...'}
                    </div>
                  </CardContent>
                </Card>
              )}

              {reviewResult && (
                <Card className={`transition-all duration-500 ${reviewResult.decision === '过稿' ? 'bg-green-100/80 dark:bg-green-900/30 border-green-500/50' : 'bg-red-100/80 dark:bg-red-900/30 border-red-500/50'}`}>
                  <CardHeader>
                    <div className="flex items-center gap-4">
                      {reviewResult.decision === '过稿' ? (
                         <CheckCircle className="h-10 w-10 text-green-500 flex-shrink-0" />
                      ) : (
                         <XCircle className="h-10 w-10 text-red-500 flex-shrink-0" />
                      )}
                      <div>
                        <CardTitle className={`font-headline text-2xl ${reviewResult.decision === '过稿' ? 'text-green-700 dark:text-green-300' : 'text-red-700 dark:text-red-300'}`}>
                          审稿结论：{reviewResult.decision}
                        </CardTitle>
                         <CardDescription className={`${reviewResult.decision === '过稿' ? 'text-green-600 dark:text-green-400/80' : 'text-red-600 dark:text-red-400/80'}`}>
                           基于海量过稿数据和编辑经验的综合判断
                        </CardDescription>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="flex justify-between items-center">
                       <Label className='font-headline'>审稿理由</Label>
                       <Button variant="ghost" size="sm" onClick={handleCopyReason}>
                         <Copy className="mr-2 h-4 w-4"/>
                         复制
                       </Button>
                    </div>
                    <div className="p-4 bg-background/50 rounded-md border text-sm text-foreground/80 whitespace-pre-wrap">
                      {reviewResult.reason}
                    </div>
                  </CardContent>
                </Card>
              )}
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
}
