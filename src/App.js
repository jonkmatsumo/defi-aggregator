import React from 'react';
import WalletProvider from './components/WalletProvider';
import Header from './components/Header';
import DashboardCard from './components/DashboardCard';
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
          {/* Dashboard Cards */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))',
            gap: '20px',
            marginBottom: '32px'
          }}>
            <DashboardCard
              title="Total Balance"
              value="$24,567.89"
              subtitle="+8.2%"
              trend="+$1,234"
              trendColor="#48bb78"
              icon="💰"
            />
            <DashboardCard
              title="24h Change"
              value="+$1,234"
              subtitle="+5.3%"
              trend="+5.3%"
              trendColor="#48bb78"
              icon="📈"
            />
            <DashboardCard
              title="Lending APY"
              value="8.45%"
              subtitle="Average"
              icon="🏦"
            />
            <DashboardCard
              title="Active Positions"
              value="7"
              subtitle="Positions"
              icon="📊"
            />
          </div>

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
