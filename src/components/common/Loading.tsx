import React from 'react'
import './Loading.css'

interface LoadingProps {
  text?: string
  fullScreen?: boolean
}

export const Loading: React.FC<LoadingProps> = ({
  text = '載入中...',
  fullScreen = false,
}) => {
  return (
    <div className={`loading ${fullScreen ? 'loading-fullscreen' : ''}`}>
      <div className="loading-spinner"></div>
      {text && <p className="loading-text">{text}</p>}
    </div>
  )
}
