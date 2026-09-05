'use client'

import { useState } from 'react'
import { Check, Download, MessageCircle, Mic, Paperclip, Phone, Play, Smile, UserRound, Volume2 } from 'lucide-react'

const messages = [
  { id: 'links', type: 'text', content: (<div className="space-y-5"><a href="https://777.us" className="chat-link">https://777.us</a><a href="https://Cricxbet99.xyz" className="chat-link">https://Cricxbet99.xyz</a><a href="https://9wicket.com" className="chat-link">https://9wicket.com</a><a href="https://gold.365.run" className="chat-link">https://gold.365.run</a><p className="pt-1">(FOR DEMO Id - Just click on LOGIN WITH DEMO on our sites)<span aria-hidden="true">👍</span></p><p>♆ Profit Online HUB ♆<br />╰┈➤ 🙏 <strong>HAPPY GAMING</strong> 🙏 ╰┈➤</p><p>🚦FAST WITHDRAWALWITH IN 10 MINUTES 🚦</p></div>), timestamp: '12:03' },
  { id: 'welcome', type: 'text', content: (<div className="space-y-5"><p><span aria-hidden="true">💬</span> You can chat here or click the WhatsApp button above to connect directly.</p><p lang="hi">आप यहाँ चैट कर सकते हैं या ऊपर दिए WhatsApp button पर क्लिक करके सीधे जुड़ सकते हैं।</p><a href="https://bio.wa.link/profit" className="chat-link">https://bio.wa.link/profit</a></div>), timestamp: '12:03' },
  { id: 'voice', type: 'voice', content: 'Hello sir, Me apki kya help kr skti hu?', timestamp: '12:03' },
] as const

function Avatar({ small = false }: { small?: boolean }) {
  return <div className={`profile-avatar ${small ? 'profile-avatar-small' : ''}`} aria-label="Profit Online Hub avatar"><span>Profit</span><strong>ONLINE</strong><small>HUB</small></div>
}

function Header() {
  return <header className="chat-header"><div className="header-profile"><div className="avatar-wrap"><Avatar /><span className="online-dot" /></div><div><h1>Profit Online Hub</h1><p>Online</p></div></div><div className="header-actions"><button aria-label="Call Profit Online Hub" className="icon-button header-call"><Phone size={22} /></button><button aria-label="Open WhatsApp" className="icon-button whatsapp-button"><MessageCircle size={25} /></button><button className="save-chat-button"><Download size={22} /><span>Save Chat</span></button></div></header>
}

function NameBar() {
  const [name, setName] = useState('')
  const [saved, setSaved] = useState(false)
  return <section className="name-bar"><label htmlFor="visitor-name"><UserRound size={24} /><span>Your name</span></label><input id="visitor-name" value={name} onChange={(event) => { setName(event.target.value); setSaved(false) }} placeholder="Enter your name" /><button onClick={() => setSaved(true)}>{saved ? <Check size={19} /> : 'Save'}</button></section>
}

function MessageBubble({ message }: { message: (typeof messages)[number] }) {
  return <article className={`message-row ${message.type === 'voice' ? 'voice-row' : ''}`}><Avatar small /><div className={`message-bubble ${message.type === 'voice' ? 'voice-bubble' : ''}`}><div className="sender-name">Profit Online Hub</div>{message.type === 'voice' ? <><div className="voice-controls"><button aria-label="Play voice message" className="play-button"><Play size={21} fill="currentColor" /></button><div className="voice-track"><span /></div><Volume2 size={17} className="volume-icon" /></div><div className="voice-meta"><span>0:00</span><span>1x</span></div><p className="voice-caption">{message.content}</p></> : message.content}<time>{message.timestamp}</time></div></article>
}

function Composer() {
  const [draft, setDraft] = useState('')
  const [sent, setSent] = useState<string[]>([])
  const sendMessage = () => { if (draft.trim()) { setSent((items) => [...items, draft.trim()]); setDraft('') } }
  return <><div className="quick-replies" aria-label="Quick replies"><button onClick={() => setDraft('I Need ID.')}>🤖 🆔 I Need ID.</button><button onClick={() => setDraft('I Need Support')}>🤖 💬 I Need Support</button></div>{sent.length > 0 && <div className="sent-preview">{sent.map((item, index) => <span key={`${item}-${index}`}>{item}</span>)}</div>}<form className="composer" onSubmit={(event) => { event.preventDefault(); sendMessage() }}><button type="button" aria-label="Add emoji" className="composer-icon"><Smile size={26} /></button><button type="button" aria-label="Attach file" className="composer-icon"><Paperclip size={25} /></button><input value={draft} onChange={(event) => setDraft(event.target.value)} placeholder="Type a message..." aria-label="Message" /><button type="button" aria-label="Record voice message" className="mic-button"><Mic size={24} /></button></form></>
}

export default function ChatInterface() {
  return <main className="app-shell"><section className="chat-window" aria-label="Chat with Profit Online Hub"><Header /><NameBar /><div className="chat-content"><div className="messages">{messages.map((message) => <MessageBubble key={message.id} message={message} />)}</div></div><Composer /></section></main>
}
