'use client'

import { useRef, useState, type ChangeEvent } from 'react'
import { Check, Download, MessageCircle, Mic, Paperclip, Phone, Play, Search, Send, Smile, UserRound, Video, Volume2, X } from 'lucide-react'

type Message = { id: string; side: 'incoming' | 'outgoing'; kind?: 'text' | 'voice'; content: string; timestamp: string; quote?: { name: string; text: string } }

const messages: Message[] = [
  { id: '1', side: 'outgoing', content: 'Are sorry bhai me jaldi soo jata hoon', timestamp: '11:12', quote: { name: 'Prathmesh', text: 'Are sorry bhai me jaldi soo jata hoon' } },
  { id: '2', side: 'outgoing', content: 'Ha koi na, me tujhe SIH me meri team me le rha hu', timestamp: '11:12' },
  { id: '3', side: 'outgoing', content: 'Ek din ka kaam rhega for presentation baaki tech wagera hum dekh lenge okay?!', timestamp: '11:15' },
  { id: '4', side: 'incoming', content: 'Kya bolne ke liye', timestamp: '11:44' },
  { id: '5', side: 'incoming', kind: 'voice', content: 'Voice message', timestamp: '11:48' },
  { id: '6', side: 'incoming', content: 'Thik hai sirf bolne ka kaam karoonga aur cross questioning ki tayari karoonga.', timestamp: '11:50' },
  { id: '7', side: 'outgoing', kind: 'voice', content: 'dekh sun i need some member and i want ki wo koi outsider na ho thats why mene tujhse pucha, it wont take your much time, kya kese build kr rhe hai wo tujhe clg me bta denge', timestamp: '12:13', quote: { name: 'Prathmesh', text: '0:40' } },
  { id: '8', side: 'outgoing', content: 'tu me shiv gouri raghav and ek IT ki ladki hai', timestamp: '12:14' },
  { id: '9', side: 'incoming', content: 'hao thik', timestamp: '12:28' },
  { id: '10', side: 'incoming', content: 'agar hoo paya toh jitna tech me ata hai woh bhi contribute kar dunga', timestamp: '12:29' },
  { id: '11', side: 'incoming', content: 'abhi tak kaam kha paho pncha hai', timestamp: '12:29' },
  { id: '12', side: 'outgoing', content: 'Prototype bna lenge kal takk', timestamp: '12:32' },
  { id: '13', side: 'outgoing', content: 'Fitness application bna rhe hai', timestamp: '12:32' },
]

function Avatar() { return <div className="chat-avatar" aria-hidden="true">P</div> }

function Header() { return <header className="chat-header"><div className="header-profile"><Avatar /><div><h1>Prathmesh</h1><p>online</p></div></div><div className="header-actions"><button aria-label="Video call" className="plain-icon"><Video size={25} /></button><button aria-label="Voice call" className="plain-icon"><Phone size={24} /></button><button aria-label="Search chat" className="plain-icon"><Search size={25} /></button><button aria-label="More options" className="plain-icon menu-icon">⋮</button></div></header> }

function NameBar() { const [name, setName] = useState(''); const [saved, setSaved] = useState(false); return <section className="name-bar"><label htmlFor="visitor-name"><UserRound size={20} /><span>Your name</span></label><input id="visitor-name" value={name} onChange={(e) => { setName(e.target.value); setSaved(false) }} placeholder="Enter your name" /><button onClick={() => setSaved(true)}>{saved ? <Check size={17} /> : 'Save'}</button></section> }

function MessageBubble({ message }: { message: Message }) { return <article className={`message-row ${message.side} ${message.kind === 'voice' ? 'voice-row' : ''}`}><div className={`message-bubble ${message.kind === 'voice' ? 'voice-bubble' : ''}`}>{message.quote && <div className="quoted-message"><strong>{message.quote.name}</strong><span>{message.quote.text}</span></div>}{message.kind === 'voice' ? <><div className="voice-controls"><button aria-label="Play voice message" className="play-button"><Play size={16} fill="currentColor" /></button><div className="voice-wave">{Array.from({ length: 30 }).map((_, index) => <i key={index} style={{ height: `${12 + ((index * 17) % 28)}px` }} />)}</div><span className="voice-avatar"><Avatar /></span></div><div className="voice-meta"><span>0:40</span><span>{message.timestamp} ✓✓</span></div>{message.content !== 'Voice message' && <p className="voice-caption">{message.content}</p>}</> : <p>{message.content}</p>}<time>{message.timestamp}{message.side === 'outgoing' ? ' ✓✓' : ''}</time></div>{message.id === '6' && <button className="reaction" aria-label="Thumbs up reaction">👍</button>}</article> }

function Composer() { const [draft, setDraft] = useState(''); const [sent, setSent] = useState<string[]>([]); const [showEmojiPicker, setShowEmojiPicker] = useState(false); const fileInputRef = useRef<HTMLInputElement>(null); const sendMessage = () => { if (draft.trim()) { setSent((items) => [...items, draft.trim()]); setDraft('') } }; const handleFile = (e: ChangeEvent<HTMLInputElement>) => { const file = e.target.files?.[0]; if (file) setDraft((value) => value || `Attached: ${file.name}`) }; return <>{sent.length > 0 && <div className="sent-preview">{sent.map((item, index) => <span key={`${item}-${index}`}>{item}</span>)}</div>}<form className="composer" onSubmit={(e) => { e.preventDefault(); sendMessage() }}><div className="composer-tool-wrap"><button type="button" aria-label="Add emoji" className="composer-icon" onClick={() => setShowEmojiPicker((value) => !value)}><Smile size={22} /> </button>{showEmojiPicker && <div className="emoji-picker"><div className="emoji-picker-header"><span>Choose an emoji</span><button type="button" aria-label="Close emoji picker" onClick={() => setShowEmojiPicker(false)}><X size={14} /></button></div><div className="emoji-grid">{['🙂', '😀', '😂', '😍', '👍', '🙏', '🎉', '❤️', '🔥', '💬', '✅', '🤖'].map((emoji) => <button type="button" key={emoji} onClick={() => { setDraft((value) => `${value}${emoji}`); setShowEmojiPicker(false) }}>{emoji}</button>)}</div></div>}</div><button type="button" aria-label="Attach image or file" className="composer-icon" onClick={() => fileInputRef.current?.click()}><Paperclip size={22} /></button><input ref={fileInputRef} className="file-input" type="file" accept="image/*,.pdf,.doc,.docx,.txt" onChange={handleFile} /><input value={draft} onChange={(e) => setDraft(e.target.value)} placeholder="Type a message" aria-label="Message" /><button type="submit" aria-label="Send message" className={`send-button ${draft.trim() ? 'send-button-visible' : ''}`}><Send size={19} /></button><button type="button" aria-label="Record voice message" className="mic-button"><Mic size={20} /></button></form></> }

export default function ChatInterface() { return <main className="app-shell"><section className="chat-window" aria-label="Chat with Prathmesh"><Header /><NameBar /><div className="chat-content"><div className="messages">{messages.map((message) => <MessageBubble key={message.id} message={message} />)}</div></div><Composer /></section></main> }
