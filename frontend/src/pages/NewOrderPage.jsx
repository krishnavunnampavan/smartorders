import { useState } from 'react'
import { Mic, Camera, PenLine } from 'lucide-react'
import Layout from '../components/layout/Layout'
import VoiceInput from '../components/orders/VoiceInput'
import PhotoInput from '../components/orders/PhotoInput'
import ManualEntry from '../components/orders/ManualEntry'

const TABS = [
  { id: 'voice', label: 'Voice', icon: Mic },
  { id: 'photo', label: 'Photo', icon: Camera },
  { id: 'manual', label: 'Manual', icon: PenLine },
]

export default function NewOrderPage() {
  const [tab, setTab] = useState('voice')

  return (
    <Layout title="New Order">
      <div className="max-w-2xl mx-auto">
        <div className="glass-card p-4">
          {/* Tab bar */}
          <div className="flex gap-1 mb-5 p-1 rounded-lg bg-[#0d1117]">
            {TABS.map(({ id, label, icon: Icon }) => (
              <button key={id} onClick={() => setTab(id)}
                className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-md text-sm font-medium transition-colors ${
                  tab === id ? 'bg-[#58a6ff]/20 text-[#58a6ff]' : 'text-[#8b949e]'
                }`}>
                <Icon size={15} /> {label}
              </button>
            ))}
          </div>
          {tab === 'voice' && <VoiceInput />}
          {tab === 'photo' && <PhotoInput />}
          {tab === 'manual' && <ManualEntry />}
        </div>

        <p className="text-center text-[#8b949e] text-xs mt-4">
          Items you add appear in the cart button (bottom-right). Tap it to review and finalize.
        </p>
      </div>
    </Layout>
  )
}
