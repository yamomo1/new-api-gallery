package watermark

import (
	"bytes"
	"encoding/binary"
	"fmt"
	"time"
)

// MP4 隐式标识。
//
// 这里刻意不做「重编码时顺带写元数据」，因为服务端没有 GPU、纯 CPU 转码
// 一条 10 秒视频要几十秒，会拖垮上传接口。改为直接在文件结构上挂元数据，
// 毫秒级完成、画质零损失。
//
// 两条写入路径，按容器布局自动选择：
//  1. moov 位于文件尾部时，直接在 moov 里插一个 udta 盒（©cmt/©nam/©des），
//     这是 QuickTime/MP4 最通用的文本元数据位置；
//  2. moov 在 mdat 之前（faststart 布局，网站视频的常态）时，插入会移动 mdat，
//     使 stco/co64 里的绝对偏移全部失效、视频直接损坏。此情形改为在文件末尾
//     追加一个顶层 uuid 盒承载 XMP —— 顶层扩展盒按规范会被播放器忽略，
//     且不改变任何已有字节的偏移。

// xmpUUID 是 Adobe 为 MP4 中的 XMP 定义的标准 UUID。
var xmpUUID = [16]byte{
	0xBE, 0x7A, 0xCF, 0xCB, 0x97, 0xA9, 0x42, 0xE8,
	0x9C, 0x71, 0x99, 0x94, 0x91, 0xE3, 0xAF, 0xAC,
}

type mp4Box struct {
	typ        string
	offset     int
	headerSize int
	totalSize  int
}

// writeMP4Meta 给 MP4/MOV 写入生成标识元数据。
func writeMP4Meta(data []byte, cfg Config) ([]byte, error) {
	boxes, err := parseMP4Boxes(data)
	if err != nil {
		return nil, err
	}

	var moov, lastMdat *mp4Box
	for i := range boxes {
		switch boxes[i].typ {
		case "moov":
			moov = &boxes[i]
		case "mdat":
			lastMdat = &boxes[i]
		}
	}
	if moov == nil {
		return nil, fmt.Errorf("MP4 缺少 moov 盒")
	}

	// 路径 1：moov 在所有 mdat 之后，可安全地在 moov 内部追加 udta
	if lastMdat == nil || moov.offset > lastMdat.offset {
		out, err := insertMoovUdta(data, moov, cfg)
		if err == nil {
			return append(out, buildTopLevelXMP(cfg)...), nil
		}
		// 插入失败不致命，退回路径 2
	}

	// 路径 2：末尾追加 XMP 扩展盒
	out := make([]byte, 0, len(data)+1024)
	out = append(out, data...)
	out = append(out, buildTopLevelXMP(cfg)...)
	return out, nil
}

// parseMP4Boxes 解析顶层 box 列表。
func parseMP4Boxes(data []byte) ([]mp4Box, error) {
	var boxes []mp4Box
	pos := 0
	for pos+8 <= len(data) {
		size := int(binary.BigEndian.Uint32(data[pos : pos+4]))
		typ := string(data[pos+4 : pos+8])
		headerSize := 8
		total := size

		if size == 1 {
			// 64 位 largesize
			if pos+16 > len(data) {
				break
			}
			total = int(binary.BigEndian.Uint64(data[pos+8 : pos+16]))
			headerSize = 16
		} else if size == 0 {
			// 延伸到文件末尾
			total = len(data) - pos
		}
		if total < headerSize || pos+total > len(data) {
			break // 结构不完整，停止解析，保留已解析结果
		}
		boxes = append(boxes, mp4Box{typ: typ, offset: pos, headerSize: headerSize, totalSize: total})
		pos += total
	}
	if len(boxes) == 0 {
		return nil, fmt.Errorf("不是合法的 MP4（无法解析顶层盒）")
	}
	return boxes, nil
}

