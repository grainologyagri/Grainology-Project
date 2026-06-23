import React, { useState, useEffect, useMemo } from 'react';
import { AgmarknetTable } from './AgmarknetTable';
import { AgmarknetFilters } from './AgmarknetFilters';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';

export const AgmarknetDashboard: React.FC = () => {
  const [filters, setFilters] = useState({
    state: 100006, // All States
    district: [] as number[],
    market: [100009], // All Markets
    group: [] as number[], // All Groups
    commodity: [1, 2, 4], // Paddy, Maize, Wheat
    variety: 100021, // Default
    grades: [4] // FAQ Grade (4)
  });

  const [date, setDate] = useState(() => {
    const d = new Date();
    return d.toISOString().split('T')[0];
  });

  const [filterData, setFilterData] = useState<any>(null);
  const [tableData, setTableData] = useState<any>({ columns: [], records: [], reported_dates: [], source: '', stale: false });
  const [isLoading, setIsLoading] = useState(false);
  const [isFilterLoading, setIsFilterLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Fetch filters
  useEffect(() => {
    fetch(`${API_URL}/agmarknet/filters`)
      .then(r => r.json())
      .then(res => {
        const actualData = res.data?.data ? res.data.data : res.data;
        setFilterData(actualData);
        setIsFilterLoading(false);
      })
      .catch(e => {
        console.error('Error fetching filters', e);
        setIsFilterLoading(false);
      });
  }, []);

  // Predictive Caching (Pre-fetching) for popular states
  useEffect(() => {
    if (filterData?.state_data && date) {
      // Pre-fetch for common states: Bihar (100006), UP (100028), MP (100018)
      const popularStateIds = [100006, 100028, 100018];
      popularStateIds.forEach(stateId => {
        const payload = {
          dashboard: 'marketwise_price_arrival',
          date,
          state: stateId,
          district: [],
          market: [100009],
          group: [],
          commodity: [1, 2, 4],
          variety: 100021,
          grades: [4],
          limit: 150,
          format: 'json'
        };
        // Silent background fetch
        fetch(`${API_URL}/agmarknet/marketwise-price-arrival`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        }).catch(() => {});
      });
    }
  }, [filterData, date]);

  // Fetch data
  const fetchData = async (force = false) => {
    setIsLoading(true);
    setError(null);
    try {
      const payload = {
        dashboard: 'marketwise_price_arrival',
        date,
        ...filters,
        limit: 150,
        force,
        format: 'json'
      };
      const res = await fetch(`${API_URL}/agmarknet/marketwise-price-arrival`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      if (data.status === 'error' || !data.success) {
        setError(data.error || 'Failed to fetch data.');
        setTableData({ columns: [], records: [], reported_dates: [], source: '', stale: false });
      } else {
        setTableData(data);
      }
    } catch (e: any) {
      console.error('Error fetching marketwise data', e);
      setError(e.message || 'Network error fetching data.');
      setTableData({ columns: [], records: [], reported_dates: [], source: '', stale: false });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [filters, date]);

  const handleFilterChange = (key: string, value: any) => {
    setFilters(prev => {
      const next = { ...prev, [key]: value };
      if (key === 'state') {
        next.district = [];
        next.market = [100009];
      }
      if (key === 'district') {
        next.market = [100009];
      }
      return next;
    });
  };

  const handleReset = () => {
    setFilters({
      state: 100006,
      district: [],
      market: [100009],
      group: [],
      commodity: [1, 2, 4],
      variety: 100021,
      grades: [4]
    });
  };

  const handleDownloadCSV = () => {
    if (!tableData?.records?.length) return;

    const d0 = tableData.reported_dates?.[0] || 'Today';
    const d1 = tableData.reported_dates?.[1] || 'Yesterday';
    const d2 = tableData.reported_dates?.[2] || '2 Days Ago';

    const headers = [
      'Commodity Group',
      'Commodity',
      'MSP (Rs./Quintal)',
      `Price ${d0}`,
      `Price ${d1}`,
      `Price ${d2}`,
      `Arrival ${d0}`,
      `Arrival ${d1}`,
      `Arrival ${d2}`
    ];

    const csvRows = [headers.map(h => `"${h}"`).join(',')];

    for (const row of tableData.records) {
      const vals = [
        `"${row.commodity_group || ''}"`,
        `"${row.commodity || ''}"`,
        row.msp_price_rs_per_quintal || '',
        row.price?.as_on?.value || '',
        row.price?.one_day_ago?.value || '',
        row.price?.two_day_ago?.value || '',
        row.arrival_metric_tonnes?.as_on?.value || '',
        row.arrival_metric_tonnes?.one_day_ago?.value || '',
        row.arrival_metric_tonnes?.two_day_ago?.value || ''
      ];
      csvRows.push(vals.join(','));
    }

    const blob = new Blob([csvRows.join('\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `agmarknet_data_${date}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="main-layout py-8" style={{ background: 'var(--bg-color)' }}>
      
      <div className="max-w-[1600px] mx-auto w-full px-6">
        {/* Header section */}
        <div className="flex justify-between items-start mb-6">
          <div>
            <h2 className="text-2xl font-bold text-slate-800 m-0">Market Wise Price & Arrival</h2>
            <p className="text-sm font-medium text-blue-600 mt-1">
              (MSP Commodities & Tomato, Onion, Potato)
            </p>
          </div>
          <div className="flex gap-2">
            <button 
              onClick={() => window.print()}
              className="bg-blue-600 hover:bg-blue-700 text-white border-none px-4 py-2 rounded-md cursor-pointer flex items-center gap-2 text-sm font-medium transition-colors"
            >
              <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z"></path></svg>
               Print
            </button>
            <button 
              onClick={handleDownloadCSV}
              className="bg-emerald-600 hover:bg-emerald-700 text-white border-none px-4 py-2 rounded-md cursor-pointer flex items-center gap-2 text-sm font-medium transition-colors">
              <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"></path></svg>
               Download
            </button>
          </div>
        </div>

        {isFilterLoading ? (
          <div style={{ padding: '40px 0', color: 'var(--text-secondary)' }}>Loading filters...</div>
        ) : (
          <AgmarknetFilters 
            filters={filters} 
            filterData={filterData}
            onFilterChange={handleFilterChange} 
            onReset={handleReset} 
            date={date}
            onDateChange={setDate}
          />
        )}
        
        <main style={{ marginTop: '24px' }}>
        {error && (
          <div style={{ marginBottom: '16px', padding: '16px', background: '#fef2f2', border: '1px solid #fecaca', color: '#991b1b', borderRadius: '8px' }}>
            <strong>Live refresh is temporarily unavailable:</strong> {error}
          </div>
        )}
        {isLoading ? (
          <div className="flex flex-col justify-center items-center py-32 space-y-4">
            <div className="animate-spin rounded-full h-12 w-12 border-4 border-blue-100 border-t-blue-600"></div>
            <p className="text-gray-500 font-medium">Loading market data...</p>
          </div>
        ) : (
          <div style={{ flex: 1, overflowY: 'visible' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
              <AgmarknetTable data={tableData} filters={filters} filterData={filterData} />
            </div>
          </div>
        )}
        </main>
        
        {/* Attribution Footer */}
        <div className="mt-8 text-center border-t border-gray-200 pt-6 pb-2">
          <p className="text-xs text-gray-400 font-medium">
            Data sourced from the public Agmarknet Portal (<a href="https://agmarknet.gov.in" target="_blank" rel="noopener noreferrer" className="hover:text-blue-500 transition-colors">agmarknet.gov.in</a>)
          </p>
        </div>
      </div>
    </div>
  );
};
