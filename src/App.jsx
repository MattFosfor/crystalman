import { useState, useEffect, useRef } from 'react'
import QRCode from 'qrcode'

// Le téléphone n'utilise plus Convai. Il transcrit la voix avec le navigateur
// (Web Speech API) et envoie le TEXTE au serveur. C'est l'avatar dans UE5 qui répond.

const WS_URL = 'wss://tasting-prevent-swizzle.ngrok-free.dev'

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
  const wsRef = useRef(null)
  const recognitionRef = useRef(null)
  const finalRef = useRef('')

  useEffect(() => {
    // 1) Connexion WebSocket vers le serveur Node
    const ws = new WebSocket(WS_URL)
    wsRef.current = ws

    ws.onopen = () => {
      console.log('WebSocket connecté')
      ws.send(JSON.stringify({ type: 'register', role: 'phone' }))
      ws.send(JSON.stringify({ type: 'start' }))
      setStatus('Prêt à vous écouter')
    }
    ws.onerror = (err) => console.error('WebSocket erreur:', err)

    // 2) Reconnaissance vocale du navigateur
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition
    if (!SR) {
      setStatus('Reconnaissance vocale non supportée sur ce navigateur')
    } else {
      const rec = new SR()
      rec.lang = 'fr-FR'
      rec.continuous = true        // on garde l'écoute tant que le bouton est maintenu
      rec.interimResults = true    // affichage en direct pendant qu'on parle

      rec.onresult = (event) => {
        let interim = ''
        let fin = ''
        for (let i = 0; i < event.results.length; i++) {
          const txt = event.results[i][0].transcript
          if (event.results[i].isFinal) fin += txt
          else interim += txt
        }
        finalRef.current = fin
        setStatus(interim || fin || 'En écoute…')
      }

      rec.onerror = (e) => {
        console.error('Speech erreur:', e.error)
        setStatus('Erreur micro : ' + e.error)
        setTalking(false)
      }

      // À la fin de l'écoute (relâchement du bouton) : on envoie le texte à UE5
      rec.onend = () => {
        setTalking(false)
        const text = finalRef.current.trim()
        if (text && wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
          wsRef.current.send(JSON.stringify({ type: 'text', text }))
          console.log('Envoyé à UE5:', text)
          setStatus('Envoyé : ' + text)
        } else {
          setStatus('Prêt à vous écouter')
        }
      }

      recognitionRef.current = rec
    }

    return () => {
      if (recognitionRef.current) { try { recognitionRef.current.abort() } catch (e) {} }
      if (wsRef.current) { wsRef.current.close(); wsRef.current = null }
    }
  }, [])

  const startTalking = () => {
    if (talking || !recognitionRef.current) return
    finalRef.current = ''
    try {
      recognitionRef.current.start()
      setTalking(true)
      setStatus('En écoute…')
    } catch (e) {
      console.error('start err:', e)
    }
  }

  const stopTalking = () => {
    if (!talking || !recognitionRef.current) return
    try { recognitionRef.current.stop() } catch (e) {}
    // onend se déclenche et envoie le texte
  }

  const handleEnd = () => {
    if (recognitionRef.current) { try { recognitionRef.current.abort() } catch (e) {} }
    if (wsRef.current) {
      if (wsRef.current.readyState === WebSocket.OPEN) {
        wsRef.current.send(JSON.stringify({ type: 'end' }))
      }
      wsRef.current.close()
      wsRef.current = null
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
