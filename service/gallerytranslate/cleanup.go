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

package gallerytranslate

import (
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"
)

// 用量记录保留天数。超过这个窗口的记录对「今天用了几次」没有任何用处，
// 留着只会让表无限膨胀。
const usageRetentionDays = 90

const usageCleanupInterval = 24 * time.Hour

// StartUsageCleanup 起一个后台协程定期清理过期用量记录。
//
// 只有主节点干活 —— 多副本部署时每个节点都清理一遍纯属浪费，
// 而且并发 DELETE 在 PostgreSQL 上很容易互相阻塞。
func StartUsageCleanup() {
	if !common.IsMasterNode {
		return
	}
	go func() {
		cleanupUsage()
		ticker := time.NewTicker(usageCleanupInterval)
		defer ticker.Stop()
		for range ticker.C {
			cleanupUsage()
		}
	}()
}

func cleanupUsage() {
	if err := model.CleanupTranslateUsage(usageRetentionDays); err != nil {
		common.SysError(common.LogText(
			"failed to clean up expired gallery translate usage: %s", err.Error(),
		))
	}
}
