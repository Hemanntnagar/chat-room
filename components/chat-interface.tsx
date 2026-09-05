'use client'

import { useState } from 'react'
import { Archive, ChevronDown, CircleEllipsis, Image as ImageIcon, MessageSquarePlus, Mic, MoreVertical, Paperclip, Phone, Pin, Search, Send, Smile, Users, Video, X } from 'lucide-react'

const chats = [
  ['Kapil Jiju', 'Photo', 'Yesterday', 'car'],
  ['Someone (You)', '/23EOoeqtMIU8w+SKSghCmZ1ohBuqn1Gi9vEi3GONa...', 'Yesterday', 'sunset'],
  ['Prathmesh', 'tu me shiv gouri raghav and ek IT ki ladki hai', '12:14', 'person'],
  ['GG', 'okay', '11:29', 'letter'],
  ['GSoC 27', 'You: postponed shaam ko', '11:25', 'group'],
  ['CSE B', 'Rishabh: due to network issue class is postponed to evening', '11:25', 'crowd'],
  ['Rishabh Jain', 'Voice call', '11:24', 'lake'],
]

function Avatar({ variant = 'sunset', small = false }: { variant?: string; small?: boolean }) {
  return <div className={`wa-avatar ${small ? 'wa-avatar-small' : ''} avatar-${variant}`}>{variant === 'letter' ? 'G' : variant === 'sunset' ? '◒' : variant === 'group' ? '◉' : ''}</div>
}

function LeftRail() {
  return <nav className="left-rail" aria-label="WhatsApp navigation"><button className="rail-button active" aria-label="Chats"><MessageSquarePlus size={25} /><span>11</span></button><button className="rail-button" aria-label="Calls"><Phone size={25} /></button><button className="rail-button" aria-label="Status"><CircleEllipsis size={29} /></button><button className="rail-button" aria-label="Communities"><Users size={25} /></button><div className="rail-spacer" /><button className="rail-button" aria-label="Gallery"><ImageIcon size={24} /></button><Avatar variant="sunset" small /></nav>
}

function ChatSidebar({ selected, setSelected }: { selected: number; setSelected: (value: number) => void }) {
  return <aside className="chat-sidebar"><div className="sidebar-heading"><h1>WhatsApp</h1><div className="sidebar-actions"><button aria-label="More options"><MoreVertical size={23} /></button><button aria-label="New chat" className="new-chat"><MessageSquarePlus size={20} /></button></div></div><div className="search-box"><Search size={20} /><input placeholder="Search or start a new chat" aria-label="Search chats" /></div><div className="filters"><button className="selected">All</button><button>Unread 11</button><button>Favourites</button><button>Groups 5</button><button aria-label="Add filter">+</button></div><div className="archived"><Archive size={22} /><span>Archived</span><small>3</small></div><div className="chat-list">{chats.map(([name, preview, time, variant], index) => <button key={name} className={`chat-list-item ${selected === index ? 'selected-chat' : ''}`} onClick={() => setSelected(index)}><Avatar variant={variant} /><div className="chat-list-copy"><div><strong>{name}</strong><time>{time}</time></div><p>{index < 2 && <span className="double-check">✓✓ </span>}{preview}</p></div>{index === 1 && <Pin size={18} className="pin" />}</button>)}</div><div className="mac-banner"><span className="wa-mark">◔</span>Get WhatsApp for Mac</div></aside>
}

function ConversationHeader() {
  return <><header className="conversation-header"><Avatar variant="sunset" /><div className="conversation-title"><strong>Someone (You)</strong><span>Message yourself</span></div><div className="conversation-actions"><button aria-label="Search"><Search size={26} /></button><button aria-label="More options"><MoreVertical size={26} /></button></div></header><div className="media-strip"><Pin size={22} /><ImageIcon size={22} /><span>Photo</span><div className="media-preview" /></div></>
}

function Messages() {
  return <div className="wa-messages"><div className="outgoing large-link"><strong>theglobalscholarship.org</strong><p>https://theglobalscholarship.org/scholarships/dreambuild-scholarship-2026?source=main</p><a href="#">https://theglobalscholarship.org/scholarships/dreambuild-scholarship-2026?source=main</a><time>22:29 ✓✓</time></div><div className="date-chip">22/8/2026</div><div className="outgoing short-message">Nikku di 22k <time>14:21 ✓✓</time></div><div className="outgoing image-message"><div className="id-card"><span>DE25143</span><b>Student Identity Card</b><i>PHOTO</i></div><time>19:58 ✓✓</time></div><div className="date-chip">Wednesday</div><div className="system-chip">You pinned a message</div><div className="date-chip">Yesterday</div><div className="outgoing token">/23EOoeqtMIU8w+SKSghCmZ1ohBuqn1Gi9vEi3GONa= <time>15:53 ✓✓</time></div></div>
}

function Composer() {
  const [draft, setDraft] = useState('')
  const send = () => setDraft('')
  return <form className="wa-composer" onSubmit={(e) => { e.preventDefault(); send() }}><button type="button" aria-label="Attach"><Paperclip size={25} /></button><button type="button" aria-label="Emoji"><Smile size={25} /></button><input value={draft} onChange={(e) => setDraft(e.target.value)} placeholder="Type a message" aria-label="Type a message" />{draft ? <button type="submit" aria-label="Send"><Send size={23} /></button> : <button type="button" aria-label="Record voice"><Mic size={23} /></button>}</form>
}

export default function ChatInterface() {
  const [selected, setSelected] = useState(1)
  return <main className="wa-app"><LeftRail /><ChatSidebar selected={selected} setSelected={setSelected} /><section className="conversation"><ConversationHeader /><Messages /><Composer /></section></main>
}
