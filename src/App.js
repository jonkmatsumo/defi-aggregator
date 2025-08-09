import React from 'react';
import WalletProvider from './components/WalletProvider';
import Header from './components/Header';
import TokenSwap from './components/TokenSwap';
import NetworkStatus from './components/NetworkStatus';
import YourAssets from './components/YourAssets';
import LendingSection from './components/LendingSection';
import RecentActivity from './components/RecentActivity';
import PerpetualsSection from './components/PerpetualsSection';
import './App.css';

function App() {
  return (
    <WalletProvider>
      <div className="App">
        <Header />
        
        <div style={{
          background: 'linear-gradient(135deg, #0f1419 0%, #1a1a2e 100%)',
          minHeight: 'calc(100vh - 80px)',
          padding: 'clamp(16px, 3vw, 32px)',
          color: 'white',
          width: '100%',
          boxSizing: 'border-box'
        }}>
          {/* Main Content Grid */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: '1fr minmax(280px, 25%)',
            gap: 'clamp(16px, 2vw, 32px)',
            alignItems: 'start',
            maxWidth: '100%',
            width: '100%'
          }}>
            {/* Left Column - Main Content (Swap + Lending + Perpetuals) */}
            <div style={{
              display: 'flex',
              flexDirection: 'column',
              gap: 'clamp(16px, 2vw, 32px)',
              minWidth: 0
            }}>
              {/* Token Swap Card */}
              <TokenSwap />
              
              {/* Lending Section Card */}
              <LendingSection />

              {/* Perpetuals Trading Card */}
              <PerpetualsSection />
            </div>

            {/* Right Column - Sidebar */}
            <div style={{
              display: 'flex',
              flexDirection: 'column',
              gap: 'clamp(12px, 1.5vw, 24px)',
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
