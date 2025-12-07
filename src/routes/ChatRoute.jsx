import ErrorBoundary from '../components/ErrorBoundary';
import ChatInterface from '../components/Chat/ChatInterface';

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
        width: '100%',
        height: 'calc(100vh - 80px - clamp(32px, 6vw, 64px))',
        display: 'flex',
        flexDirection: 'column'
      }}>
        <ErrorBoundary name="chat-interface">
          <ChatInterface />
        </ErrorBoundary>
      </div>
    </div>
  );
}

export default ChatRoute;
