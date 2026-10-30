/**
 * 投稿表单字段显隐的解析逻辑测试
 * ------------------------------------------------------------------
 * `GalleryFormFields` 是运营在后台手填的逗号串，很容易手滑写出
 * 空串、多余空格、拼错字段名。这里把容错规则钉死，避免改一次配置
 * 就把投稿表单弄坏。
 */
import { describe, expect, it } from 'vitest'

import {
  DEFAULT_FORM_FIELDS,
  parseFormFields,
} from '../use-form-fields'

describe('parseFormFields', () => {
  it('空值回退到默认全字段', () => {
    expect(parseFormFields(undefined)).toEqual(new Set(DEFAULT_FORM_FIELDS))
    expect(parseFormFields('')).toEqual(new Set(DEFAULT_FORM_FIELDS))
    expect(parseFormFields('   ')).toEqual(new Set(DEFAULT_FORM_FIELDS))
  })

  it('认不出的配置整体回退默认，避免表单变空白', () => {
    expect(parseFormFields('foo,bar')).toEqual(new Set(DEFAULT_FORM_FIELDS))
  })

  it('容忍空格与未知字段，只保留认识的', () => {
    const picked = parseFormFields(' title , tags , nonexistent ')
    expect(picked.has('title')).toBe(true)
    expect(picked.has('tags')).toBe(true)
    expect(picked.has('nonexistent' as never)).toBe(false)
  })

  it('必填字段即使被删掉也强制保留', () => {
    const picked = parseFormFields('prompt_en,tags')
    expect(picked.has('title')).toBe(true)
    expect(picked.has('prompt')).toBe(true)
    expect(picked.has('cover')).toBe(true)
    // 可选字段按配置来
    expect(picked.has('prompt_en')).toBe(true)
    expect(picked.has('tags')).toBe(true)
    expect(picked.has('model')).toBe(false)
    expect(picked.has('category')).toBe(false)
  })

  it('非字符串类型（后端下发 null 等）按未配置处理', () => {
    expect(parseFormFields(null)).toEqual(new Set(DEFAULT_FORM_FIELDS))
    expect(parseFormFields(123)).toEqual(new Set(DEFAULT_FORM_FIELDS))
  })
})
