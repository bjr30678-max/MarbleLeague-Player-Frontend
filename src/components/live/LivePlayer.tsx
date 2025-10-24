import React, { useEffect, useRef, useState } from 'react'
import { Button } from '@/components/common'
import './LivePlayer.css'

interface StreamConfig {
  host?: string
  app?: string
  stream?: string
}

export const LivePlayer: React.FC = () => {
  const playerRef = useRef<HTMLDivElement>(null)
  const [playerInstance, setPlayerInstance] = useState<any>(null)
  const [isPlaying, setIsPlaying] = useState(false)
  const [streamConfig, setStreamConfig] = useState<StreamConfig>({})

  useEffect(() => {
    // Parse stream config from URL parameters
    const urlParams = new URLSearchParams(window.location.search)
    const config: StreamConfig = {
      host: urlParams.get('host') || undefined,
      app: urlParams.get('app') || undefined,
      stream: urlParams.get('stream') || urlParams.get('cam') || undefined,
    }
    setStreamConfig(config)
  }, [])

  const initPlayer = () => {
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

  const handlePlay = () => {
    if (playerInstance) {
      playerInstance.play()
      setIsPlaying(true)
    } else {
      initPlayer()
    }
  }

  const handleRefresh = () => {
    if (playerInstance) {
      playerInstance.remove()
      setPlayerInstance(null)
      setIsPlaying(false)
    }
    setTimeout(initPlayer, 100)
  }

  useEffect(() => {
    // Load OvenPlayer script if stream config is available
    if (streamConfig.host && streamConfig.stream) {
      const script = document.createElement('script')
      script.src = 'https://cdn.jsdelivr.net/npm/ovenplayer/dist/ovenplayer.min.js'
      script.async = true
      script.onload = () => {
        // Auto-initialize after script loads
        setTimeout(initPlayer, 500)
      }
      document.body.appendChild(script)

      return () => {
        if (playerInstance) {
          playerInstance.remove()
        }
      }
    }
  }, [streamConfig])

  return (
    <div className="live-player">
      <div className="player-container">
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
          </>
        ) : (
          <div className="no-stream">
            <div className="no-stream-icon">📺</div>
            <p>暫無直播串流</p>
            <p className="hint">請在 URL 中提供直播參數</p>
          </div>
        )}
      </div>

      {streamConfig.host && (
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
      )}
    </div>
  )
}
