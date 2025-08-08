import React from 'react';

const RecentActivity = () => {
  const activities = [
    {
      type: 'Swap',
      description: 'Swap ETH → USDC',
      amount: '+1,250 USDC',
      time: '2 hours ago',
      status: 'completed',
      icon: '🔄'
    },
    {
      type: 'Supply',
      description: 'Supply USDC',
      amount: '500 USDC',
      time: '1 day ago',
      status: 'completed',
      icon: '📈'
    }
  ];

  return (
    <div style={{
      background: 'linear-gradient(135deg, #2d3748 0%, #1a202c 100%)',
      borderRadius: '16px',
      padding: '20px',
      border: '1px solid #4a5568'
    }}>
      <h3 style={{
        color: 'white',
        fontSize: '16px',
        fontWeight: '600',
        margin: '0 0 16px 0'
      }}>
        Recent Activity
      </h3>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
        {activities.map((activity, index) => (
          <div
            key={index}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
              padding: '12px',
              background: '#1a202c',
              borderRadius: '8px',
              border: '1px solid #4a5568'
            }}
          >
            <div style={{
              width: '32px',
              height: '32px',
              background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
              borderRadius: '50%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '16px'
            }}>
              {activity.icon}
            </div>
            
            <div style={{ flex: 1 }}>
              <div style={{
                color: 'white',
                fontSize: '14px',
                fontWeight: '500',
                marginBottom: '2px'
              }}>
                {activity.description}
              </div>
              <div style={{
                color: '#a0aec0',
                fontSize: '12px'
              }}>
                {activity.time}
              </div>
            </div>
            
            <div style={{
              color: activity.amount.startsWith('+') ? '#48bb78' : 'white',
              fontSize: '14px',
              fontWeight: '600'
            }}>
              {activity.amount}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default RecentActivity;