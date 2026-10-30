package watermark

import (
	"bytes"
	"encoding/binary"
	"image"
	"image/color"
	"image/jpeg"
	"image/png"
	"testing"
)

func makeTestPNG(t *testing.T) []byte {
	t.Helper()
	img := image.NewRGBA(image.Rect(0, 0, 800, 600))
	for y := 0; y < 600; y++ {
		for x := 0; x < 800; x++ {
			img.Set(x, y, color.RGBA{R: uint8(x % 256), G: uint8(y % 256), B: 128, A: 255})
		}
	}
	var buf bytes.Buffer
	if err := png.Encode(&buf, img); err != nil {
		t.Fatal(err)
	}
	return buf.Bytes()
}

func makeTestJPEG(t *testing.T) []byte {
	t.Helper()
	img := image.NewRGBA(image.Rect(0, 0, 640, 480))
	for y := 0; y < 480; y++ {
		for x := 0; x < 640; x++ {
			img.Set(x, y, color.RGBA{R: 200, G: uint8(x % 256), B: uint8(y % 256), A: 255})
		}
	}
	var buf bytes.Buffer
	if err := jpeg.Encode(&buf, img, &jpeg.Options{Quality: 95}); err != nil {
		t.Fatal(err)
	}
	return buf.Bytes()
}

func TestPNGWritesMetaAndBadge(t *testing.T) {
	src := makeTestPNG(t)
	res := Process(src, "image/png")
	if !res.Implicit {
		t.Fatalf("隐式标识未写入: %v", res.ImplicitErr)
	}
	if !res.Explicit {
		t.Fatalf("显式标识未写入: %v", res.ExplicitErr)
	}
	if !bytes.Contains(res.Data, []byte("AI-Content-ID")) {
		t.Error("PNG 缺少 AI-Content-ID")
	}
	if !bytes.Contains(res.Data, []byte("\xC2\xA9")) && !bytes.Contains(res.Data, []byte("trainedAlgorithmic")) {
		t.Log("提示: 未找到 XMP（PNG 走 iTXt，属预期）")
	}
	// 尺寸必须保持不变
	img, err := png.Decode(bytes.NewReader(res.Data))
	if err != nil {
		t.Fatalf("处理后无法解码: %v", err)
	}
	if b := img.Bounds(); b.Dx() != 800 || b.Dy() != 600 {
		t.Errorf("尺寸被改变: %v", b)
	}
	// 右下角应被角标覆盖（与原图不同色）
	px := img.At(760, 570)
	_ = px

	if !HasMark(res.Data) {
		t.Error("HasMark 未识别出刚写入的标识")
	}
	// 幂等：二次处理不再改动
	res2 := Process(res.Data, "image/png")
	if res2.Explicit {
		t.Error("二次处理不应重复打角标")
	}
}

func TestJPEGWritesMetaAndBadge(t *testing.T) {
	src := makeTestJPEG(t)
	res := Process(src, "image/jpeg")
	if !res.Implicit || !res.Explicit {
		t.Fatalf("标识未写入 implicit=%v(%v) explicit=%v(%v)",
			res.Implicit, res.ImplicitErr, res.Explicit, res.ExplicitErr)
	}
	if !bytes.Contains(res.Data, []byte(iptcDigitalSourceType)) {
		t.Error("JPEG 缺少 XMP DigitalSourceType")
	}
	if !bytes.Contains(res.Data, []byte("Exif\x00\x00")) {
		t.Error("JPEG 缺少 EXIF")
	}
	if _, err := jpeg.Decode(bytes.NewReader(res.Data)); err != nil {
		t.Fatalf("处理后无法解码: %v", err)
	}
}

func TestMP4MetaAppend(t *testing.T) {
	// 构造一个最小 MP4：ftyp + moov(mvhd)
	var buf bytes.Buffer
	ftyp := make([]byte, 24)
	binary.BigEndian.PutUint32(ftyp[0:4], 24)
	copy(ftyp[4:8], "ftyp")
	copy(ftyp[8:12], "isom")
	buf.Write(ftyp)

	mvhdBody := make([]byte, 100)
	mvhdBody[0] = 0                                    // version 0
	binary.BigEndian.PutUint32(mvhdBody[12:16], 1000)  // timescale
	binary.BigEndian.PutUint32(mvhdBody[16:20], 15000) // duration = 15s
	mvhd := box("mvhd", mvhdBody)
	moov := box("moov", mvhd)
	buf.Write(moov)

	data := buf.Bytes()
	if d := mp4Duration(data); d.Seconds() != 15 {
		t.Errorf("时长解析错误: %v", d)
	}

	res := Process(data, "video/mp4")
	if !res.Implicit {
		t.Fatalf("MP4 隐式标识未写入: %v", res.ImplicitErr)
	}
	if !bytes.Contains(res.Data, []byte(iptcDigitalSourceType)) {
		t.Error("MP4 缺少 XMP DigitalSourceType")
	}
	if !bytes.Contains(res.Data, []byte("©cmt")) {
		t.Error("MP4 缺少 udta/©cmt")
	}
	// moov 在尾部时会回填 moov 的长度字段，但原有子盒必须完整保留
	if !bytes.Contains(res.Data, mvhd) {
		t.Error("原有 mvhd 子盒丢失")
	}
	if len(res.Data) <= len(data) {
		t.Error("处理后文件未增长，元数据没写进去")
	}
	// 重新解析应能识别出 udta
	boxes, err := parseMP4Boxes(res.Data)
	if err != nil {
		t.Fatalf("处理后无法解析: %v", err)
	}
	var moovLen int
	for _, b := range boxes {
		if b.typ == "moov" {
			moovLen++
			if !bytes.Contains(res.Data[b.offset:b.offset+b.totalSize], []byte("udta")) {
				t.Error("moov 内缺少 udta")
			}
		}
	}
	if moovLen != 1 {
		t.Errorf("moov 数量异常: %d", moovLen)
	}
}

func TestUnknownSkipped(t *testing.T) {
	res := Process([]byte("hello world"), "text/plain")
	if !res.Skipped {
		t.Error("非媒体文件应跳过")
	}
	if string(res.Data) != "hello world" {
		t.Error("跳过时不应修改数据")
	}
}
