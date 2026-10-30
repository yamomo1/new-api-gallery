package watermark

import (
	"bytes"
	"encoding/binary"
	"fmt"
	"hash/crc32"
	"strings"
)

// PNG 隐式标识：在 IEND 之前插入 iTXt / tEXt 辅助数据块。
//
// 选 iTXt 而非 tEXt 作为主载体，是因为 iTXt 用 UTF-8 编码，
// 能无损写入中文声明（tEXt 只支持 Latin-1，写中文会乱码）。
// 同时补一组 ASCII 的 tEXt，兼容只认 tEXt 的旧工具。

var pngSignature = []byte{0x89, 'P', 'N', 'G', 0x0D, 0x0A, 0x1A, 0x0A}

// pngTextChunk 描述一个待写入的文本块。
type pngTextChunk struct {
	keyword string
	value   string
	utf8    bool // true -> iTXt，false -> tEXt
}

// writePNGMeta 把生成标识写进 PNG。
// 实现方式是不解码像素、直接操作 chunk 流，因此画质零损失、速度接近拷贝。
func writePNGMeta(data []byte, cfg Config) ([]byte, error) {
	if len(data) < 8 || !bytes.Equal(data[:8], pngSignature) {
		return nil, fmt.Errorf("不是合法的 PNG")
	}

	chunks := buildPNGTextChunks(cfg)

	// 先扫描一遍，记录已被占用的关键字，避免重复写入导致解码器读到旧值
	existing := map[string]bool{}
	pos := 8
	for pos+8 <= len(data) {
		length := int(binary.BigEndian.Uint32(data[pos : pos+4]))
		ctype := string(data[pos+4 : pos+8])
		if pos+12+length > len(data) {
			break
		}
		if ctype == "tEXt" || ctype == "iTXt" {
			if kw := pngChunkKeyword(data[pos+8 : pos+8+length]); kw != "" {
				existing[kw] = true
			}
		}
		pos += 12 + length
	}

	var out bytes.Buffer
	out.Write(data[:8])

	pos = 8
	for pos+8 <= len(data) {
		length := int(binary.BigEndian.Uint32(data[pos : pos+4]))
		ctype := string(data[pos+4 : pos+8])
		end := pos + 12 + length
		if end > len(data) {
			return nil, fmt.Errorf("PNG chunk 越界")
		}

		if ctype == "IEND" {
			// IEND 之前插入，规范允许辅助 chunk 出现在 IDAT 之后
			for _, ch := range chunks {
				if existing[ch.keyword] {
					continue // 已存在同名关键字，保留原值
				}
				payload := encodePNGTextPayload(ch)
				out.Write(be32(len(payload)))
				typ := []byte("tEXt")
				if ch.utf8 {
					typ = []byte("iTXt")
				}
				out.Write(typ)
				out.Write(payload)
				out.Write(be32(int(pngCRC(typ, payload))))
			}
		}

		out.Write(data[pos:end])
		pos = end
	}
	if pos != len(data) {
		// 尾部有无法识别的多余字节，原样续上，避免破坏文件
		out.Write(data[pos:])
	}
	return out.Bytes(), nil
}

// buildPNGTextChunks 组装要写入的键值对。
// AI 相关字段是《标识办法》要求的内容属性 / 服务提供者 / 内容编号三元组。
func buildPNGTextChunks(cfg Config) []pngTextChunk {
	id := cfg.ContentID()
	now := nowISO()

	return []pngTextChunk{
		{keyword: "Description", value: cfg.DeclareText + " | AI-generated content", utf8: true},
		{keyword: "Software", value: cfg.ProviderName, utf8: false},
		{keyword: "Creator Tool", value: cfg.ProviderName, utf8: false},
		{keyword: "Comment", value: cfg.DeclareText, utf8: true},
		{keyword: "AI-Generated", value: "true", utf8: false},
		{keyword: "AI-Generator", value: cfg.ProviderName, utf8: false},
		{keyword: "AI-Content-ID", value: id, utf8: false},
		{keyword: "AI-Generated-At", value: now, utf8: false},
		{keyword: "AI-Declare", value: cfg.DeclareText, utf8: true},
	}
}

// encodePNGTextPayload 按关键字编码 tEXt / iTXt 的 data 段。
func encodePNGTextPayload(ch pngTextChunk) []byte {
	var b bytes.Buffer
	if !ch.utf8 {
		// tEXt: keyword \0 text（Latin-1）
		b.WriteString(sanitizeKeyword(ch.keyword))
		b.WriteByte(0)
		b.WriteString(toLatin1(ch.value))
		return b.Bytes()
	}
	// iTXt: keyword \0 compFlag(1) compMethod(1) langTag \0 translatedKeyword \0 text(UTF-8)
	b.WriteString(sanitizeKeyword(ch.keyword))
	b.WriteByte(0)
	b.WriteByte(0) // 不压缩
	b.WriteByte(0) // 压缩方法固定 0
	b.WriteByte(0) // 空语言标签
	b.WriteByte(0) // 空翻译关键字
	b.WriteString(ch.value)
	return b.Bytes()
}

// pngChunkKeyword 从 tEXt/iTXt 数据段里取出关键字。
func pngChunkKeyword(payload []byte) string {
	i := bytes.IndexByte(payload, 0)
	if i <= 0 {
		return ""
	}
	return string(payload[:i])
}

// sanitizeKeyword 关键字只允许 1-79 字节的 Latin-1 可打印字符。
func sanitizeKeyword(k string) string {
	var b strings.Builder
	for _, r := range k {
		if r >= 32 && r < 127 {
			b.WriteRune(r)
		}
	}
	s := b.String()
	if s == "" {
		s = "Comment"
	}
	if len(s) > 79 {
		s = s[:79]
	}
	return s
}

// toLatin1 把字符串降级为 Latin-1（非 Latin-1 字符替换为 '?'）。
// tEXt 只能用 Latin-1，中文值请走 iTXt。
func toLatin1(s string) string {
	var b strings.Builder
	for _, r := range s {
		if r <= 0xFF {
			b.WriteByte(byte(r))
		} else {
			b.WriteByte('?')
		}
	}
	return b.String()
}

func be32(v int) []byte {
	var b [4]byte
	binary.BigEndian.PutUint32(b[:], uint32(v))
	return b[:]
}

func pngCRC(typ, payload []byte) uint32 {
	h := crc32.NewIEEE()
	h.Write(typ)
	h.Write(payload)
	return h.Sum32()
}
