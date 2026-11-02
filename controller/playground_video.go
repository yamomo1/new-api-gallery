package controller

import (
	"net/http"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/constant"
	"github.com/QuantumNous/new-api/middleware"
	"github.com/QuantumNous/new-api/model"

	"github.com/gin-gonic/gin"
)

// 站内创作页的视频生成（二开新增）
// ---------------------------------------------------------------------------
// New API 本身完整支持视频：plugins/tasks 下内嵌 11 个任务插件（豆包 Seedance、
// 可灵、海螺、Vidu、即梦、Veo、Sora、万相、xAI…），共 61 个视频模型。
// 但它们全部挂在 /v1/videos 上，而 /v1 整组是 middleware.TokenAuth() ——
// 只认 sk- 开头的 API 令牌，网页的登录会话进不去（会判「无效的令牌」）。
//
// 这里照 /pg/images/generations 的先例补一条会话鉴权的入口：路径挂 /pg，
// GenRelayInfo 靠这个前缀判定 playground 语义（跳过令牌预扣、按用户额度计费）。
//
// 与图片不同的是视频是**异步任务**：提交只返回 task_id，结果要靠轮询。
// 因此除了提交，还提供 PlaygroundVideoFetch 读本地的任务表（带 userId 归属校验，
// 不会串号看到别人的任务）。

// PlaygroundVideoCreate 提交视频任务（POST /pg/videos）。
//
// 中间件顺序与 /v1/videos 保持一致（PinTaskPluginEndpoint → PrepareTaskPluginEndpoint
// → Distribute），只把 TokenAuth 换成 UserAuth；控制器本身只做临时令牌注入，
// 真正的提交仍交给 RelayTask，避免出现第二套计费/落库逻辑。
func PlaygroundVideoCreate(c *gin.Context) {
	userId := c.GetInt("id")

	userCache, err := model.GetUserCache(userId)
	if err != nil {
		c.JSON(http.StatusOK, gin.H{"success": false, "message": err.Error()})
		return
	}
	userCache.WriteContext(c)

	tempToken := &model.Token{
		UserId: userId,
		Name:   "playground-video",
		Group:  common.GetContextKeyString(c, constant.ContextKeyUsingGroup),
	}
	if err := middleware.SetupContextForToken(c, tempToken); err != nil {
		c.JSON(http.StatusOK, gin.H{"success": false, "message": err.Error()})
		return
	}

	RelayTask(c)
}

// PlaygroundVideoFetch 查询视频任务（GET /pg/videos/:task_id）。
//
// 直接读本地任务表而不是再请求上游：轮询频率高（前端 3s 一次），
// 每次回源会把上游打爆；后台的同步任务会自己把状态写回来。
// GetByTaskId 带 userId 条件，别人的 task_id 查不到。
func PlaygroundVideoFetch(c *gin.Context) {
	userId := c.GetInt("id")
	taskId := c.Param("task_id")
	if taskId == "" {
		c.JSON(http.StatusBadRequest, gin.H{
			"success": false,
			"message": "task_id is required",
		})
		return
	}

	task, exists, err := model.GetByTaskId(userId, taskId)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"success": false,
			"message": "查询任务失败",
		})
		return
	}
	if !exists || task == nil {
		c.JSON(http.StatusNotFound, gin.H{
			"success": false,
			"message": "任务不存在",
		})
		return
	}

	data := gin.H{
		"task_id":    task.TaskID,
		"status":     task.Status.ToVideoStatus(),
		"model":      task.Properties.OriginModelName,
		"created_at": task.CreatedAt,
		"progress":   task.Progress,
	}
	if task.Status == model.TaskStatusSuccess {
		data["completed_at"] = task.FinishTime
		// 上游结果是带签名的直链（通常 24h 内有效），交给前端 <video> 直接播
		if url := task.GetResultURL(); url != "" {
			data["url"] = url
		}
	}
	if task.Status == model.TaskStatusFailure {
		data["error"] = task.FailReason
	}

	c.JSON(http.StatusOK, gin.H{"success": true, "data": data})
}
