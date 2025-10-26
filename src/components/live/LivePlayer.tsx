import React, { useEffect, useRef, useState } from 'react'
import { Button } from '@/components/common'
import { createViewerService, ivsStatsService, type IVSStatsUpdate } from '@/services/awsIvs'
import { useUserStore } from '@/stores/useUserStore'
import { toast } from '@/stores/useToastStore'
import { isDevelopment } from '@/config'
import './LivePlayer.css'

interface StreamConfig {
  host?: string
  app?: string
  stream?: string
  mode?: 'ovenplayer' | 'ivs' // New: support both modes
}

type PlayerMode = 'ovenplayer' | 'ivs'

export const LivePlayer: React.FC = () => {
  const playerRef = useRef<HTMLDivElement>(null)
  const [playerInstance, setPlayerInstance] = useState<any>(null)
  const [isPlaying, setIsPlaying] = useState(false)
  const [streamConfig, setStreamConfig] = useState<StreamConfig>({})
  const [playerMode, setPlayerMode] = useState<PlayerMode>('ivs') // Default to AWS IVS
  const [viewerStats, setViewerStats] = useState<IVSStatsUpdate | null>(null)
  const [ivsStage, setIvsStage] = useState<any>(null) // IVS Stage instance
  const viewerServiceRef = useRef<ReturnType<typeof createViewerService> | null>(null)

  const { user } = useUserStore()

  useEffect(() => {
    // Parse stream config from URL parameters
    const urlParams = new URLSearchParams(window.location.search)
    const config: StreamConfig = {
      host: urlParams.get('host') || undefined,
      app: urlParams.get('app') || undefined,
      stream: urlParams.get('stream') || urlParams.get('cam') || undefined,
      mode: (urlParams.get('mode') as PlayerMode) || undefined,
    }

    // Determine player mode
    if (config.mode) {
      setPlayerMode(config.mode)
    } else if (config.host && config.stream) {
      // Legacy mode - use OvenPlayer
      setPlayerMode('ovenplayer')
    } else {
      // Default mode - use AWS IVS
      setPlayerMode('ivs')
    }

    setStreamConfig(config)
  }, [])

  // ==================== AWS IVS Mode ====================

  const initIVSViewer = async () => {
    if (!user) {
      toast.error('請先登入')
      return
    }

    try {
      // Check if AWS IVS SDK is loaded
      if (typeof (window as any).IVSBroadcastClient === 'undefined') {
        // Try to load the SDK
        await loadIVSSDK()
      }

      // Create viewer service
      if (!viewerServiceRef.current) {
        viewerServiceRef.current = createViewerService(user.userId)
      }

      // Join as viewer
      toast.info('正在加入直播...')
      const tokenResponse = await viewerServiceRef.current.join()

      if (isDevelopment) {
        console.log('✅ IVS Token response:', tokenResponse)
        console.log('Token value:', tokenResponse.token)
        console.log('Token type:', typeof tokenResponse.token)
      }

      // Validate token
      if (!tokenResponse.token || typeof tokenResponse.token !== 'string') {
        throw new Error('Invalid token received from server')
      }

      // Create IVS Stage
      const { Stage, StageEvents, SubscribeType } = (window as any).IVSBroadcastClient

      // For viewers, we need to provide a strategy to subscribe to publisher's streams
      const stage = new Stage(tokenResponse.token, {
        stageStrategy: {
          participantId: tokenResponse.participantId,
          shouldSubscribeToParticipant: (participant: any) => {
            // Subscribe to all participants (mainly the publisher)
            if (isDevelopment) {
              console.log('👤 Participant joined, subscribing:', participant.userId)
            }
            return SubscribeType.AUDIO_VIDEO
          }
        }
      })

      // Handle stage events
      stage.on(StageEvents.STAGE_CONNECTION_STATE_CHANGED, (state: string) => {
        if (isDevelopment) {
          console.log('📡 Stage connection state:', state)
        }
        if (state === 'CONNECTED') {
          setIsPlaying(true)
          toast.success('已連接直播')
        } else if (state === 'DISCONNECTED') {
          setIsPlaying(false)
        }
      })

      stage.on(StageEvents.STAGE_PARTICIPANT_STREAMS_ADDED, (participant: any, streams: any[]) => {
        if (isDevelopment) {
          console.log('👤 Participant streams added:', participant.userId, streams.length)
        }

        // Display publisher video/audio
        streams.forEach((stream) => {
          if (stream.streamType === 'VIDEO' && playerRef.current) {
            const mediaStream = new MediaStream([stream.mediaStreamTrack])

            // Create or update video element
            let videoElement = playerRef.current.querySelector('video') as HTMLVideoElement
            if (!videoElement) {
              videoElement = document.createElement('video')
              videoElement.autoplay = true
              videoElement.playsInline = true
              videoElement.controls = true
              videoElement.className = 'ivs-video'
              playerRef.current.appendChild(videoElement)
            }

            videoElement.srcObject = mediaStream
            videoElement.play().catch(err => {
              console.error('Failed to play video:', err)
              toast.warning('請點擊播放按鈕以開始觀看')
            })
          }
        })
      })

      stage.on(StageEvents.STAGE_PARTICIPANT_STREAMS_REMOVED, (participant: any) => {
        if (isDevelopment) {
          console.log('👤 Participant streams removed:', participant.userId)
        }
        toast.info('主播已離線')
      })

      // Join the stage
      await stage.join()
      setIvsStage(stage)

    } catch (error) {
      console.error('❌ Failed to join IVS stream:', error)
      toast.error('無法加入直播，請稍後再試')
    }
  }

  const cleanupIVS = async () => {
    try {
      // Leave the stage
      if (ivsStage) {
        await ivsStage.leave()
        setIvsStage(null)
      }

      // Cleanup viewer service
      if (viewerServiceRef.current) {
        await viewerServiceRef.current.leave()
        viewerServiceRef.current = null
      }

      // Clear video element
      if (playerRef.current) {
        const videoElement = playerRef.current.querySelector('video')
        if (videoElement) {
          videoElement.srcObject = null
          videoElement.remove()
        }
      }

      setIsPlaying(false)
    } catch (error) {
      console.error('❌ Failed to cleanup IVS:', error)
    }
  }

  const loadIVSSDK = (): Promise<void> => {
    return new Promise((resolve, reject) => {
      if (typeof (window as any).IVSBroadcastClient !== 'undefined') {
        resolve()
        return
      }

      const script = document.createElement('script')
      script.src = 'https://web-broadcast.live-video.net/1.6.0/amazon-ivs-web-broadcast.js'
      script.async = true
      script.onload = () => resolve()
      script.onerror = () => reject(new Error('Failed to load IVS SDK'))
      document.body.appendChild(script)
    })
  }

  // ==================== OvenPlayer Mode (Legacy) ====================

  const initOvenPlayer = () => {
    if (!playerRef.current) return
    if (!streamConfig.host || !streamConfig.stream) {
      console.warn('Missing stream configuration')
      return
    }

    // Check if OvenPlayer is available
    if (typeof (window as any).OvenPlayer === 'undefined') {
      console.error('OvenPlayer not loaded')
      return
    }

    const streamUrl = `wss://${streamConfig.host}/${streamConfig.app || 'app'}/${streamConfig.stream}`

    try {
      const player = (window as any).OvenPlayer.create(playerRef.current, {
        sources: [
          {
            type: 'webrtc',
            file: streamUrl,
          },
        ],
        autoStart: true,
        mute: true,
        controls: true,
      })

      player.on('ready', () => {
        setIsPlaying(true)
      })

      player.on('error', (error: any) => {
        console.error('Player error:', error)
        setIsPlaying(false)
      })

      setPlayerInstance(player)
    } catch (error) {
      console.error('Failed to initialize player:', error)
    }
  }

  const cleanupOvenPlayer = () => {
    if (playerInstance) {
      playerInstance.remove()
      setPlayerInstance(null)
      setIsPlaying(false)
    }
  }

  const loadOvenPlayerSDK = (): Promise<void> => {
    return new Promise((resolve, reject) => {
      if (typeof (window as any).OvenPlayer !== 'undefined') {
        resolve()
        return
      }

      const script = document.createElement('script')
      script.src = 'https://cdn.jsdelivr.net/npm/ovenplayer/dist/ovenplayer.min.js'
      script.async = true
      script.onload = () => resolve()
      script.onerror = () => reject(new Error('Failed to load OvenPlayer'))
      document.body.appendChild(script)
    })
  }

  // ==================== Common Handlers ====================

  const handlePlay = async () => {
    if (playerMode === 'ivs') {
      if (ivsStage && isPlaying) {
        toast.info('已在播放中')
        return
      }
      await initIVSViewer()
    } else {
      if (playerInstance) {
        playerInstance.play()
        setIsPlaying(true)
      } else {
        initOvenPlayer()
      }
    }
  }

  const handleRefresh = async () => {
    if (playerMode === 'ivs') {
      await cleanupIVS()
      setTimeout(() => initIVSViewer(), 500)
    } else {
      cleanupOvenPlayer()
      setTimeout(initOvenPlayer, 100)
    }
  }

  // ==================== Effects ====================

  // Initialize player based on mode
  useEffect(() => {
    if (playerMode === 'ivs') {
      // Auto-join IVS stream if user is authenticated
      if (user) {
        loadIVSSDK()
          .then(() => {
            // Auto-start after a short delay
            setTimeout(() => initIVSViewer(), 1000)
          })
          .catch(err => {
            console.error('Failed to load IVS SDK:', err)
            toast.error('無法載入直播 SDK')
          })
      }

      // Cleanup on unmount
      return () => {
        cleanupIVS()
      }
    } else if (playerMode === 'ovenplayer') {
      // Load OvenPlayer for legacy mode
      if (streamConfig.host && streamConfig.stream) {
        loadOvenPlayerSDK()
          .then(() => {
            setTimeout(initOvenPlayer, 500)
          })
          .catch(err => {
            console.error('Failed to load OvenPlayer:', err)
          })

        return () => {
          cleanupOvenPlayer()
        }
      }
    }
  }, [playerMode, streamConfig, user])

  // Subscribe to stats updates
  useEffect(() => {
    ivsStatsService.onStatsUpdate((stats) => {
      setViewerStats(stats)
    })

    return () => {
      ivsStatsService.clearCallback()
    }
  }, [])

  // ==================== Render ====================

  const renderIVSPlayer = () => (
    <>
      <div ref={playerRef} className="player-element ivs-player">
        {!isPlaying && (
          <div className="player-placeholder">
            <div className="placeholder-icon">📺</div>
            <p>點擊下方按鈕開始觀看直播</p>
          </div>
        )}
      </div>
      <div className="player-controls">
        <Button variant="primary" onClick={handlePlay} disabled={isPlaying}>
          {isPlaying ? '播放中' : '開始觀看'}
        </Button>
        <Button variant="secondary" onClick={handleRefresh} disabled={!isPlaying}>
          重新載入
        </Button>
      </div>
      {viewerStats && (
        <div className="viewer-stats">
          <div className="stat-item">
            <span className="stat-icon">👥</span>
            <span className="stat-value">{viewerStats.totalViewers}</span>
            <span className="stat-label">觀眾</span>
          </div>
          <div className="stat-item">
            <span className="stat-icon">📡</span>
            <span className={`stat-badge ${viewerStats.isPublisherLive ? 'live' : 'offline'}`}>
              {viewerStats.isPublisherLive ? '直播中' : '離線'}
            </span>
          </div>
        </div>
      )}
    </>
  )

  const renderOvenPlayer = () => (
    <>
      {streamConfig.host && streamConfig.stream ? (
        <>
          <div ref={playerRef} className="player-element" />
          <div className="player-controls">
            <Button variant="primary" onClick={handlePlay} disabled={isPlaying}>
              {isPlaying ? '播放中' : '開始播放'}
            </Button>
            <Button variant="secondary" onClick={handleRefresh}>
              重新載入
            </Button>
          </div>
          <div className="stream-info">
            <h4>串流資訊</h4>
            <div className="info-grid">
              <div className="info-item">
                <span className="info-label">主機:</span>
                <span className="info-value">{streamConfig.host}</span>
              </div>
              <div className="info-item">
                <span className="info-label">應用:</span>
                <span className="info-value">{streamConfig.app || 'app'}</span>
              </div>
              <div className="info-item">
                <span className="info-label">串流:</span>
                <span className="info-value">{streamConfig.stream}</span>
              </div>
            </div>
          </div>
        </>
      ) : (
        <div className="no-stream">
          <div className="no-stream-icon">📺</div>
          <p>暫無直播串流</p>
          <p className="hint">請在 URL 中提供直播參數</p>
        </div>
      )}
    </>
  )

  return (
    <div className="live-player">
      <div className="player-mode-indicator">
        <span className="mode-label">模式:</span>
        <span className="mode-value">
          {playerMode === 'ivs' ? 'AWS IVS' : 'OvenPlayer'}
        </span>
      </div>
      <div className="player-container">
        {playerMode === 'ivs' ? renderIVSPlayer() : renderOvenPlayer()}
      </div>
    </div>
  )
}
