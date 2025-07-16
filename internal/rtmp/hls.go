package rtmp

import (
	"context"
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
	"time"

	"github.com/sirupsen/logrus"
)

type HLSConverter struct {
	outputDir     string
	segmentTime   int
	playlistSize  int
	logger        *logrus.Logger
	ffmpegCmd     *exec.Cmd
	ctx           context.Context
	cancel        context.CancelFunc
}

func NewHLSConverter(outputDir string, logger *logrus.Logger) *HLSConverter {
	return &HLSConverter{
		outputDir:    outputDir,
		segmentTime:  2,
		playlistSize: 10,
		logger:       logger,
	}
}

func (h *HLSConverter) StartConversion(inputFile string, startTime time.Time) error {
	h.ctx, h.cancel = context.WithCancel(context.Background())

	hlsDir := filepath.Join(h.outputDir, "hls")
	if err := os.MkdirAll(hlsDir, 0755); err != nil {
		return fmt.Errorf("failed to create HLS directory: %w", err)
	}

	playlistPath := filepath.Join(hlsDir, "stream.m3u8")
	segmentPattern := filepath.Join(hlsDir, "segment_%03d.ts")

	args := []string{
		"-re",
		"-i", inputFile,
		"-c:v", "libx264",
		"-preset", "veryfast",
		"-tune", "zerolatency",
		"-c:a", "aac",
		"-b:v", "3000k",
		"-b:a", "128k",
		"-vf", "scale=-2:720",
		"-g", "48",
		"-keyint_min", "48",
		"-sc_threshold", "0",
		"-hls_time", fmt.Sprintf("%d", h.segmentTime),
		"-hls_list_size", fmt.Sprintf("%d", h.playlistSize),
		"-hls_flags", "delete_segments+append_list",
		"-hls_segment_filename", segmentPattern,
		"-f", "hls",
		playlistPath,
	}

	h.ffmpegCmd = exec.CommandContext(h.ctx, "ffmpeg", args...)
	h.ffmpegCmd.Stderr = os.Stderr

	h.logger.Infof("Starting HLS conversion: %s", h.ffmpegCmd.String())

	if err := h.ffmpegCmd.Start(); err != nil {
		return fmt.Errorf("failed to start FFmpeg: %w", err)
	}

	go func() {
		if err := h.ffmpegCmd.Wait(); err != nil {
			if h.ctx.Err() == nil {
				h.logger.Errorf("FFmpeg process ended unexpectedly: %v", err)
			}
		}
	}()

	return nil
}

func (h *HLSConverter) StopConversion() {
	if h.cancel != nil {
		h.cancel()
		h.cancel = nil
	}
	
	if h.ffmpegCmd != nil && h.ffmpegCmd.Process != nil {
		h.ffmpegCmd.Process.Kill()
		h.ffmpegCmd = nil
	}
	
	h.logger.Info("HLS conversion stopped")
}

func (h *HLSConverter) GetPlaylistPath() string {
	return filepath.Join(h.outputDir, "hls", "stream.m3u8")
}

func (h *HLSConverter) CleanupOldSegments() error {
	hlsDir := filepath.Join(h.outputDir, "hls")
	
	files, err := filepath.Glob(filepath.Join(hlsDir, "*.ts"))
	if err != nil {
		return err
	}
	
	cutoff := time.Now().Add(-5 * time.Minute)
	
	for _, file := range files {
		info, err := os.Stat(file)
		if err != nil {
			continue
		}
		
		if info.ModTime().Before(cutoff) {
			os.Remove(file)
		}
	}
	
	return nil
}