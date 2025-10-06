'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { ArrowLeft } from 'lucide-react';
import Link from 'next/link';

interface Question {
  id: number;
  title?: string; // 可选的大标题
  question: string;
  isMultipleChoice?: boolean; // 是否为多选题
  options: {
    text: string;
    score: number;
    explanation?: string; // 选项的解释说明
  }[];
}

type AnswerState = 'idle' | 'answered';

const questions: Question[] = [
  {
    id: 1,
    title: '你平时喜欢看的小说书名长度',
    question: '',
    options: [
      { text: '2-6字', score: -5 },
      { text: '7-15字', score: 0 },
      { text: '都喜欢看', score: 0 },
    ],
  },
  {
    id: 2,
    title: '你认为什么才是好的文笔？',
    question: '',
    options: [
      { text: '大量陈述词排比句', score: -10 },
      { text: '高级文言文', score: -10 },
      { text: '有前因后果的句式', score: 0 },
    ],
  },
  {
    id: 3,
    question: '你平时看的小说都是什么等级的作者？',
    options: [
      { text: '大神白金', score: -10 },
      { text: '4-5级', score: 0 },
      { text: '1-3级', score: 0 },
    ],
  },
  {
    id: 4,
    title: '下列关于"感情虚浮"错误的描述是:',
    question: '',
    options: [
      { text: '没有前因后果，为了冲突而冲突', score: 0 },
      { text: '人设僵硬，为了帮助主角而帮助主角', score: 0 },
      { text: '情绪上下行没拉好。', score: -5 },
    ],
  },
  {
    id: 5,
    title: '小说开头第一段最好先写什么才能更吸量？',
    question: '',
    options: [
      { text: '设定世界观', score: -10 },
      { text: '写出冲突', score: -1 },
      { text: '吸引读者注意力', score: 0 },
    ],
  },
  {
    id: 6,
    title: '你是否认同以下观点？',
    question: `假如"网文就是爽文"这个观点是对的，那么古今中外无论是哪个作品都可以称之为"爽文"，只不过他们的"爽点"不一样。

就拿我们的四大名著来举例子。

《三国演义》中，刘备从卖草鞋到争霸天下的故事情节，放在网文里就是"屌丝逆袭"。诸葛亮空城计戏耍司马懿，放在网文里就是"迪化"。

《西游记》中，孙悟空三打白骨精，唐僧赶走孙悟空，后来又想办法把大师兄请回来的情节，放在网文里叫做"打脸"。

《水浒传》中，武松杀死潘金莲和西门庆为自己的大哥报仇，放在网文里面叫做"复仇爽文"。

《红楼梦》中，讲述了贾府的兴衰荣辱，放在网文里面，这叫做"宫斗宅斗"，贾宝玉和各个妹妹的互动，这在网文里叫做"嗑CP"。`,
    options: [
      { text: '认同', score: 0 },
      { text: '不认同', score: -10 },
      { text: '部分认同', score: -5 },
    ],
  },
  {
    id: 7,
    title: '这是一个知名小说的简介，这个简介最吸量段落在哪？',
    question: '',
    options: [
      { text: '第一段', score: -5 },
      { text: '第二段', score: -5 },
      { text: '第三段', score: -5 },
      { text: '第四段', score: 0 },
    ],
  },
  {
    id: 8,
    title: '这是一个小说的简介，你认为这个简介取什么书名才更吸量？',
    question: '',
    options: [
      { text: '《版本秩序》', score: -10 },
      { text: '《幕后:版本更新，我能窃取版本权限》', score: 0 },
      { text: '《你们换版本，我叠Buff》', score: -5 },
      { text: '《我在末日版本炼仙道》', score: 0 },
    ],
  },
  {
    id: 9,
    title: '多选题:为什么伤痛文学比少年热血更加让人刻骨铭心？',
    question: '下面正确的描述是:',
    isMultipleChoice: true,
    options: [
      { text: '伤痛文学是传统文学，少年热血是网络爽文上不了台面', score: -20 },
      { text: '伤痛文学会让读者不断反思，假如不这么做，是不是就可以...成功？因此带动传播二创', score: 0 },
      { text: '因为丢失100块钱永远比你捡到100块钱更加让人记忆深刻。', score: 0 },
      { text: '少年热血的圆满结局，读者会得到满足，快乐，没有遗憾了就不会引发对结局的后续思考，因此在传播度上不如伤痛文学。', score: 0 },
    ],
  },
  {
    id: 10,
    title: '网文写作天赋考核题：语感与故事构造',
    question: '',
    isMultipleChoice: true,
    options: [
      { 
        text: 'A. 画面感模糊，缺乏具象的场景描绘，难以让读者代入。', 
        score: 0,
        explanation: '开头过多依赖形容词和抽象概念（典型的陈述词泛滥，自以为的高级，实际上难以理解，阻碍信息传播）'
      },
      { 
        text: 'B. 隐喻使用过于频繁和刻意，降低了其艺术性和神秘感。', 
        score: 0,
        explanation: '典型的用词汇疯狂修缮一个没有前因后果的句式'
      },
      { 
        text: 'C. 节奏缓慢，情节推进不足，难以在开篇抓住读者注意力。', 
        score: 0,
        explanation: '整个开头更像是一段散文式的描写，主要用于烘托氛围和展现人物状态，但缺乏能够激发读者好奇心和阅读欲望的事件或冲突。'
      },
      { 
        text: 'D. 人物关系和动机交代不清，使得读者的情感投入不足。', 
        score: 0,
        explanation: '林锦深"带你走"的意图在没有足够铺垫的情况下提出，让读者不明白他们之间是何种关系，为何有此举动，削弱了故事的逻辑性和吸引力。'
      },
    ],
  },
];

