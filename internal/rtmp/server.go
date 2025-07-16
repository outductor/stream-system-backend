package rtmp

import (
	"fmt"
	"io"
	"os"
	"path/filepath"
	"sync"
	"time"

	"github.com/nareix/joy4/format/flv"
	"github.com/nareix/joy4/format/rtmp"
	"github.com/sirupsen/logrus"
)

type Server struct {
	addr         string
	streamKey    string
	outputDir    string
	hlsConverter *HLSConverter
	mu           sync.RWMutex
	activeStream *StreamSession
	logger       *logrus.Logger
}

type StreamSession struct {
	StreamKey string
	StartTime time.Time
	FLVFile   *os.File
	Writer    *flv.Muxer
}

func NewServer(addr, streamKey, outputDir string, logger *logrus.Logger) *Server {
	return &Server{
		addr:         addr,
		streamKey:    streamKey,
		outputDir:    outputDir,
		hlsConverter: NewHLSConverter(outputDir, logger),
		logger:       logger,
	}
}

func (s *Server) Start() error {
	server := &rtmp.Server{
		Addr: s.addr,
		HandlePublish: s.handlePublish,
		HandlePlay:    s.handlePlay,
	}

	s.logger.Infof("RTMP server listening on %s", s.addr)

	go func() {
		if err := server.ListenAndServe(); err != nil {
			s.logger.Errorf("RTMP server error: %v", err)
		}
	}()

	return nil
}

func (s *Server) handlePublish(conn *rtmp.Conn) {
	s.logger.Infof("New publisher connected: %s", conn.URL.Path)

	if conn.URL.Path != "/live/"+s.streamKey {
		s.logger.Warnf("Invalid stream key: %s", conn.URL.Path)
		conn.Close()
		return
	}

	s.mu.Lock()
	if s.activeStream != nil {
		s.mu.Unlock()
		s.logger.Warn("Stream already active, rejecting new connection")
		conn.Close()
		return
	}

	session := &StreamSession{
		StreamKey: s.streamKey,
		StartTime: time.Now(),
	}

	filename := fmt.Sprintf("stream_%s.flv", session.StartTime.Format("20060102_150405"))
	flvPath := filepath.Join(s.outputDir, filename)

	flvFile, err := os.Create(flvPath)
	if err != nil {
		s.mu.Unlock()
		s.logger.Errorf("Failed to create FLV file: %v", err)
		conn.Close()
		return
	}

	session.FLVFile = flvFile
	session.Writer = flv.NewMuxer(flvFile)
	s.activeStream = session
	s.mu.Unlock()

	defer func() {
		s.mu.Lock()
		s.activeStream = nil
		s.mu.Unlock()
		session.FLVFile.Close()
		s.logger.Info("Publisher disconnected")
	}()

	// Get stream metadata
	streams, err := conn.Streams()
	if err != nil {
		s.logger.Errorf("Failed to get streams: %v", err)
		return
	}

	err = session.Writer.WriteHeader(streams)
	if err != nil {
		s.logger.Errorf("Failed to write FLV header: %v", err)
		return
	}

	go s.hlsConverter.StartConversion(flvPath, session.StartTime)

	for {
		packet, err := conn.ReadPacket()
		if err != nil {
			if err == io.EOF {
				break
			}
			s.logger.Errorf("Error reading packet: %v", err)
			break
		}

		err = session.Writer.WritePacket(packet)
		if err != nil {
			s.logger.Errorf("Error writing packet: %v", err)
			break
		}
	}

	err = session.Writer.WriteTrailer()
	if err != nil {
		s.logger.Errorf("Failed to write FLV trailer: %v", err)
	}

	s.hlsConverter.StopConversion()
}

func (s *Server) handlePlay(conn *rtmp.Conn) {
	s.logger.Infof("New player connected: %s", conn.URL.Path)

	s.mu.RLock()
	activeStream := s.activeStream
	s.mu.RUnlock()

	if activeStream == nil {
		s.logger.Warn("No active stream")
		conn.Close()
		return
	}

	conn.Close()
}

func (s *Server) IsLive() bool {
	s.mu.RLock()
	defer s.mu.RUnlock()
	return s.activeStream != nil
}

func (s *Server) GetCurrentStreamInfo() (streamKey string, startTime *time.Time) {
	s.mu.RLock()
	defer s.mu.RUnlock()
	
	if s.activeStream != nil {
		return s.activeStream.StreamKey, &s.activeStream.StartTime
	}
	return "", nil
}