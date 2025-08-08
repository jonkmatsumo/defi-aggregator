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
          color: 'white'
        }}>
          {/* Main Content Grid */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: '1fr 1fr 300px',
            gap: '24px',
            alignItems: 'start'
          }}>
            {/* Left Column - Token Swap */}
            <TokenSwap />

            {/* Middle Column - Lending */}
            <LendingSection />

            {/* Right Column - Sidebar */}
            <div style={{
              display: 'flex',
              flexDirection: 'column',
              gap: '20px'
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
