import { useEffect, useState, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'

const FOLDER_TYPES = [
  { id: 'will', label: 'Will & Testament', emoji: '📜', color: '#c4855a' },
  { id: 'death', label: 'Death Certificate', emoji: '🏛️', color: '#6b8fa8' },
  { id: 'property', label: 'Property & Deeds', emoji: '🏠', color: '#7aaa7a' },
  { id: 'insurance', label: 'Insurance', emoji: '🛡️', color: '#b87ab8' },
  { id: 'tax', label: 'Tax Documents', emoji: '📊', color: '#c4b06a' },
  { id: 'id', label: 'ID Documents', emoji: '🪪', color: '#6ab8b8' },
  { id: 'probate', label: 'Probate & Legal', emoji: '⚖️', color: '#c46a6a' },
  { id: 'other', label: 'Other', emoji: '📁', color: '#a89080' },
]

const FILE_ICONS = {
  'application/pdf': '📄',
  'image/jpeg': '🖼️',
  'image/png': '🖼️',
  'image/webp': '🖼️',
  'application/msword': '📝',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': '📝',
  'application/vnd.ms-excel': '📊',
  'text/plain': '📃',
}

const getFileIcon = (type) => FILE_ICONS[type] || '📎'
const formatSize = (bytes) => bytes < 1024*1024 ? `${(bytes/1024).toFixed(0)} KB` : `${(bytes/(1024*1024)).toFixed(1)} MB`

export default function DocumentVaultPage({ session, profile }) {
  const { id } = useParams()
  const navigate = useNavigate()
  const [docs, setDocs] = useState([])
  const [activeFolder, setActiveFolder] = useState('all')
  const [uploading, setUploading] = useState(false)
  const [uploadProgress, setUploadProgress] = useState(0)
  const [myRole, setMyRole] = useState('member')
  const [dragOver, setDragOver] = useState(false)
  const [preview, setPreview] = useState(null)
  const fileRef = useRef()

  const load = async () => {
    const [{ data: ds }, { data: mem }] = await Promise.all([
      supabase.from('documents').select('*, uploader:profiles!documents_uploaded_by_fkey(display_name, avatar_color)')
        .eq('estate_id', id).order('created_at', { ascending: false }),
      supabase.from('estate_members').select('role').eq('estate_id', id).eq('user_id', session.user.id).single(),
    ])
    setDocs(ds || [])
    setMyRole(mem?.role || 'member')
  }

  useEffect(() => { load() }, [id])

  const uploadFile = async (file) => {
    if (!file) return
    setUploading(true)
    setUploadProgress(10)
    try {
      const ext = file.name.split('.').pop()
      const path = `documents/${id}/${Date.now()}-${file.name.replace(/[^a-zA-Z0-9.-]/g, '_')}`
      setUploadProgress(30)
      const { error: upErr } = await supabase.storage.from('estate-docs').upload(path, file)
      if (upErr) throw upErr
      setUploadProgress(70)
      const { data: urlData } = supabase.storage.from('estate-docs').getPublicUrl(path)
      await supabase.from('documents').insert({
        estate_id: id, name: file.name, file_url: urlData.publicUrl,
        file_path: path, file_type: file.type, file_size: file.size,
        folder: activeFolder === 'all' ? 'other' : activeFolder,
        uploaded_by: session.user.id,
      })
      setUploadProgress(100)
      setTimeout(() => { setUploading(false); setUploadProgress(0); load() }, 500)
    } catch (e) {
      alert('Upload failed: ' + e.message)
      setUploading(false); setUploadProgress(0)
    }
  }

  const handleFiles = (files) => {
    Array.from(files).forEach(uploadFile)
  }

  const deleteDoc = async (doc) => {
    if (!confirm(`Delete "${doc.name}"? This cannot be undone.`)) return
    await supabase.storage.from('estate-docs').remove([doc.file_path])
    await supabase.from('documents').delete().eq('id', doc.id)
    load()
  }

  const moveDoc = async (docId, folder) => {
    await supabase.from('documents').update({ folder }).eq('id', docId)
    load()
  }

  const filtered = activeFolder === 'all' ? docs : docs.filter(d => d.folder === activeFolder)
  const countByFolder = FOLDER_TYPES.reduce((acc, f) => {
    acc[f.id] = docs.filter(d => d.folder === f.id).length
    return acc
  }, {})

  return (
    <div style={{ maxWidth: '900px', margin: '0 auto', padding: '28px 16px', fontFamily: 'DM Sans, sans-serif' }}>
      <button onClick={() => navigate(`/estate/${id}`)} style={{ background: 'none', border: 'none', color: '#8c7b6b', cursor: 'pointer', fontSize: '13px', padding: '0 0 20px', fontFamily: 'DM Sans, sans-serif' }}>← Back to estate</button>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '28px', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <h1 style={{ fontFamily: 'Playfair Display, serif', fontSize: '26px', fontWeight: '400', color: '#1a1410', marginBottom: '4px' }}>🔒 Document vault</h1>
          <p style={{ color: '#8c7b6b', fontSize: '14px' }}>Securely store and share important documents</p>
        </div>
        <button onClick={() => fileRef.current.click()} style={{ padding: '9px 18px', background: '#1a1410', color: '#f5f0eb', border: 'none', borderRadius: '8px', cursor: 'pointer', fontSize: '14px', fontFamily: 'DM Sans, sans-serif' }}>
          ↑ Upload file
        </button>
        <input ref={fileRef} type="file" multiple accept=".pdf,.doc,.docx,.jpg,.jpeg,.png,.webp,.txt,.xls,.xlsx" onChange={e => handleFiles(e.target.files)} style={{ display: 'none' }} />
      </div>

      {/* Upload progress */}
      {uploading && (
        <div style={{ background: '#fff', border: '1px solid #e8e0d6', borderRadius: '10px', padding: '16px 20px', marginBottom: '20px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
            <span style={{ fontSize: '14px', color: '#1a1410' }}>Uploading…</span>
            <span style={{ fontSize: '14px', color: '#c4855a' }}>{uploadProgress}%</span>
          </div>
          <div style={{ height: '6px', background: '#f0ebe4', borderRadius: '3px', overflow: 'hidden' }}>
            <div style={{ height: '100%', width: `${uploadProgress}%`, background: '#c4855a', borderRadius: '3px', transition: 'width 0.3s ease' }} />
          </div>
        </div>
      )}

      {/* Drag and drop zone */}
      <div
        onDragOver={e => { e.preventDefault(); setDragOver(true) }}
        onDragLeave={() => setDragOver(false)}
        onDrop={e => { e.preventDefault(); setDragOver(false); handleFiles(e.dataTransfer.files) }}
        style={{
          border: `2px dashed ${dragOver ? '#c4855a' : '#d4c8b8'}`,
          borderRadius: '12px', padding: '24px', textAlign: 'center',
          background: dragOver ? '#fef3e8' : '#faf7f3',
          marginBottom: '24px', cursor: 'pointer', transition: 'all 0.2s',
        }}
        onClick={() => fileRef.current.click()}
      >
        <div style={{ fontSize: '28px', marginBottom: '8px' }}>📂</div>
        <div style={{ fontSize: '14px', color: '#8c7b6b' }}>Drop files here or click to upload</div>
        <div style={{ fontSize: '12px', color: '#b0a090', marginTop: '4px' }}>PDF, Word, Excel, Images supported</div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '220px 1fr', gap: '20px' }}>
        {/* Folder sidebar */}
        <div>
          <div style={{ background: '#fff', border: '1px solid #e8e0d6', borderRadius: '12px', overflow: 'hidden' }}>
            <button onClick={() => setActiveFolder('all')} style={{
              width: '100%', padding: '12px 16px', background: activeFolder === 'all' ? '#f0ebe4' : 'none',
              border: 'none', borderBottom: '1px solid #f0ebe4', textAlign: 'left', cursor: 'pointer',
              fontSize: '14px', color: '#1a1410', fontFamily: 'DM Sans, sans-serif',
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            }}>
              <span>📁 All documents</span>
              <span style={{ fontSize: '12px', color: '#a89080', background: '#f5f0eb', padding: '1px 7px', borderRadius: '20px' }}>{docs.length}</span>
            </button>
            {FOLDER_TYPES.map((folder, i) => (
              <button key={folder.id} onClick={() => setActiveFolder(folder.id)} style={{
                width: '100%', padding: '11px 16px',
                background: activeFolder === folder.id ? '#f0ebe4' : 'none',
                border: 'none', borderBottom: i < FOLDER_TYPES.length - 1 ? '1px solid #f5f0eb' : 'none',
                textAlign: 'left', cursor: 'pointer', fontSize: '13px', color: '#1a1410',
                fontFamily: 'DM Sans, sans-serif', display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              }}>
                <span>{folder.emoji} {folder.label}</span>
                {countByFolder[folder.id] > 0 && (
                  <span style={{ fontSize: '11px', color: '#a89080', background: '#f5f0eb', padding: '1px 6px', borderRadius: '20px' }}>{countByFolder[folder.id]}</span>
                )}
              </button>
            ))}
          </div>
        </div>

        {/* Documents list */}
        <div>
          {filtered.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '60px 20px', color: '#a89080' }}>
              <div style={{ fontSize: '40px', marginBottom: '12px' }}>📂</div>
              <p>No documents in {activeFolder === 'all' ? 'this vault' : 'this folder'} yet.</p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {filtered.map(doc => (
                <DocRow key={doc.id} doc={doc} session={session} myRole={myRole}
                  onDelete={() => deleteDoc(doc)}
                  onMove={(folder) => moveDoc(doc.id, folder)}
                  onPreview={() => setPreview(doc)} />
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Preview modal */}
      {preview && (
        <div onClick={() => setPreview(null)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 200, padding: '20px' }}>
          <div onClick={e => e.stopPropagation()} style={{ background: '#fff', borderRadius: '14px', padding: '28px', maxWidth: '560px', width: '100%' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '20px' }}>
              <div>
                <h3 style={{ fontFamily: 'Playfair Display, serif', fontSize: '18px', fontWeight: '400', color: '#1a1410', marginBottom: '4px' }}>{preview.name}</h3>
                <p style={{ fontSize: '13px', color: '#a89080' }}>Uploaded by {preview.uploader?.display_name} · {new Date(preview.created_at).toLocaleDateString('en-GB')}</p>
              </div>
              <button onClick={() => setPreview(null)} style={{ background: 'none', border: 'none', fontSize: '24px', color: '#a89080', cursor: 'pointer' }}>×</button>
            </div>
            {preview.file_type?.startsWith('image/') && (
              <img src={preview.file_url} alt={preview.name} style={{ width: '100%', borderRadius: '8px', marginBottom: '16px' }} />
            )}
            <div style={{ display: 'flex', gap: '10px' }}>
              <a href={preview.file_url} target="_blank" rel="noopener noreferrer" style={{ flex: 1, padding: '11px', background: '#1a1410', color: '#f5f0eb', borderRadius: '8px', textAlign: 'center', textDecoration: 'none', fontSize: '14px', fontFamily: 'DM Sans, sans-serif' }}>
                ↗ Open / Download
              </a>
              <button onClick={() => setPreview(null)} style={{ flex: 1, padding: '11px', background: 'none', border: '1px solid #e0d8d0', borderRadius: '8px', cursor: 'pointer', color: '#6b5c4c', fontSize: '14px', fontFamily: 'DM Sans, sans-serif' }}>Close</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function DocRow({ doc, session, myRole, onDelete, onMove, onPreview }) {
  const [showMove, setShowMove] = useState(false)
  const folder = FOLDER_TYPES.find(f => f.id === doc.folder) || FOLDER_TYPES[FOLDER_TYPES.length - 1]

  return (
    <div style={{ background: '#fff', border: '1px solid #e8e0d6', borderRadius: '10px', padding: '14px 16px', display: 'flex', alignItems: 'center', gap: '12px' }}>
      <span style={{ fontSize: '28px', flexShrink: 0 }}>{getFileIcon(doc.file_type)}</span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: '14px', color: '#1a1410', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{doc.name}</div>
        <div style={{ fontSize: '12px', color: '#a89080', marginTop: '2px', display: 'flex', gap: '8px', alignItems: 'center' }}>
          <span>{doc.uploader?.display_name}</span>
          <span>·</span>
          <span>{formatSize(doc.file_size)}</span>
          <span>·</span>
          <span>{new Date(doc.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}</span>
        </div>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexShrink: 0 }}>
        <span style={{ fontSize: '11px', background: '#f5f0eb', color: '#6b5c4c', padding: '2px 8px', borderRadius: '20px' }}>{folder.emoji} {folder.label}</span>

        <button onClick={onPreview} title="Preview" style={{ background: 'none', border: '1px solid #e0d8d0', padding: '5px 9px', borderRadius: '6px', cursor: 'pointer', fontSize: '13px', color: '#6b5c4c' }}>👁</button>

        <a href={doc.file_url} target="_blank" rel="noopener noreferrer" title="Download" style={{ background: 'none', border: '1px solid #e0d8d0', padding: '5px 9px', borderRadius: '6px', cursor: 'pointer', fontSize: '13px', color: '#6b5c4c', textDecoration: 'none' }}>↓</a>

        <div style={{ position: 'relative' }}>
          <button onClick={() => setShowMove(!showMove)} title="Move to folder" style={{ background: 'none', border: '1px solid #e0d8d0', padding: '5px 9px', borderRadius: '6px', cursor: 'pointer', fontSize: '13px', color: '#6b5c4c' }}>📁</button>
          {showMove && (
            <div style={{ position: 'absolute', right: 0, top: '34px', background: '#fff', border: '1px solid #e8e0d6', borderRadius: '10px', minWidth: '180px', boxShadow: '0 8px 24px rgba(0,0,0,0.12)', zIndex: 50, overflow: 'hidden' }}>
              {FOLDER_TYPES.map(f => (
                <button key={f.id} onClick={() => { onMove(f.id); setShowMove(false) }} style={{ display: 'block', width: '100%', padding: '9px 14px', background: doc.folder === f.id ? '#f0ebe4' : 'none', border: 'none', textAlign: 'left', cursor: 'pointer', fontSize: '13px', color: '#1a1410', fontFamily: 'DM Sans, sans-serif' }}>
                  {f.emoji} {f.label}
                </button>
              ))}
            </div>
          )}
        </div>

        {(myRole === 'admin' || doc.uploaded_by === session.user.id) && (
          <button onClick={onDelete} title="Delete" style={{ background: 'none', border: '1px solid #f0d0c8', padding: '5px 9px', borderRadius: '6px', cursor: 'pointer', fontSize: '13px', color: '#c0a090' }}>×</button>
        )}
      </div>
    </div>
  )
}