const getTalentLevel = (score: number) => {
  if (score >= 95) return { level: '天赋异禀', desc: '你拥有成为顶尖网文作家的潜质！', color: 'text-yellow-500' };
  if (score >= 85) return { level: '天赋优秀', desc: '你对网文有很好的理解，继续努力！', color: 'text-green-500' };
  if (score >= 75) return { level: '天赋良好', desc: '你的网文基础不错，还有提升空间。', color: 'text-blue-500' };
  if (score >= 60) return { level: '天赋一般', desc: '建议多读多写，提升对网文的理解。', color: 'text-gray-500' };
  return { level: '需要加油', desc: '多阅读优质网文，学习写作技巧吧！', color: 'text-red-500' };
};

export default function TalentTestPage() {
  const [currentScore, setCurrentScore] = useState(100);
  const [currentQuestion, setCurrentQuestion] = useState(0);
  const [answers, setAnswers] = useState<number[]>([]);
  const [isComplete, setIsComplete] = useState(false);
  const [scoreChange, setScoreChange] = useState<number | null>(null);
  const [answerState, setAnswerState] = useState<AnswerState>('idle');
  const [selectedOption, setSelectedOption] = useState<number | null>(null);
  const [multipleChoiceSelections, setMultipleChoiceSelections] = useState<number[]>([]);
  const [countdown, setCountdown] = useState<number>(0);

  const handleAnswer = (optionIndex: number) => {
    if (answerState === 'answered') return; // 防止重复点击
    
    const question = questions[currentQuestion];
    const selected = question.options[optionIndex];

    // 设置选中状态
    setSelectedOption(optionIndex);
    setAnswerState('answered');

    // 显示分数变化
    if (selected.score !== 0) {
      setScoreChange(selected.score);
      setTimeout(() => setScoreChange(null), 1500);
    }

    // 使用函数式更新，避免闭包中拿到旧值
    setCurrentScore((prev) => prev + selected.score);
    setAnswers([...answers, optionIndex]);

    // 延迟2秒后进入下一题，让用户看到正确答案
    setTimeout(() => {
      setAnswerState('idle');
      setSelectedOption(null);
      if (currentQuestion < questions.length - 1) {
        setCurrentQuestion(currentQuestion + 1);
      } else {
        setIsComplete(true);
      }
    }, 2000);
  };

  // 多选题：切换选项
  const handleMultipleChoiceToggle = (optionIndex: number) => {
    if (answerState === 'answered') return;
    
    setMultipleChoiceSelections(prev => {
      if (prev.includes(optionIndex)) {
        return prev.filter(i => i !== optionIndex);
      } else {
        return [...prev, optionIndex];
      }
    });
  };

  // 多选题：提交答案
  const handleMultipleChoiceSubmit = () => {
    if (multipleChoiceSelections.length === 0 || answerState === 'answered') return;
    
    const question = questions[currentQuestion];
    
    // 找出所有正确答案的索引（score === 0）
    const correctAnswerIndices = question.options
      .map((opt, index) => (opt.score === 0 ? index : -1))
      .filter(index => index !== -1);
    
    // 检查是否完全正确：选中所有正确答案，且没有选错误答案
    const hasAllCorrectAnswers = correctAnswerIndices.every(index => 
      multipleChoiceSelections.includes(index)
    );
    const hasNoWrongAnswers = multipleChoiceSelections.every(index => 
      question.options[index].score === 0
    );
    const isFullyCorrect = hasAllCorrectAnswers && hasNoWrongAnswers;
    
    // 如果不完全正确（选错或漏选），扣20分
    const totalScore = isFullyCorrect ? 0 : -20;

    setAnswerState('answered');

    // 显示分数变化
    if (totalScore !== 0) {
      setScoreChange(totalScore);
      setTimeout(() => setScoreChange(null), 1500);
    }

    // 使用函数式更新分数，避免不同浏览器的状态竞态
    setCurrentScore((prev) => prev + totalScore);
    setAnswers([...answers, ...multipleChoiceSelections]);

    // 最后一题延迟30秒，其他题延迟2秒
    const delayTime = question.id === 10 ? 30000 : 2000;
    
    // 如果是最后一题，启动倒计时
    if (question.id === 10) {
      setCountdown(30);
      const countdownInterval = setInterval(() => {
        setCountdown((prev) => {
          if (prev <= 1) {
            clearInterval(countdownInterval);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }
    
    setTimeout(() => {
      setAnswerState('idle');
      setMultipleChoiceSelections([]);
      setCountdown(0);
      if (currentQuestion < questions.length - 1) {
        setCurrentQuestion(currentQuestion + 1);
      } else {
        setIsComplete(true);
      }
    }, delayTime);
  };

  const resetTest = () => {
    setCurrentScore(100);
    setCurrentQuestion(0);
    setAnswers([]);
    setIsComplete(false);
    setScoreChange(null);
    setAnswerState('idle');
    setSelectedOption(null);
    setMultipleChoiceSelections([]);
    setCountdown(0);
  };

  if (isComplete) {
    const talent = getTalentLevel(currentScore);
    return (
      <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-purple-50 to-pink-50 py-8 px-4">
        <div className="max-w-2xl mx-auto">
          <Link href="/" className="inline-flex items-center text-gray-600 hover:text-gray-900 mb-6 transition-colors">
            <ArrowLeft className="w-4 h-4 mr-2" />
            返回主页
          </Link>

          <Card className="shadow-2xl border-2 border-purple-200 bg-white">
            <CardHeader className="text-center pb-2 pt-8">
              <CardTitle className="text-2xl sm:text-3xl md:text-4xl mb-3 font-bold bg-gradient-to-r from-purple-600 to-pink-600 bg-clip-text text-transparent break-words">
                🎉 测试完成！
              </CardTitle>
              <CardDescription className="text-base text-gray-600">你的网文天赋评定结果</CardDescription>
            </CardHeader>
            <CardContent className="text-center space-y-8 pt-6 pb-8">
              <div className="relative">
                <div className="inline-block bg-gradient-to-br from-purple-100 to-pink-100 rounded-3xl px-6 sm:px-10 md:px-16 py-6 sm:py-8 shadow-lg">
                  <div className="text-5xl sm:text-7xl md:text-9xl font-bold bg-gradient-to-r from-purple-600 via-pink-600 to-blue-600 bg-clip-text text-transparent">
                    {currentScore}
                  </div>
                  <div className="text-gray-600 text-lg sm:text-xl font-medium mt-2">最终分数</div>
                </div>
              </div>

              <div className="space-y-3 bg-gradient-to-r from-purple-50 to-pink-50 rounded-2xl p-6">
                <div className={`text-4xl font-bold ${talent.color}`}>
                  {talent.level}
                </div>
                <p className="text-gray-700 text-lg leading-relaxed">{talent.desc}</p>
              </div>

              <div className="pt-4 space-y-3">
                <Button onClick={resetTest} size="lg" className="w-full text-lg py-6 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700">
                  🔄 重新测试
                </Button>
                <Link href="/" className="block">
                  <Button variant="outline" size="lg" className="w-full text-lg py-6 border-2 border-purple-300 hover:bg-purple-50">
                    返回主页
                  </Button>
                </Link>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  const question = questions[currentQuestion];
  const progress = ((currentQuestion) / questions.length) * 100;

  // 获取选项按钮的样式（单选题）
  const getOptionButtonClass = (index: number, score: number) => {
    if (answerState === 'idle') {
      return 'w-full justify-start text-left h-auto py-4 px-6 text-base font-medium border-2 hover:bg-purple-50 hover:border-purple-400 hover:shadow-md transition-all duration-200';
    }
    
    // 已回答状态：高亮正确答案和错误答案
    if (score === 0) {
      // 正确答案（不扣分）- 绿色高亮
      return 'w-full justify-start text-left h-auto py-4 px-6 text-base font-medium border-2 bg-green-50 border-green-400 text-green-900';
    } else if (index === selectedOption) {
      // 选中的错误答案 - 红色高亮
      return 'w-full justify-start text-left h-auto py-4 px-6 text-base font-medium border-2 bg-red-50 border-red-400 text-red-900';
    } else {
      // 其他错误答案 - 灰色
      return 'w-full justify-start text-left h-auto py-4 px-6 text-base font-medium border-2 bg-gray-50 border-gray-300 text-gray-500';
    }
  };

  // 获取选项按钮的样式（多选题）
  const getMultipleChoiceButtonClass = (index: number, score: number) => {
    const isSelected = multipleChoiceSelections.includes(index);
    
    if (answerState === 'idle') {
      // 未提交状态
      if (isSelected) {
        return 'w-full justify-start text-left h-auto py-4 px-6 text-base font-medium border-2 bg-purple-100 border-purple-500 shadow-md transition-all duration-200';
      }
      return 'w-full justify-start text-left h-auto py-4 px-6 text-base font-medium border-2 hover:bg-purple-50 hover:border-purple-400 hover:shadow-md transition-all duration-200';
    }
    
    // 已回答状态：高亮正确答案和错误答案
    if (score === 0) {
      // 正确答案 - 绿色高亮
      return 'w-full justify-start text-left h-auto py-4 px-6 text-base font-medium border-2 bg-green-50 border-green-400 text-green-900';
    } else if (isSelected) {
      // 选中的错误答案 - 红色高亮
      return 'w-full justify-start text-left h-auto py-4 px-6 text-base font-medium border-2 bg-red-50 border-red-400 text-red-900';
    } else {
      // 未选中的错误答案 - 灰色
      return 'w-full justify-start text-left h-auto py-4 px-6 text-base font-medium border-2 bg-gray-50 border-gray-300 text-gray-500';
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-purple-50 to-pink-50 py-8 px-4">
      <div className="max-w-3xl mx-auto">
        <Link href="/" className="inline-flex items-center text-gray-600 hover:text-gray-900 mb-6 transition-colors">
          <ArrowLeft className="w-4 h-4 mr-2" />
          返回主页
        </Link>

        {/* 分数显示 */}
        <div className="mb-8 text-center relative">
          <div className="inline-block relative bg-white rounded-2xl shadow-lg px-6 sm:px-10 md:px-12 py-4 sm:py-6 border-2 border-purple-200">
            <div className="text-4xl sm:text-6xl md:text-7xl font-bold bg-gradient-to-r from-purple-600 via-pink-600 to-blue-600 bg-clip-text text-transparent">
              {currentScore}
            </div>
            <div className="text-gray-600 text-sm sm:text-base font-medium mt-2">当前分数</div>

            {/* 分数变化提示 */}
            {scoreChange !== null && scoreChange !== 0 && (
              <div
                className={`absolute -top-4 -right-4 text-4xl font-bold animate-bounce ${
                  scoreChange > 0 ? 'text-green-500' : 'text-red-500'
                }`}
              >
                {scoreChange > 0 ? '+' : ''}{scoreChange}
              </div>
            )}
          </div>
        </div>

        {/* 进度条 */}
        <div className="mb-8 bg-white rounded-xl shadow-md p-4 border border-gray-200">
          <div className="flex justify-between text-sm text-gray-600 mb-3 font-medium">
            <span>第 {currentQuestion + 1} 题</span>
            <span>共 {questions.length} 题</span>
          </div>
          <div className="w-full h-3 bg-gray-100 rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-purple-500 via-pink-500 to-blue-500 rounded-full"
              style={{ width: `${progress}%`, transition: 'width 400ms ease' }}
            />
          </div>
        </div>

        {/* 题目卡片 */}
        <Card className="shadow-2xl border-2 border-purple-200 bg-gradient-to-br from-yellow-50 to-amber-50">
          <CardHeader className="pb-4">
            {question.title && (
              <CardTitle className="text-xl sm:text-2xl md:text-3xl mb-4 text-center font-bold text-gray-800 break-words">
                {question.title}
              </CardTitle>
            )}
            {question.question && (
              <CardDescription className="text-sm sm:text-base md:text-lg text-gray-700 whitespace-pre-line leading-relaxed break-words hyphens-auto">
                {question.question}
              </CardDescription>
            )}
            {/* 第7题的简介内容 */}
            {question.id === 7 && (
              <div className="mt-6 bg-white rounded-lg p-4 sm:p-6 shadow-md border border-gray-200 space-y-4 text-left">
                <p className="text-sm sm:text-base leading-relaxed text-gray-800 break-words">
                  <span className="text-red-600 font-semibold">第一段：</span>
                  选择大于努力！武师们为陆地宝树打的头破血流，深水神草却无人问津。
                </p>
                <p className="text-sm sm:text-base leading-relaxed text-gray-800 break-words">
                  <span className="text-red-600 font-semibold">第二段：</span>
                  穿越成渔民的梁渠获得水泽之鼎，炼化【水猴子】天赋，统御水兽，一路收割，踏上巅峰！
                </p>
                <p className="text-sm sm:text-base leading-relaxed text-gray-800 break-words">
                  <span className="text-red-600 font-semibold">第三段：</span>
                  【水猴子】→【泽狨】→【水王猿】→【淮涡水君】！从此万里泽涛由我做主！
                </p>
                <p className="text-sm sm:text-base leading-relaxed text-gray-800 break-words">
                  <span className="text-red-600 font-semibold">第四段：</span>
                  人们跪拜祈福，献上祭品。"求水神大人保佑......"靠，能不能别向我祭祀少女了，我真不是水神啊！
                </p>
              </div>
            )}
            {/* 第8题的简介内容 */}
            {question.id === 8 && (
              <div className="mt-6 bg-white rounded-lg p-4 sm:p-6 shadow-md border border-gray-200 text-left">
                <p className="text-sm sm:text-base leading-relaxed text-gray-800 break-words hyphens-auto">
                  陆阎穿越到了一个奇特的世界，每隔一段时间整个世界都会迎来一次版本更新。昨日还是问道长生的仙侠版本，今天便会化作遍地丧尸的废土末日。上一秒真神降世俯瞰诡秘世界，下一刻人类联邦探索群星遨游星海。在变化万千的世界之中，众生随波逐流，唯有陆阎独立于诸多版本之外。在仙侠版本谋求功法，在末日版本祭炼万魂，于都市版本开启灵气复苏搅动大势，从诡秘世界传播仙道途径攫取神位。当陆阎之名传遍诸多版本之时，他早已凌驾于群仙众神之上。
                </p>
              </div>
            )}
            {/* 第10题的特殊内容 */}
            {question.id === 10 && (
              <div className="mt-6 space-y-6">
                {/* 恭喜提示 */}
                <div className="bg-gradient-to-r from-yellow-100 to-orange-100 rounded-xl p-4 sm:p-6 border-2 border-yellow-300 shadow-lg">
                  <p className="text-lg sm:text-xl font-bold text-center text-orange-800">
                    🎊 恭喜你，来到最后一道题，你还剩 <span className="text-2xl sm:text-3xl text-red-600">{currentScore}</span> 分……
                  </p>
                </div>

                {/* 引言 */}
                <div className="bg-blue-50 rounded-lg p-4 sm:p-6 border border-blue-200">
                  <h3 className="font-bold text-base sm:text-lg text-blue-900 mb-3">📖 引言：</h3>
                  <p className="text-sm sm:text-base leading-relaxed text-gray-800 break-words hyphens-auto">
                    许多同学认为网络小说创作简单，因为学校已教授写作。然而，学校的文学教育侧重"价值观"与"词汇量"，并未涉及专业的写作语感和故事构造。本题旨在检验你对故事构造和语感的理解。
                  </p>
                </div>

                {/* 小说片段 */}
                <div className="bg-white rounded-lg p-4 sm:p-6 shadow-md border-2 border-gray-300">
                  <h3 className="font-bold text-base sm:text-lg text-gray-900 mb-4">📝 请仔细阅读以下网文新人创作的开头片段：</h3>
                  <div className="space-y-3 text-sm sm:text-base leading-relaxed text-gray-800 bg-gray-50 p-4 sm:p-5 rounded-lg border border-gray-200 break-words hyphens-auto">
                    <p>那是林锦深第一次见到奕予程。</p>
                    <p>一朵盛放的玫瑰被囚禁在精致而透明到极致的真空玻璃瓶内。</p>
                    <p>玫瑰的边缘已经变得暗红，茎叶的刺显得愈发扎眼。</p>
                    <p>可是却像被世界遗忘一般，静静的，被置在那荒无人烟的玫瑰园的阴影里。</p>
                    <p>奕予程屈膝坐在玫瑰旁，留下孤寂却依旧挺拔的背影。</p>
                    <p>林锦深站在栅栏外看着他。风从深林处席卷而来，带着密林独有的潮湿的泥土以及腐烂枯叶的气息。那是与玫瑰园截然不停的味道不精致，也不刻意，但却称得上是凌洌到粗粝。</p>
                    <p>奕予程突然回头，视线透过玫瑰花丛和破旧的栅栏门，与林锦深相遇。</p>
                    <p>那双眸子里是近乎透明的灰,好像世界的万物都无法让它沾染上一抹亮色。林锦深想:这不是一双活人该有的眼睛一它太静了，静得像滩死水，像标本，像玻璃瓶内被永恒定格的玫瑰。在视线交汇的刹那间，那潭死水蓦地泛起金属灰的冷光。一阵长久的沉默过后，奕予程开口: "你来了。"他的声音很轻，很干涩。</p>
                    <p>那个精致完美的玻璃瓶倏然出现裂纹,发出"咔"的一声脆响，但顷刻间就被呼啸的风声吞没。</p>
                    <p>林锦深看着它。</p>
                    <p>暗红色，是血。</p>
                    <p>那朵被囚禁的玫瑰在风触碰到的那一刻变作齑粉，风中裹挟着破旧栅栏门的铁锈味。</p>
                    <p>"嗯，"他握紧在栅栏门上凸起的铁刺，"我来带你走。"</p>
                    <p>风更加猛烈了，深林的树影摇晃着看不清踪迹。玫瑰园的栅栏门缓缓地合上了,但甜腻的芬芳依旧在空气中森然蔓延……</p>
                  </div>
                </div>

                {/* 问题提示 */}
                <div className="bg-red-50 rounded-lg p-4 sm:p-5 border-2 border-red-300">
                  <p className="font-bold text-base sm:text-lg text-red-800 text-center">
                    ⚠️ 以下哪些是这段开头存在的问题？（多选题）
                  </p>
                </div>
              </div>
            )}
          </CardHeader>
          <CardContent className="space-y-4 pt-2">
            {question.isMultipleChoice ? (
              // 多选题渲染
              <>
                <div className="text-xs sm:text-sm text-purple-700 font-medium mb-2 bg-purple-50 p-3 rounded-lg border border-purple-200">
                  💡 提示：这是多选题，必须全选对才不扣分，选错或漏选都扣20分
                </div>
                {question.options.map((option, index) => (
                  <div key={index} className="space-y-2">
                    <Button
                      variant="outline"
                      className={getMultipleChoiceButtonClass(index, option.score) + ' whitespace-normal break-words hyphens-auto py-3 sm:py-4'}
                      onClick={() => handleMultipleChoiceToggle(index)}
                      disabled={answerState === 'answered'}
                    >
                      <span className="mr-3 flex-shrink-0">
                        {multipleChoiceSelections.includes(index) ? '☑️' : '☐'}
                      </span>
                      <span className="flex-1 text-left text-sm sm:text-base leading-relaxed break-words hyphens-auto">{option.text}</span>
                    </Button>
                    {/* 显示解释（如果有） */}
                    {option.explanation && answerState === 'answered' && (
                      <div className="ml-4 sm:ml-8 p-3 bg-gray-50 rounded-lg border-l-4 border-blue-400">
                        <p className="text-xs sm:text-sm text-gray-700 break-words hyphens-auto">
                          <span className="font-semibold text-blue-700">解释：</span>
                          {option.explanation}
                        </p>
                      </div>
                    )}
                  </div>
                ))}
                {answerState === 'idle' && (
                  <Button
                    onClick={handleMultipleChoiceSubmit}
                    disabled={multipleChoiceSelections.length === 0}
                    size="lg"
                    className="w-full mt-4 text-base sm:text-lg py-4 sm:py-6 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700"
                  >
                    确认提交 ({multipleChoiceSelections.length} 项已选)
                  </Button>
                )}
                {/* 最后一题的倒计时提示 */}
                {answerState === 'answered' && question.id === 10 && countdown > 0 && (
                  <div className="mt-6 bg-gradient-to-r from-blue-100 to-indigo-100 rounded-xl p-4 sm:p-6 border-2 border-blue-400 shadow-lg text-center">
                    <p className="text-base sm:text-lg font-semibold text-blue-900 mb-2">
                      📖 请仔细阅读上方的解释内容
                    </p>
                    <p className="text-2xl sm:text-3xl font-bold text-blue-600">
                      {countdown} 秒后自动进入结果页面
                    </p>
                  </div>
                )}
              </>
            ) : (
              // 单选题渲染
              question.options.map((option, index) => (
                <div key={index}>
                  <Button
                    variant="outline"
                    className={getOptionButtonClass(index, option.score) + ' whitespace-normal break-words hyphens-auto py-3 sm:py-4'}
                    onClick={() => handleAnswer(index)}
                    disabled={answerState === 'answered'}
                  >
                    <span className="flex-1 text-left text-sm sm:text-base leading-relaxed break-words hyphens-auto">{option.text}</span>
                  </Button>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

