import { useState } from 'react'
import { useParams, Link, useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  ArrowLeft, CheckSquare, Square, Pencil, Save, X, StickyNote,
  Trash2, Building2, RotateCcw, Download, Link2, AlertTriangle,
  CheckCircle, Clock, ChevronDown, ChevronUp, FileText,
} from 'lucide-react'
import toast from 'react-hot-toast'
import Layout from '../components/layout/Layout'
import LoadingSpinner from '../components/shared/LoadingSpinner'
import PriceTagBadge from '../components/shared/PriceTagBadge'
import client from '../api/client'
import { formatCurrency } from '../utils/formatters'

const SIZE_OPTIONS = ['50ml', '100ml', '200ml', '375ml', '500ml', '750ml', '1L', '1.5L', '1.75L']
const UNIT_OPTIONS = ['Bottle', 'Half Case', 'Case', 'Mixed Case', 'Single', '3 Pack', '4 Pack', '6 Pack', '12 Pack', '24 Pack', '30 Pack']

// ── Per-item row ────────────────────────────────────────────────────────────
function ItemRow({ item, orderId, companies, onRefresh }) {
  const [editing, setEditing] = useState(false)
  const [editData, setEditData] = useState({
    item_name_override: item.item_name_override || '',
    selected_size: item.selected_size || '750ml',
    selected_unit: item.selected_unit || 'Case',
    quantity: item.quantity,
    company_id: item.company_id || '',
  })
  const [editingNote, setEditingNote] = useState(false)
  const [noteDraft, setNoteDraft] = useState(item.item_note || '')

  const updateMutation = useMutation({
    mutationFn: (data) => client.put(`/orders/${orderId}/items/${item.id}`, data),
    onSuccess: () => { onRefresh(); setEditing(false); setEditingNote(false) },
    onError: () => toast.error('Failed to update item'),
  })

  const deleteMutation = useMutation({
    mutationFn: () => client.delete(`/orders/${orderId}/items/${item.id}`),
    onSuccess: () => { onRefresh(); toast.success('Item removed') },
    onError: () => toast.error('Failed to delete item'),
  })

  const toggleStruck = () => {
    updateMutation.mutate({ is_struck: !item.is_struck })
    toast.success(item.is_struck ? 'Item unmarked' : 'Item marked as ordered')
  }

  const saveEdit = () => {
    const payload = {
      quantity: Number(editData.quantity),
      selected_size: editData.selected_size,
      selected_unit: editData.selected_unit,
      item_name_override: editData.item_name_override || null,
      company_id: editData.company_id || null,
    }
    updateMutation.mutate(payload)
    toast.success('Item updated')
  }

  const saveNote = () => {
    updateMutation.mutate({ item_note: noteDraft })
    toast.success('Note saved')
  }

  const displayName = item.item_name_override || item.product_name

  return (
    <>
      <tr className={`border-b border-[rgba(48,54,61,0.5)] transition-all ${item.is_struck ? 'opacity-50' : 'hover:bg-[rgba(48,54,61,0.15)]'}`}>
        {/* Strike toggle */}
        <td className="p-3 w-10">
          <button
            onClick={toggleStruck}
            disabled={updateMutation.isPending}
            className={`transition-colors ${item.is_struck ? 'text-green-400' : 'text-[#8b949e] hover:text-green-400'}`}
            title={item.is_struck ? 'Unmark as ordered' : 'Mark as ordered to salesman'}
          >
            {item.is_struck ? <CheckSquare size={18} /> : <Square size={18} />}
          </button>
        </td>

        {/* Name */}
        <td className="p-3">
          {editing ? (
            <input
              className="w-full bg-[#0d1117] border border-[rgba(88,166,255,0.4)] rounded px-2 py-1 text-sm text-[#e6edf3] focus:outline-none focus:border-[#58a6ff]"
              value={editData.item_name_override}
              onChange={(e) => setEditData((d) => ({ ...d, item_name_override: e.target.value }))}
              placeholder={item.product_name}
            />
          ) : (
            <div>
              <span className={`text-sm text-[#e6edf3] ${item.is_struck ? 'line-through' : ''}`}>
                {displayName}
              </span>
              {item.item_name_override && (
                <span className="ml-1 text-[10px] text-yellow-500 bg-yellow-500/10 px-1 rounded">renamed</span>
              )}
            </div>
          )}
        </td>

        {/* Size */}
        <td className="p-3 w-28">
          {editing ? (
            <select
              className="w-full bg-[#0d1117] border border-[rgba(88,166,255,0.4)] rounded px-2 py-1 text-sm text-[#e6edf3] focus:outline-none"
              value={editData.selected_size}
              onChange={(e) => setEditData((d) => ({ ...d, selected_size: e.target.value }))}
            >
              {SIZE_OPTIONS.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          ) : (
            <span className={`text-sm text-[#8b949e] ${item.is_struck ? 'line-through' : ''}`}>
              {item.selected_size}
            </span>
          )}
        </td>

        {/* Unit */}
        <td className="p-3 w-28">
          {editing ? (
            <select
              className="w-full bg-[#0d1117] border border-[rgba(88,166,255,0.4)] rounded px-2 py-1 text-sm text-[#e6edf3] focus:outline-none"
              value={editData.selected_unit}
              onChange={(e) => setEditData((d) => ({ ...d, selected_unit: e.target.value }))}
            >
              {UNIT_OPTIONS.map((u) => <option key={u} value={u}>{u}</option>)}
            </select>
          ) : (
            <span className={`text-sm text-[#8b949e] ${item.is_struck ? 'line-through' : ''}`}>
              {item.selected_unit}
            </span>
          )}
        </td>

        {/* Qty */}
        <td className="p-3 w-20 text-center">
          {editing ? (
            <input
              type="number"
              min="1"
              className="w-16 text-center bg-[#0d1117] border border-[rgba(88,166,255,0.4)] rounded px-2 py-1 text-sm text-[#e6edf3] focus:outline-none"
              value={editData.quantity}
              onChange={(e) => setEditData((d) => ({ ...d, quantity: e.target.value }))}
            />
          ) : (
            <span className={`text-sm font-medium text-[#e6edf3] ${item.is_struck ? 'line-through' : ''}`}>
              ×{item.quantity}
            </span>
          )}
        </td>

        {/* Distributor */}
        <td className="p-3 w-40">
          {editing ? (
            <select
              className="w-full bg-[#0d1117] border border-[rgba(88,166,255,0.4)] rounded px-2 py-1 text-sm text-[#e6edf3] focus:outline-none"
              value={editData.company_id}
              onChange={(e) => setEditData((d) => ({ ...d, company_id: e.target.value }))}
            >
              <option value="">— Unassigned —</option>
              {companies?.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          ) : (
            <div className="flex items-center gap-1.5">
              <Building2 size={12} className="text-[#8b949e] shrink-0" />
              <span className={`text-xs text-[#8b949e] truncate ${item.is_struck ? 'line-through' : ''}`}>
                {item.company_name || '—'}
              </span>
            </div>
          )}
        </td>

        {/* Price */}
        <td className="p-3 w-28 text-right">
          <div className="flex items-center justify-end gap-1.5">
            {item.price_status && <PriceTagBadge status={item.price_status} />}
            <span className={`text-sm font-mono text-[#e6edf3] ${item.is_struck ? 'line-through' : ''}`}>
              {formatCurrency(item.line_total)}
            </span>
          </div>
        </td>

        {/* Note */}
        <td className="p-3 w-10 text-center">
          <button
            onClick={() => { setEditingNote(!editingNote); setNoteDraft(item.item_note || '') }}
            title={item.item_note || 'Add note'}
            className={`transition-colors ${item.item_note ? 'text-yellow-400' : 'text-[#8b949e] hover:text-yellow-400'}`}
          >
            <StickyNote size={16} />
          </button>
        </td>

        {/* Actions */}
        <td className="p-3 w-24">
          <div className="flex items-center gap-1">
            {editing ? (
              <>
                <button
                  onClick={saveEdit}
                  disabled={updateMutation.isPending}
                  className="p-1.5 rounded text-green-400 hover:bg-green-400/10 transition-colors"
                  title="Save changes"
                >
                  <Save size={14} />
                </button>
                <button
                  onClick={() => setEditing(false)}
                  className="p-1.5 rounded text-[#8b949e] hover:text-[#e6edf3] transition-colors"
                  title="Cancel"
                >
                  <X size={14} />
                </button>
              </>
            ) : (
              <>
                <button
                  onClick={() => setEditing(true)}
                  className="p-1.5 rounded text-[#8b949e] hover:text-[#58a6ff] hover:bg-[#58a6ff]/10 transition-colors"
                  title="Edit item"
                >
                  <Pencil size={14} />
                </button>
                <button
                  onClick={() => deleteMutation.mutate()}
                  disabled={deleteMutation.isPending}
                  className="p-1.5 rounded text-[#8b949e] hover:text-red-400 hover:bg-red-400/10 transition-colors"
                  title="Delete item"
                >
                  <Trash2 size={14} />
                </button>
              </>
            )}
          </div>
        </td>
      </tr>

      {/* Inline note editor */}
      {editingNote && (
        <tr className="border-b border-[rgba(48,54,61,0.5)] bg-[rgba(234,179,8,0.03)]">
          <td colSpan={9} className="px-4 pb-3 pt-1">
            <div className="flex gap-2 items-start">
              <StickyNote size={14} className="text-yellow-400 mt-2 shrink-0" />
              <div className="flex-1">
                <textarea
                  autoFocus
                  className="w-full bg-[#0d1117] border border-yellow-400/30 rounded-lg px-3 py-2 text-sm text-[#e6edf3] resize-none focus:outline-none focus:border-yellow-400/60 min-h-[60px]"
                  placeholder="Add a note about this item (e.g. 'Ask rep about promo', 'Check if back in stock')…"
                  value={noteDraft}
                  onChange={(e) => setNoteDraft(e.target.value)}
                />
                <div className="flex gap-2 mt-1.5">
                  <button
                    onClick={saveNote}
                    disabled={updateMutation.isPending}
                    className="flex items-center gap-1 text-xs px-2.5 py-1 rounded bg-yellow-500/20 text-yellow-400 hover:bg-yellow-500/30 transition-colors"
                  >
                    <Save size={11} /> Save Note
                  </button>
                  <button
                    onClick={() => setEditingNote(false)}
                    className="text-xs px-2.5 py-1 rounded text-[#8b949e] hover:text-[#e6edf3] transition-colors"
                  >
                    Cancel
                  </button>
                  {item.item_note && (
                    <button
                      onClick={() => { setNoteDraft(''); updateMutation.mutate({ item_note: '' }); toast.success('Note cleared') }}
                      className="text-xs px-2.5 py-1 rounded text-red-400/70 hover:text-red-400 transition-colors ml-auto"
                    >
                      Clear Note
                    </button>
                  )}
                </div>
              </div>
            </div>
          </td>
        </tr>
      )}
    </>
  )
}

// ── Company split section ────────────────────────────────────────────────────
function CompanySplits({ orderId }) {
  const qc = useQueryClient()
  const [expanded, setExpanded] = useState(false)
  const [linkInfo, setLinkInfo] = useState({})

  const { data: splits, refetch } = useQuery({
    queryKey: ['order-splits', orderId],
    queryFn: () => client.get(`/orders/${orderId}/splits`).then((r) => r.data),
    enabled: expanded,
  })

  const splitMutation = useMutation({
    mutationFn: () => client.post(`/orders/${orderId}/split`),
    onSuccess: () => { refetch(); toast.success('Order split by distributor') },
    onError: () => toast.error('Split failed'),
  })

  const generateLink = async (splitId) => {
    const { data } = await client.post(`/share/generate/${splitId}`)
    setLinkInfo((prev) => ({ ...prev, [splitId]: data }))
    await navigator.clipboard.writeText(window.location.origin + data.link)
    toast.success('Link copied to clipboard!')
  }

  return (
    <div className="glass-card overflow-hidden">
      <button
        className="w-full flex items-center justify-between p-4 text-left"
        onClick={() => setExpanded(!expanded)}
      >
        <div className="flex items-center gap-2">
          <Building2 size={16} className="text-[#58a6ff]" />
          <span className="text-[#e6edf3] font-medium text-sm">Distributor Splits & Share Links</span>
        </div>
        {expanded ? <ChevronUp size={16} className="text-[#8b949e]" /> : <ChevronDown size={16} className="text-[#8b949e]" />}
      </button>

      {expanded && (
        <div className="px-4 pb-4 border-t border-[rgba(48,54,61,0.5)]">
          <div className="flex justify-end mt-3 mb-3">
            <button
              onClick={() => splitMutation.mutate()}
              disabled={splitMutation.isPending}
              className="text-xs px-3 py-1.5 rounded-lg bg-[#58a6ff]/15 text-[#58a6ff] hover:bg-[#58a6ff]/25 transition-colors"
            >
              {splitMutation.isPending ? 'Splitting…' : 'Re-split by Distributor'}
            </button>
          </div>

          {!splits?.length && (
            <p className="text-[#8b949e] text-sm text-center py-4">
              Click "Re-split by Distributor" to group items and generate share links.
            </p>
          )}

          <div className="space-y-3">
            {splits?.map((split) => {
              const info = linkInfo[split.id]
              const belowMin = split.company_min_order && split.subtotal < split.company_min_order
              return (
                <div key={split.id} className={`p-3 rounded-lg border ${belowMin ? 'border-yellow-600/50 bg-yellow-500/5' : 'border-[rgba(48,54,61,0.8)] bg-[rgba(22,27,34,0.4)]'}`}>
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-[#e6edf3] text-sm font-medium">{split.company_name || 'Unknown'}</p>
                      <p className="text-[#8b949e] text-xs mt-0.5">{split.item_count} items · {formatCurrency(split.subtotal)}</p>
                    </div>
                    <span className={`text-xs px-2 py-0.5 rounded-full ${
                      split.status === 'confirmed' ? 'bg-green-900/50 text-green-400' :
                      split.status === 'sent' ? 'bg-blue-900/50 text-blue-400' :
                      'bg-gray-700 text-gray-400'
                    }`}>
                      {split.status === 'confirmed' && <CheckCircle size={10} className="inline mr-1" />}
                      {split.status === 'sent' && <Clock size={10} className="inline mr-1" />}
                      {split.status}
                    </span>
                  </div>

                  {belowMin && (
                    <div className="flex items-center gap-1.5 mt-2 px-2 py-1.5 rounded bg-yellow-500/10 border border-yellow-500/20">
                      <AlertTriangle size={12} className="text-yellow-400 shrink-0" />
                      <p className="text-yellow-400 text-xs">
                        Below minimum of {formatCurrency(split.company_min_order)} —
                        short by {formatCurrency(split.company_min_order - split.subtotal)}
                      </p>
                    </div>
                  )}

                  <div className="flex flex-wrap gap-2 mt-2">
                    <button
                      onClick={() => generateLink(split.id)}
                      className="flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-lg bg-[rgba(48,54,61,0.5)] text-[#8b949e] hover:text-[#e6edf3] hover:bg-[rgba(48,54,61,0.8)] transition-colors"
                    >
                      <Link2 size={12} /> Generate Link
                    </button>
                    {info && (
                      <button
                        onClick={() => window.open(`/api/share/pdf/${info.token}`, '_blank')}
                        className="flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-lg bg-[rgba(48,54,61,0.5)] text-[#8b949e] hover:text-[#e6edf3] hover:bg-[rgba(48,54,61,0.8)] transition-colors"
                      >
                        <Download size={12} /> PDF
                      </button>
                    )}
                  </div>
                  {info && (
                    <p className="text-xs text-[#58a6ff] mt-1.5 font-mono truncate">
                      {window.location.origin}{info.link}
                    </p>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}

// ── Main page ────────────────────────────────────────────────────────────────
export default function OrderDetailPage() {
  const { orderId } = useParams()
  const navigate = useNavigate()
  const qc = useQueryClient()
  const [filter, setFilter] = useState('all')

  const { data: order, isLoading: orderLoading } = useQuery({
    queryKey: ['order', orderId],
    queryFn: () => client.get(`/orders/${orderId}`).then((r) => r.data),
  })

  const { data: items, isLoading: itemsLoading, refetch: refetchItems } = useQuery({
    queryKey: ['order-items', orderId],
    queryFn: () => client.get(`/orders/${orderId}/items`).then((r) => r.data),
  })

  const { data: companies } = useQuery({
    queryKey: ['companies'],
    queryFn: () => client.get('/companies').then((r) => r.data),
  })

  const markSentMutation = useMutation({
    mutationFn: () => client.put(`/orders/${orderId}`, { status: 'sent' }),
    onSuccess: () => { qc.invalidateQueries(['order', orderId]); toast.success('Order marked as sent') },
    onError: () => toast.error('Failed to update order'),
  })

  const markConfirmedMutation = useMutation({
    mutationFn: () => client.put(`/orders/${orderId}`, { status: 'confirmed' }),
    onSuccess: () => { qc.invalidateQueries(['order', orderId]); toast.success('Order confirmed') },
    onError: () => toast.error('Failed to update order'),
  })

  const pending = items?.filter((i) => !i.is_struck) ?? []
  const struck = items?.filter((i) => i.is_struck) ?? []

  const filteredItems = filter === 'pending' ? pending : filter === 'ordered' ? struck : items ?? []

  const totalValue = items?.reduce((s, i) => s + (i.line_total || 0), 0) ?? 0
  const pendingValue = pending.reduce((s, i) => s + (i.line_total || 0), 0)

  if (orderLoading) return <Layout title="Order Details"><div className="flex justify-center py-24"><LoadingSpinner /></div></Layout>

  return (
    <Layout title="Order Details">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <Link
            to="/orders"
            className="flex items-center gap-1.5 text-sm text-[#8b949e] hover:text-[#e6edf3] transition-colors mb-2"
          >
            <ArrowLeft size={14} /> Back to Orders
          </Link>
          <h1 className="text-xl font-bold text-[#e6edf3]">
            Order — {order?.order_month ? new Date(order.order_month + 'T00:00:00').toLocaleDateString('en-US', { month: 'long', year: 'numeric' }) : ''}
          </h1>
          <div className="flex items-center gap-2 mt-1">
            <span className={`text-xs px-2 py-0.5 rounded-full ${
              order?.status === 'confirmed' ? 'bg-green-900/50 text-green-400' :
              order?.status === 'sent' ? 'bg-blue-900/50 text-blue-400' :
              'bg-gray-700 text-gray-400'
            }`}>
              {order?.status === 'confirmed' && <CheckCircle size={10} className="inline mr-1" />}
              {order?.status === 'sent' && <Clock size={10} className="inline mr-1" />}
              {order?.status}
            </span>
            <span className="text-xs text-[#8b949e]">{items?.length ?? 0} items</span>
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => window.open(`/api/orders/${orderId}/pdf/master`, '_blank')}
            className="flex items-center gap-1.5 text-sm px-3 py-2 rounded-lg bg-[rgba(48,54,61,0.5)] text-[#8b949e] hover:text-[#e6edf3] hover:bg-[rgba(48,54,61,0.8)] transition-colors border border-[rgba(48,54,61,0.8)]"
          >
            <FileText size={14} /> Master PDF
          </button>
          {order?.status === 'draft' && (
            <button
              onClick={() => markSentMutation.mutate()}
              disabled={markSentMutation.isPending}
              className="flex items-center gap-1.5 text-sm px-3 py-2 rounded-lg bg-blue-500/15 text-blue-400 hover:bg-blue-500/25 transition-colors"
            >
              <Clock size={14} /> Mark as Sent
            </button>
          )}
          {order?.status === 'sent' && (
            <button
              onClick={() => markConfirmedMutation.mutate()}
              disabled={markConfirmedMutation.isPending}
              className="flex items-center gap-1.5 text-sm px-3 py-2 rounded-lg bg-green-500/15 text-green-400 hover:bg-green-500/25 transition-colors"
            >
              <CheckCircle size={14} /> Confirm Order
            </button>
          )}
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
        <div className="glass-card p-4 text-center">
          <p className="text-[#8b949e] text-xs mb-1">Total Items</p>
          <p className="text-2xl font-bold text-[#e6edf3]">{items?.length ?? 0}</p>
        </div>
        <div className="glass-card p-4 text-center">
          <p className="text-[#8b949e] text-xs mb-1">Pending</p>
          <p className="text-2xl font-bold text-yellow-400">{pending.length}</p>
        </div>
        <div className="glass-card p-4 text-center">
          <p className="text-[#8b949e] text-xs mb-1">Ordered ✓</p>
          <p className="text-2xl font-bold text-green-400">{struck.length}</p>
        </div>
        <div className="glass-card p-4 text-center">
          <p className="text-[#8b949e] text-xs mb-1">Total Value</p>
          <p className="text-lg font-bold text-[#e6edf3]">{formatCurrency(totalValue)}</p>
          {pendingValue > 0 && pendingValue < totalValue && (
            <p className="text-xs text-yellow-400 mt-0.5">{formatCurrency(pendingValue)} pending</p>
          )}
        </div>
      </div>

      {/* Filter tabs */}
      <div className="flex gap-2 mb-4">
        {[
          { key: 'all', label: `All (${items?.length ?? 0})` },
          { key: 'pending', label: `Pending (${pending.length})` },
          { key: 'ordered', label: `Ordered ✓ (${struck.length})` },
        ].map(({ key, label }) => (
          <button
            key={key}
            onClick={() => setFilter(key)}
            className={`text-sm px-3 py-1.5 rounded-lg transition-colors ${
              filter === key
                ? 'bg-[#58a6ff]/20 text-[#58a6ff] font-medium'
                : 'text-[#8b949e] hover:text-[#e6edf3] hover:bg-[rgba(48,54,61,0.5)]'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Items table */}
      <div className="glass-card overflow-hidden mb-6">
        {itemsLoading ? (
          <div className="flex justify-center py-12"><LoadingSpinner /></div>
        ) : filteredItems.length === 0 ? (
          <div className="text-center py-12 text-[#8b949e] text-sm">
            {filter === 'ordered' ? 'No items marked as ordered yet.' :
             filter === 'pending' ? 'All items have been ordered!' :
             'No items in this order.'}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-[rgba(48,54,61,0.8)] bg-[rgba(22,27,34,0.6)]">
                  <th className="px-3 py-2.5 text-xs text-[#8b949e] font-medium w-10">✓</th>
                  <th className="px-3 py-2.5 text-xs text-[#8b949e] font-medium">Item Name</th>
                  <th className="px-3 py-2.5 text-xs text-[#8b949e] font-medium w-28">Size</th>
                  <th className="px-3 py-2.5 text-xs text-[#8b949e] font-medium w-28">Unit</th>
                  <th className="px-3 py-2.5 text-xs text-[#8b949e] font-medium w-20 text-center">Qty</th>
                  <th className="px-3 py-2.5 text-xs text-[#8b949e] font-medium w-40">Distributor</th>
                  <th className="px-3 py-2.5 text-xs text-[#8b949e] font-medium w-28 text-right">Price</th>
                  <th className="px-3 py-2.5 text-xs text-[#8b949e] font-medium w-10 text-center">Note</th>
                  <th className="px-3 py-2.5 text-xs text-[#8b949e] font-medium w-24">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredItems.map((item) => (
                  <ItemRow
                    key={item.id}
                    item={item}
                    orderId={orderId}
                    companies={companies}
                    onRefresh={refetchItems}
                  />
                ))}
              </tbody>
              {filteredItems.length > 0 && (
                <tfoot>
                  <tr className="border-t border-[rgba(48,54,61,0.8)] bg-[rgba(22,27,34,0.4)]">
                    <td colSpan={6} className="px-3 py-2.5 text-xs text-[#8b949e]">
                      {filteredItems.length} items shown
                    </td>
                    <td className="px-3 py-2.5 text-right font-mono font-semibold text-[#e6edf3] text-sm">
                      {formatCurrency(filteredItems.reduce((s, i) => s + (i.line_total || 0), 0))}
                    </td>
                    <td colSpan={2} />
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        )}
      </div>

      {/* Distributor splits */}
      <CompanySplits orderId={orderId} />
    </Layout>
  )
}
