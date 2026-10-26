/**
 * GalleryHome 首页默认数据（移植自 gallery-frontend content.tsx）
 * ------------------------------------------------------------------
 * 首页完全数据驱动：改这里的文案/图片/链接即改页面。
 * URL 已适配 New API（rc.46）真实路由：/prompt-gallery、/pricing、/about。
 */

export type HeroColors = {
  screenBg: string
  ink: string
  muted: string
  line: string
  accentFrom: string
  accentVia: string
  accentTo: string
  scrimTop: string
  scrimMid: string
  scrimBottom: string
  badgeFrom: string
  badgeTo: string
  primaryBtn: string
  primaryBtnInk: string
}

export type HeroCardConfig = {
  enabled: boolean
  tag: string
  title: string
  model: string
  ratio: string
  count: string
  images: string[]
}

export const HOME_DATA = {
  hero: {
    title: '想象一下。\n让它成为现实。',
    titleAccent: '让它成为现实。',
    subtitle:
      '一个将您的想法变成图像、电影等的地方。使用领先的 AI 模型进行创建，一切都在一个工作区中进行。',
    badge: '新的',
    announcement: '画布 Agent 上线：说一句话，画布自动搭好',
    primaryLabel: '进入画布 Agent 创作',
    primaryUrl: '/prompt-gallery',
    secondaryLabel: '观看介绍',
    secondaryUrl: '',
    secondaryTime: '0:47',
    metaLabels: ['无需开会员', '按量付费', '人人享受超低价'],
    colors: {
      screenBg: '#030b0f',
      ink: '#f5f1e8',
      muted: 'rgba(245, 241, 232, 0.66)',
      line: 'rgba(255, 255, 255, 0.14)',
      accentFrom: '#f6d29a',
      accentVia: '#e2a056',
      accentTo: '#fff0d4',
      scrimTop: 'rgba(3, 11, 15, 0.6)',
      scrimMid: 'rgba(3, 11, 15, 0.82)',
      scrimBottom: '#030b0f',
      badgeFrom: '#f6d29a',
      badgeTo: '#e2a056',
      primaryBtn: '#d9ff43',
      primaryBtnInk: '#08120a',
    } as HeroColors,
    card: {
      enabled: true,
      tag: '四像生成',
      title: '银色兜帽人像，暖金逆光，极简黑背景',
      model: 'GPT Image 2.5',
      ratio: '3:4',
      count: '×3',
      images: [
        '/images/home/model-image-v4.webp',
        '/images/home/studio-portrait-v3.webp',
        '/images/home/model-image-v3.webp',
      ],
    } as HeroCardConfig,
  },
  agent: {
    eyebrow: 'Canvas Agent',
    title: '说出想法，画布自动生成。',
    lead: '用一句话描述你想要什么。Canvas Agent 挑选模型、写好每个 prompt、接好参考图，并在你确认前展示价格。',
    placeholder: '描述你想创作的内容',
    autoLabel: 'Auto（推荐）',
    genLabel: '生成',
    features: [
      {
        icon: 'LayoutGrid',
        title: '规划整个工作流',
        desc: '模型、prompt、节点与连接在画布上为你排布好，随时可运行。',
      },
      {
        icon: 'Sparkles',
        title: '常见任务的技能',
        desc: '多页绘本、漫画分镜、角色表、海报系列、多镜头视频与商品套装，一句话搞定。',
      },
      {
        icon: 'Images',
        title: '与你的参考图协作',
        desc: '选择图片或 @ 提及节点；Agent 让角色与商品在每一帧保持一致。',
      },
      {
        icon: 'ShieldCheck',
        title: '一切由你掌控',
        desc: '先查看方案与预估价格。在你确认之前，不会生成任何内容。',
      },
    ],
  },
  studios: {
    eyebrow: '一个想法。每种创作方式。',
    title: '一个想法。每种创作方式。',
    lead: '用于探索的视觉工作区、用于提速的专注工作室，以及当想法成为产品时稳定的模型接入。',
    items: [
      {
        image: '/images/home/creative-workspace-hero.webp',
        kicker: 'Canvas',
        title: '在无限画布上编排',
        desc: '在一块流畅的视觉工作流里安排参考图、prompt、图像、视频与声音。让整个想法尽收眼底。',
        cta: '进入画廊',
        url: '/prompt-gallery',
      },
      {
        image: '/images/home/studio-portrait-v3.webp',
        kicker: 'Image studio',
        title: '文生图',
        desc: '从一句话到精致图像，手边就是领先的图像模型。',
        cta: '浏览图像作品',
        url: '/prompt-gallery',
      },
      {
        image: '/images/home/model-cinema-v3.webp',
        kicker: 'Video studio',
        title: '文生视频',
        desc: '把文字或静帧变成电影感镜头，并执导每一秒。',
        cta: '浏览视频作品',
        url: '/prompt-gallery',
      },
    ],
  },
  gallery: {
    eyebrow: '一点灵感。无限可能。',
    title: '一点灵感。无限可能。',
    lead: '好想法值得被分享。浏览作品、发现 prompt，带去新的地方。',
    tabs: ['全部', '图像', '视频'],
    exploreLabel: '浏览画廊',
    featuredTitle: '灵感广场 · 社区精选',
    featuredVideo: '/videos/gallery-video.mp4',
    items: [
      {
        title: '90 年代冷调仙侠 · 翡翠绿汉服肖像',
        model: 'gpt-image-2.5',
        cover: '/images/home/model-image-v4.webp',
        url: '/prompt-gallery',
      },
      {
        title: '超精细 3D 漫画星收藏海报',
        model: 'gpt-image-2.5',
        cover: '/images/home/studio-portrait-v3.webp',
        url: '/prompt-gallery',
      },
      {
        title: '复古赛车海报设计 Prompt',
        model: 'gpt-image-2.5',
        cover: '/images/home/creative-studios.webp',
        url: '/prompt-gallery',
      },
      {
        title: 'Q 版角色聊天贴纸生成 Prompt',
        model: 'gpt-image-2.5',
        cover: '/images/home/model-image-v3.webp',
        url: '/prompt-gallery',
      },
      {
        title: '儿童科普百科海报：认识蜜蜂',
        model: 'gpt-image-2.5',
        cover: '/images/home/creative-workspace-hero.webp',
        url: '/prompt-gallery',
      },
    ],
  },
  models: {
    eyebrow: '顶尖模型，没有迷宫。',
    title: '顶尖模型，没有迷宫。',
    lead: '从最常被用到的模型开始。准备好时，随时对比价格与能力。',
    stats: { models: 295, providers: 30 },
    exploreLabel: '浏览模型与价格',
    items: [
      {
        rank: 1,
        name: 'Seedance 2.5',
        type: '视频生成 · 文生视频',
        thumb: '/images/home/model-cinema-v4.webp',
        url: '/pricing',
      },
      {
        rank: 2,
        name: 'Seedance 2.0',
        type: '视频生成 · 文生视频',
        thumb: '/images/home/hero-world-v3.webp',
        url: '/pricing',
      },
      {
        rank: 3,
        name: 'GPT Image 2.5',
        type: '图像生成 · 文生图',
        thumb: '/images/home/model-image-v4.webp',
        url: '/pricing',
      },
      {
        rank: 4,
        name: 'Seedream 5 Pro',
        type: '图像生成 · 文生图',
        thumb: '/images/home/model-image-v3.webp',
        url: '/pricing',
      },
      {
        rank: 5,
        name: 'Kling',
        type: '视频生成 · 文生视频',
        thumb: '/images/home/creative-workspace-hero.webp',
        url: '/pricing',
      },
      {
        rank: 6,
        name: 'MinMax H3',
        type: '视频生成',
        thumb: '/images/home/creative-studios.webp',
        url: '/pricing',
      },
      {
        rank: 7,
        name: 'Vidu',
        type: '视频生成 · 文生视频',
        thumb: '/images/home/canvas-world-v3.webp',
        url: '/pricing',
      },
      {
        rank: 8,
        name: 'Wan 3.0',
        type: '视频生成 · 图生视频',
        thumb: '/images/home/model-reasoning-v3.webp',
        url: '/pricing',
      },
      {
        rank: 9,
        name: 'HappyHorse',
        type: '视频生成 · 文生视频',
        thumb: '/images/home/closing-horizon-v3.webp',
        url: '/pricing',
      },
      {
        rank: 10,
        name: 'DeepSeek',
        type: '对话 · 推理',
        thumb: '/images/home/model-reasoning-v4.webp',
        url: '/pricing',
      },
    ],
  },
  cta: {
    title: '用一个兼容的 API 上线。',
    lead: '用一套一致的 API 调用对话、图像与视频模型，在一个地方完成接入、路由与使用记录。',
    features: ['OpenAI 兼容路由', '一个密钥，所有模型', '透明的计费'],
    codeTitle: '代码示例',
    code: `curl https://your-domain/v1/chat/completions \\
  -H "Authorization: Bearer $API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{
    "model": "deepseek/deepseek-v4-pro",
    "messages": [{"role": "user", "content": "Hello"}]
  }'`,
    genLabel: '生成',
    connectLabel: '立即连接',
    connectUrl: '/pricing',
  },
}

export const MOTION_DATA = {
  // 首屏视频：两段顺序播放（第一段播完接第二段，再循环）
  heroVideo: {
    enabled: true,
    videos: ['/videos/hero-video.mp4', '/videos/gallery-video.mp4'],
    mask: 0.82,
  },
  // Hero 内底部滚动条（对标 .home-ticker：42s + hover 暂停 + 金色菱形点）
  heroTicker: {
    enabled: true,
    durationSec: 42,
    bg: 'rgba(255, 255, 255, 0.04)',
    dot: '#f7bf77',
    text: 'rgba(245, 241, 232, 0.74)',
    prefix: '现已上市',
  },
  ticker: [
    'DeepSeek',
    'Seedance 2.5',
    'Seedance 2.0',
    'GPT Image 2.5',
    'Seedream 5 Pro',
    'Kling',
    'MinMax H3',
    'Vidu',
    'Wan 3.0',
    'HappyHorse',
  ],
  tickerSec: 30,
}