// insertMoovUdta 在 moov 内部末尾插入 udta 盒（含文本元数据）。
// 由于 moov 在文件末尾，扩大它不会移动任何 mdat，stco 偏移始终有效。
func insertMoovUdta(data []byte, moov *mp4Box, cfg Config) ([]byte, error) {
	udta := buildUdta(cfg)
	if udta == nil {
		return nil, fmt.Errorf("udta 构造失败")
	}

	moovEnd := moov.offset + moov.totalSize
	if moovEnd > len(data) {
		return nil, fmt.Errorf("moov 越界")
	}

	var out bytes.Buffer
	out.Grow(len(data) + len(udta))
	out.Write(data[:moovEnd])
	out.Write(udta)
	out.Write(data[moovEnd:])

	result := out.Bytes()

	// 回填 moov 的新长度
	newSize := moov.totalSize + len(udta)
	if moov.headerSize == 8 && newSize < 1<<32 {
		binary.BigEndian.PutUint32(result[moov.offset:moov.offset+4], uint32(newSize))
	} else if moov.headerSize == 16 {
		binary.BigEndian.PutUint64(result[moov.offset+8:moov.offset+16], uint64(newSize))
	} else {
		// size==0（延伸到末尾）的 moov 无法扩容，放弃
		return nil, fmt.Errorf("moov 使用延展长度，无法扩容")
	}
	return result, nil
}

// buildUdta 构造 udta 盒：©nam（标题）、©cmt（注释）、©des（描述）。
// 文本按 UTF-8 存放，Apple/QuickTime 体系与多数国产工具都能读取。
func buildUdta(cfg Config) []byte {
	nam := textBox("©nam", cfg.ProviderName+" AI 作品")
	cmt := textBox("©cmt", cfg.DeclareText+" | "+cfg.ProviderName+" | "+cfg.ContentID())
	des := textBox("©des", cfg.DeclareText)

	payload := bytes.Join([][]byte{nam, cmt, des}, nil)
	return box("udta", payload)
}

// box 组装一个 32 位长度的标准 box。
func box(typ string, payload []byte) []byte {
	var b bytes.Buffer
	var size [4]byte
	binary.BigEndian.PutUint32(size[:], uint32(len(payload)+8))
	b.Write(size[:])
	b.WriteString(typ)
	b.Write(payload)
	return b.Bytes()
}

// textBox 组装一个纯文本载荷的 box（如 ©cmt）。
func textBox(typ, text string) []byte {
	return box(typ, []byte(text))
}

// buildTopLevelXMP 构造承载 XMP 的顶层 uuid 盒。
func buildTopLevelXMP(cfg Config) []byte {
	var payload bytes.Buffer
	payload.Write(xmpUUID[:])

	// MP4 里的 XMP 不带 xpacket 包装头，直接是 rdf 文档
	payload.WriteString(`<x:xmpmeta xmlns:x="adobe:ns:meta/">`)
	payload.WriteString(`<rdf:RDF xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#">`)
	payload.WriteString(`<rdf:Description rdf:about=""`)
	payload.WriteString(` xmlns:xmp="http://ns.adobe.com/xap/1.0/"`)
	payload.WriteString(` xmlns:dc="http://purl.org/dc/elements/1.1/"`)
	payload.WriteString(` xmlns:Iptc4xmpExt="http://iptc.org/std/Iptc4xmpExt/2008-02-29/"`)
	payload.WriteString(` xmlns:xmpMM="http://ns.adobe.com/xap/1.0/mm/"`)
	payload.WriteString(` xmp:CreatorTool="` + xmlEscape(cfg.ProviderName) + `"`)
	payload.WriteString(` xmpMM:DocumentID="` + xmlEscape(cfg.ContentID()) + `"`)
	payload.WriteString(` xmp:CreateDate="` + nowISO() + `"`)
	payload.WriteString(` Iptc4xmpExt:DigitalSourceType="` + iptcDigitalSourceType + `">`)
	payload.WriteString(`<dc:description><rdf:Alt><rdf:li xml:lang="x-default">` +
		xmlEscape(cfg.DeclareText) + `</rdf:li></rdf:Alt></dc:description>`)
	payload.WriteString(`</rdf:Description></rdf:RDF></x:xmpmeta>`)

	return box("uuid", payload.Bytes())
}

// nowISO 返回带时区的 ISO8601 时间串（元数据用）。
func nowISO() string {
	return time.Now().Format("2006-01-02T15:04:05-07:00")
}

// exifDateTime 返回 EXIF 规定的日期格式：YYYY:MM:DD HH:MM:SS。
func exifDateTime() string {
	return time.Now().Format("2006:01:02 15:04:05")
}
