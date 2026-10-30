/*
Copyright (C) 2023-2026 QuantumNous

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU Affero General Public License as
published by the Free Software Foundation, either version 3 of the
License, or (at your option) any later version.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
GNU Affero General Public License for more details.

You should have received a copy of the GNU Affero General Public License
along with this program. If not, see <https://www.gnu.org/licenses/>.

For commercial licensing, please contact support@quantumnous.com
*/

/**
 * RunningHub 外链 · 单一真源
 * ------------------------------------------------------------------
 * 站内任何指向 runninghub.cn 的链接都必须走本文件的函数，别再手拼 URL：
 * 手拼极容易漏掉 `inviteCode`，而漏码就等于白送流量。
 *
 * 推广规则（2026-10 官网口径）：邀请 1 名新用户注册 →
 * 邀请人 +500 RH 币、新用户 +500 RH 币。
 *
 * ⚠️ 推广码只作用于「新账号注册」这一次结算：
 * 后端采集器用本站自己的 apiKey 跑任务，扣的是本站账号的 RH 币，
 * 与 inviteCode 无关（别指望给 API 调用加码能返利）。
 *
 * 链接格式（官方页面实测）：
 * - 首页      https://www.runninghub.cn/?inviteCode=xxxx
 * - 工作流页  https://www.runninghub.cn/workflow/{workflowId}?inviteCode=xxxx
 * - 社区/项目 https://www.runninghub.cn/projects?inviteCode=xxxx
 */

export const RUNNINGHUB_BASE = 'https://www.runninghub.cn'

/**
 * 用户自有推广码（2026-10-30 确认）。
 * 改这一处即全站生效；早期文档里的 `rh-v1121` 是别人链接带来的码，已废弃。
 */
export const RUNNINGHUB_INVITE_CODE = 'vuw9qfkj'

export type RunningHubLinkOptions = {
  /** 站内路径，默认首页。如 '/projects'、'/models' */
  path?: string
  /** 工作流 ID，优先于 path；拼成 /workflow/{id} */
  workflowId?: string | number | null
  /** 临时覆盖推广码（默认 RUNNINGHUB_INVITE_CODE；传空串表示不带码） */
  inviteCode?: string | null
}

/**
 * 拼 RunningHub 链接：始终带 inviteCode。
 * 已带 `inviteCode` 的链接不会重复追加（尊重调用方显式传入的值）。
 */
export function runningHubUrl(options: RunningHubLinkOptions = {}): string {
  const { path, workflowId, inviteCode } = options

  const workflow = workflowId == null ? '' : String(workflowId).trim()
  let base = RUNNINGHUB_BASE
  if (workflow) {
    base += `/workflow/${encodeURIComponent(workflow)}`
  } else if (path) {
    base += path.startsWith('/') ? path : `/${path}`
  }

  let url: URL
  try {
    url = new URL(base)
  } catch {
    return base
  }

  const code = (inviteCode ?? RUNNINGHUB_INVITE_CODE).trim()
  if (code && !url.searchParams.has('inviteCode')) {
    url.searchParams.set('inviteCode', code)
  }
  return url.toString()
}

/** 指定工作流的体验页（带推广码） */
export function runningHubWorkflowUrl(
  workflowId: string | number,
  inviteCode?: string
): string {
  return runningHubUrl({ workflowId, inviteCode })
}

/** 推广首页（拉新落地页，带推广码） */
export function runningHubInviteUrl(inviteCode?: string): string {
  return runningHubUrl({ inviteCode })
}
