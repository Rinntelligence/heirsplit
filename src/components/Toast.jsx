export default function Toast({ msg, type = 'success' }) {
  return (
    <div style={{
      position: 'fixed', bottom: '28px', left: '50%', transform: 'translateX(-50%)',
      background: type === 'error' ? '#c0392b' : '#1a1410',
      color: '#f5f0eb', padding: '11px 28px', borderRadius: '10px',
      fontSize: '14px', zIndex: 999, boxShadow: '0 4px 24px rgba(0,0,0,0.2)',
      fontFamily: 'DM Sans, sans-serif', whiteSpace: 'nowrap',
      animation: 'fadeUp 0.2s ease',
    }}>
      <style>{`@keyframes fadeUp{from{opacity:0;transform:translateX(-50%) translateY(8px)}to{opacity:1;transform:translateX(-50%) translateY(0)}}`}</style>
      {msg}
    </div>
  )
}
