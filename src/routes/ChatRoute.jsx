function ChatRoute() {
  return (
    <div style={{
      background: 'linear-gradient(135deg, #0f1419 0%, #1a1a2e 100%)',
      minHeight: 'calc(100vh - 80px)',
      padding: 'clamp(16px, 3vw, 32px)',
      color: 'white',
      width: '100%',
      boxSizing: 'border-box',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center'
    }}>
      <div style={{
        maxWidth: '1200px',
        width: '100%'
      }}>
        <h1 style={{
          fontSize: 'clamp(24px, 4vw, 36px)',
          marginBottom: '24px',
          background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
          WebkitBackgroundClip: 'text',
          WebkitTextFillColor: 'transparent',
          backgroundClip: 'text'
        }}>
          Chat Interface
        </h1>
        <div style={{
          background: 'rgba(255, 255, 255, 0.05)',
          borderRadius: '16px',
          padding: '32px',
          border: '1px solid rgba(255, 255, 255, 0.1)'
        }}>
          <p style={{
            fontSize: '16px',
            lineHeight: '1.6',
            color: 'rgba(255, 255, 255, 0.8)'
          }}>
            Chat interface coming soon. This will allow you to interact with your DeFi dashboard through natural conversation.
          </p>
        </div>
      </div>
    </div>
  );
}

export default ChatRoute;
