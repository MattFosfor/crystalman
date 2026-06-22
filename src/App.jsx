import { useState, useEffect, useRef } from 'react'
import { ConvaiClient } from '@convai/web-sdk/core'
import { AudioRenderer } from '@convai/web-sdk/vanilla'
import QRCode from 'qrcode'

const CONFIG = {
  characterId: '070fcc28-16ff-11f1-b1ce-42010a7be02c',
  apiKey: 'e78880220830beff9b127e805ee5ed8c'
}

function QRScreen() {
  const canvasRef = useRef(null)

  useEffect(() => {
    const url = window.location.origin + window.location.pathname + '?start=1'
    if (canvasRef.current) {
      QRCode.toCanvas(canvasRef.current, url, {
        width: 200,
        color: { dark: '#1a1a18', light: '#ffffff' }
      })
    }
  }, [])

  return (
    <div style={styles.screen}>
      <span style={styles.qrLabel}>Scanner pour interagir</span>
      <div style={styles.qrBox}>
        <canvas ref={canvasRef} />
      </div>
      <p style={styles.qrText}>
        Scannez avec votre <strong>smartphone</strong> pour parler à l'avatar
      </p>
    </div>
  )
}

function ConvScreen({ onEnd }) {
  const [talking, setTalking] = useState(false)
  const [status, setStatus] = useState('Connexion...')
  const clientRef = useRef(null)
  const rendererRef = useRef(null)

  useEffect(() => {
    const client = new ConvaiClient({
      characterId: CONFIG.characterId,
      apiKey: CONFIG.apiKey,
      connectionType: 'audio'
    })
    clientRef.current = client

    client.on('stateChange', (state) => {
      if (state.isListening) setStatus("En train d'écouter...")
      else if (state.isThinking) setStatus('Réflexion...')
      else if (state.isSpeaking) setStatus('En train de répondre...')
      else if (state.isConnected) setStatus('Prêt à vous écouter')
    })

    client.connect().then(() => {
  console.log('Connected!')
  
  // Attendre que la room soit vraiment prête
  const checkRoom = setInterval(() => {
    try {
      const renderer = new AudioRenderer(client)
      rendererRef.current = renderer
      console.log('AudioRenderer OK')
      clearInterval(checkRoom)
    } catch(e) {
      console.log('Room pas encore prête, retry...')
    }
  }, 500)

  setStatus('Prêt à vous écouter')
}).catch(err => {
  console.error('Connect error:', err)
  setStatus('Erreur de connexion')
})

    return () => {
      if (clientRef.current) {
        clientRef.current.disconnect()
      }
    }
  }, [])

  const startTalking = async () => {
    if (!talking && clientRef.current) {
      setTalking(true)
      await clientRef.current.audioControls.enableAudio()
    }
  }

  const stopTalking = async () => {
    if (talking && clientRef.current) {
      setTalking(false)
      await clientRef.current.audioControls.disableAudio()
    }
  }

  const handleEnd = async () => {
    if (clientRef.current) {
      clientRef.current.resetSession()
      await clientRef.current.disconnect()
      clientRef.current = null
    }
    onEnd()
  }

  return (
    <div style={styles.screen}>
      <div style={styles.header}>
        <div style={styles.name}>Fosfor</div>
        <div style={styles.status}>{status}</div>
      </div>
      <div style={styles.micWrap}>
        <button
          style={{ ...styles.micBtn, background: talking ? '#ef4444' : '#1a1a18' }}
          onMouseDown={startTalking}
          onMouseUp={stopTalking}
          onMouseLeave={stopTalking}
          onTouchStart={(e) => { e.preventDefault(); startTalking() }}
          onTouchEnd={(e) => { e.preventDefault(); stopTalking() }}
        >
          🎤
        </button>
        <span style={styles.micLabel}>
          {talking ? 'Relâchez pour envoyer' : 'Maintenir pour parler'}
        </span>
      </div>
      <button style={styles.endBtn} onClick={handleEnd}>
        Terminer la conversation
      </button>
    </div>
  )
}

export default function App() {
  const isSmartphone = window.location.search.includes('start=1')
  const [started, setStarted] = useState(false)
  const [ended, setEnded] = useState(false)

  if (!isSmartphone || ended) return <QRScreen />

  if (!started) {
    return (
      <div style={{ ...styles.screen, background: '#fff' }}>
        <button
          style={styles.startBtn}
          onClick={() => setStarted(true)}
        >
          Appuyer pour démarrer
        </button>
      </div>
    )
  }

  return <ConvScreen onEnd={() => setEnded(true)} />
}

const styles = {
  screen: {
    position: 'fixed', inset: 0,
    display: 'flex', flexDirection: 'column',
    alignItems: 'center', justifyContent: 'center',
    gap: '2rem', padding: '2rem',
    fontFamily: 'Inter, sans-serif',
    background: '#f7f7f5'
  },
  qrLabel: {
    fontSize: '0.7rem', fontWeight: 600,
    letterSpacing: '0.15em', textTransform: 'uppercase',
    color: '#9a9a96'
  },
  qrBox: {
    border: '1.5px solid #e8e8e6', borderRadius: '16px',
    padding: '12px', background: '#fff'
  },
  qrText: {
    fontSize: '0.9rem', color: '#9a9a96',
    lineHeight: 1.6, textAlign: 'center', fontWeight: 300
  },
  header: { textAlign: 'center' },
  name: { fontSize: '1.1rem', fontWeight: 500, color: '#1a1a18' },
  status: { fontSize: '0.75rem', color: '#9a9a96', marginTop: '0.3rem', fontWeight: 300 },
  micWrap: {
    display: 'flex', flexDirection: 'column',
    alignItems: 'center', gap: '1rem', flex: 1,
    justifyContent: 'center'
  },
  micBtn: {
    width: '80px', height: '80px', borderRadius: '50%',
    border: 'none', color: '#fff', cursor: 'pointer',
    fontSize: '2rem', touchAction: 'none',
    transition: 'background 0.2s'
  },
  micLabel: { fontSize: '0.72rem', color: '#9a9a96' },
  endBtn: {
    width: '100%', maxWidth: '280px', padding: '0.85rem',
    borderRadius: '10px', border: '1.5px solid #e8e8e6',
    background: 'transparent', color: '#9a9a96',
    fontFamily: 'Inter, sans-serif', fontSize: '0.8rem',
    fontWeight: 500, cursor: 'pointer'
  },
  startBtn: {
    padding: '1.2rem 2rem', borderRadius: '12px',
    border: 'none', background: '#1a1a18', color: '#fff',
    fontSize: '1rem', cursor: 'pointer',
    fontFamily: 'Inter, sans-serif'
  }
}