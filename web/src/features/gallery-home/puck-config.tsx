/**
 * Puck 可视化搭建配置
 * ------------------------------------------------------------------
 * 把首页 8 个内置区块 + 2 个自定义区块注册成 Puck 组件。
 * 内置区块无 props（内容来自 GalleryHomeDataContext，即后台语种分桶）；
 * 自定义区块（CustomText / CustomBanner）的文案在 Puck 面板里填。
 *
 * 数据形状（Puck Data）：{ root, content: [{ type, props, id }] }
 * 存进 HomeConfig.puck，前台用 <Render> 渲染、后台用 <Puck> 编辑。
 */
import type { Config, Data } from '@measured/puck'

import {
  AgentSection,
  ClosingSection,
  CtaSection,
  CustomBannerSection,
  CustomTextSection,
  GallerySection,
  HeroSection,
  ModelTickerSection,
  ModelsSection,
  StudiosSection,
  type CustomBannerProps,
  type CustomTextProps,
} from './sections'

/** 内置区块类型（顺序即默认首页顺序） */
export const BLOCK_KEYS = [
  'Hero',
  'Agent',
  'Studios',
  'Gallery',
  'Models',
  'Cta',
  'Closing',
  'ModelTicker',
] as const

export type BuiltinBlock = (typeof BLOCK_KEYS)[number]

/** 后台「页面搭建」里组件面板的展示名（英文即 i18n key） */
export const BUILTIN_BLOCK_LABELS: Record<string, string> = {
  Hero: 'Hero',
  Agent: 'Canvas Agent',
  Studios: 'Studios',
  Gallery: 'Gallery',
  Models: 'Models',
  Cta: 'API CTA',
  Closing: 'Closing',
  ModelTicker: 'Model ticker',
  CustomText: 'Custom text',
  CustomBanner: 'Custom banner',
}

export const PUCK_CONFIG: Config = {
  components: {
    Hero: {
      label: BUILTIN_BLOCK_LABELS.Hero,
      fields: {},
      render: () => <HeroSection />,
    },
    Agent: {
      label: BUILTIN_BLOCK_LABELS.Agent,
      fields: {},
      render: () => <AgentSection />,
    },
    Studios: {
      label: BUILTIN_BLOCK_LABELS.Studios,
      fields: {},
      render: () => <StudiosSection />,
    },
    Gallery: {
      label: BUILTIN_BLOCK_LABELS.Gallery,
      fields: {},
      render: () => <GallerySection />,
    },
    Models: {
      label: BUILTIN_BLOCK_LABELS.Models,
      fields: {},
      render: () => <ModelsSection />,
    },
    Cta: {
      label: BUILTIN_BLOCK_LABELS.Cta,
      fields: {},
      render: () => <CtaSection />,
    },
    Closing: {
      label: BUILTIN_BLOCK_LABELS.Closing,
      fields: {},
      render: () => <ClosingSection />,
    },
    ModelTicker: {
      label: BUILTIN_BLOCK_LABELS.ModelTicker,
      fields: {},
      render: () => <ModelTickerSection />,
    },
    CustomText: {
      label: BUILTIN_BLOCK_LABELS.CustomText,
      fields: {
        kicker: { type: 'text', label: 'Kicker' },
        title: { type: 'text', label: 'Title' },
        body: { type: 'textarea', label: 'Body' },
        url: { type: 'text', label: 'Link URL' },
        urlLabel: { type: 'text', label: 'Link label' },
      },
      defaultProps: {
        kicker: '',
        title: 'A new section',
        body: 'Write something for your visitors here.',
        url: '',
        urlLabel: '',
      } as unknown as CustomTextProps,
      render: (props) => <CustomTextSection {...(props as unknown as CustomTextProps)} />,
    },
    CustomBanner: {
      label: BUILTIN_BLOCK_LABELS.CustomBanner,
      fields: {
        title: { type: 'text', label: 'Title' },
        body: { type: 'textarea', label: 'Body' },
        url: { type: 'text', label: 'Link URL' },
        bg: { type: 'text', label: 'Background (css)' },
      },
      defaultProps: {
        title: 'Announcement',
        body: '',
        url: '',
        bg: '',
      } as unknown as CustomBannerProps,
      render: (props) => <CustomBannerSection {...(props as unknown as CustomBannerProps)} />,
    },
  },
}

/** 默认首页布局：8 个内置区块按 BLOCK_KEYS 顺序 */
export function buildDefaultPuckData(): Data {
  return {
    root: {},
    content: BLOCK_KEYS.map((type) => ({ type, props: {}, id: `builtin-${type}` })),
  }
}
