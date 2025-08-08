import React from 'react';
import WalletProvider from './components/WalletProvider';
import Header from './components/Header';
import TokenSwap from './components/TokenSwap';
import NetworkStatus from './components/NetworkStatus';
import YourAssets from './components/YourAssets';
import LendingSection from './components/LendingSection';
import RecentActivity from './components/RecentActivity';
import './App.css';

function App() {
  return (
    <WalletProvider>
      <div className="App">
        <Header />
        
        <div style={{
          background: 'linear-gradient(135deg, #0f1419 0%, #1a1a2e 100%)',
          minHeight: 'calc(100vh - 80px)',
          padding: '24px',
          color: 'white',
          width: '100%',
          boxSizing: 'border-box'
        }}>
          {/* Main Content Grid */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: '1fr 1fr 1fr',
            gap: '24px',
            alignItems: 'start',
            maxWidth: '100%',
            width: '100%'
          }}>
            {/* Left Column - Token Swap */}
            <div style={{ minWidth: 0 }}>
              <TokenSwap />
            </div>

            {/* Middle Column - Lending */}
            <div style={{ minWidth: 0 }}>
              <LendingSection />
            </div>

            {/* Right Column - Sidebar */}
            <div style={{
              display: 'flex',
              flexDirection: 'column',
              gap: '20px',
              minWidth: 0
            }}>
              <NetworkStatus />
              <YourAssets />
              <RecentActivity />
            </div>
          </div>
        </div>
      </div>
    </WalletProvider>
  );
}

export default App;
