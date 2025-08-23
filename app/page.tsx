// pages/index.tsx
'use client'
import { useEffect, useState, useMemo } from 'react';
import { parseISO, format, isWithinInterval, startOfDay, endOfDay } from 'date-fns';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';

interface LogEntry {
  ip: string;
  timestamp: string;
  country: string;
  org: string;
  city: string;
  region: string;
}

interface StatsData {
  total_hits: number;
  unique_ips: string[];
  unique_countries: string[];
  daily_stats: Record<string, {
    new_hits: number;
    new_unique_ips: string[];
    new_unique_countries: string[];
  }>;
  last_processed_timestamp: string;
}

type SortField = 'timestamp' | 'ip' | 'country' | 'org' | 'city';
type SortDirection = 'asc' | 'desc';

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884D8', '#82CA9D'];

export default function Dashboard() {
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(50);
  const [selectedView, setSelectedView] = useState<'chart' | 'table'>('chart');
  const [isLoading, setIsLoading] = useState(false);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [showDateFilter, setShowDateFilter] = useState(false);
  const [sortField, setSortField] = useState<SortField>('timestamp');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');
  const [uniqueIPsOnly, setUniqueIPsOnly] = useState(false);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [statsData, setStatsData] = useState<StatsData | null>(null);
  async function getData() {
    try {
      const response = await fetch('https://api.medtalk.co/logs/logs');
      if (!response.ok) {
        throw new Error(`Failed to fetch data: ${response.status}`);
      }
      const logs = await response.json();
      setLogs(logs);
    } catch (error) {
      console.error('Error fetching logs:', error);
      setLogs([]);
    }
  }

  async function getStatsData() {
    try {
      const response = await fetch('https://api.medtalk.co/logs/stats');
      if (!response.ok) {
        throw new Error(`Failed to fetch stats data: ${response.status}`);
      }
      const stats = await response.json();
      setStatsData(stats);
    } catch (error) {
      console.error('Error fetching stats:', error);
      setStatsData(null);
    }
  }

  useEffect(() => {
    getData();
    getStatsData();
  }, []);
  // Debounce search for better performance
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search);
      setIsLoading(false);
    }, 300);

    return () => clearTimeout(timer);
  }, [search]);

  // Memoize filtered data for better performance
  const filteredLogs = useMemo(() => {
    let filtered = logs.filter((log) =>
      log.country.toLowerCase().includes(debouncedSearch.toLowerCase()) ||
      log.org.toLowerCase().includes(debouncedSearch.toLowerCase()) ||
      log.ip.includes(debouncedSearch)
    );

    // Apply date range filter if dates are selected
    if (startDate && endDate) {
      const start = startOfDay(new Date(startDate));
      const end = endOfDay(new Date(endDate));

      filtered = filtered.filter((log) => {
        const logDate = parseISO(log.timestamp);
        return isWithinInterval(logDate, { start, end });
      });
    }

    // Apply unique IPs filter if enabled
    if (uniqueIPsOnly) {
      const seenIPs = new Set<string>();
      filtered = filtered.filter((log) => {
        if (seenIPs.has(log.ip)) {
          return false;
        }
        seenIPs.add(log.ip);
        return true;
      });
    }

    return filtered;
  }, [logs, debouncedSearch, startDate, endDate, uniqueIPsOnly]);

  // Memoize sorted and paginated data
  const sortedAndPaginatedLogs = useMemo(() => {
    const sorted = [...filteredLogs];

    // Sort the data
    sorted.sort((a, b) => {
      let aValue: string | number;
      let bValue: string | number;

      switch (sortField) {
        case 'timestamp':
          aValue = parseISO(a.timestamp).getTime();
          bValue = parseISO(b.timestamp).getTime();
          break;
        case 'ip':
          aValue = a.ip;
          bValue = b.ip;
          break;
        case 'country':
          aValue = a.country;
          bValue = b.country;
          break;
        case 'org':
          aValue = a.org;
          bValue = b.org;
          break;
        case 'city':
          aValue = a.city;
          bValue = b.city;
          break;
        default:
          aValue = a.timestamp;
          bValue = b.timestamp;
      }

      if (sortDirection === 'asc') {
        return aValue > bValue ? 1 : -1;
      } else {
        return aValue < bValue ? 1 : -1;
      }
    });

    // Apply pagination
    const startIndex = (currentPage - 1) * itemsPerPage;
    return sorted.slice(startIndex, startIndex + itemsPerPage);
  }, [filteredLogs, sortField, sortDirection, currentPage, itemsPerPage]);

  // Memoize chart data
  const chartData = useMemo(() => {
    const countryCounts = filteredLogs.reduce((acc, log) => {
      acc[log.country] = (acc[log.country] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    return Object.entries(countryCounts)
      .map(([country, count]) => ({ country, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10); // Show top 10 countries
  }, [filteredLogs]);

  // Pagination
  const totalPages = Math.ceil(filteredLogs.length / itemsPerPage);

  // Stats
  const stats = useMemo(() => {
    const uniqueIPs = new Set(filteredLogs.map(log => log.ip)).size;
    const uniqueCountries = new Set(filteredLogs.map(log => log.country)).size;
    const totalHits = filteredLogs.length;

    return { uniqueIPs, uniqueCountries, totalHits };
  }, [filteredLogs]);

  // Global stats from API
  const globalStats = useMemo(() => {
    if (!statsData) return { totalHits: 0, uniqueUsers: 0, uniqueCountries: 0 };
    
    const totalHits = statsData.total_hits || 0;
    const uniqueUsers = statsData.unique_ips;
    const uniqueCountries = statsData.unique_countries ;
    
    console.log('API Stats:', {
      total_hits: totalHits,
      unique_users: statsData.unique_ips,
      unique_countries: statsData.unique_countries
    });
    
    return {
      totalHits,
      uniqueUsers,
      uniqueCountries
    };
  }, [statsData]);

  // Get min and max dates from logs for date picker limits
  const dateRange = useMemo(() => {
    const dates = logs.map(log => parseISO(log.timestamp));
    const minDate = new Date(Math.min(...dates.map(d => d.getTime())));
    const maxDate = new Date(Math.max(...dates.map(d => d.getTime())));
    return { minDate, maxDate };
  }, [logs]);

  const clearDateFilter = () => {
    setStartDate('');
    setEndDate('');
  };

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
    setCurrentPage(1); // Reset to first page when sorting
  };

  const getSortIcon = (field: SortField) => {
    if (sortField !== field) {
      return (
        <svg className="h-4 w-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4" />
        </svg>
      );
    }

    return sortDirection === 'asc' ? (
      <svg className="h-4 w-4 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
      </svg>
    ) : (
      <svg className="h-4 w-4 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
      </svg>
    );
  };

  return (
    <div className="min-h-screen">
      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-gray-800 mb-2">API Hit Log Dashboard</h1>
          <p className="text-2xl font-bold text-gray-600">MEDTALK</p>
        </div>



        {/* Global Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
          {/* Grand Total Hits */}
          <div className="bg-white rounded-xl shadow-lg p-6">
            <div className="flex items-center">
              <div className="p-3 rounded-full bg-blue-100">
                <svg className="h-5 w-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                </svg>
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Total Reports Generated</p>
                <p className="text-2xl font-bold text-gray-900">{(globalStats?.totalHits || 0).toLocaleString()}</p>
              </div>
            </div>
          </div>

          {/* All Time Users */}
          <div className="bg-white rounded-xl shadow-lg p-6">
            <div className="flex items-center">
              <div className="p-3 rounded-full bg-green-100">
                <svg className="h-5 w-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197m13.5-9a2.5 2.5 0 11-5 0 2.5 2.5 0 015 0z" />
                </svg>
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Total Unique Users</p>
                <p className="text-2xl font-bold text-gray-900">{(globalStats?.uniqueUsers || 0).toLocaleString()}</p>
              </div>
            </div>
          </div>

          {/* Total Countries */}
          <div className="bg-white rounded-xl shadow-lg p-6">
            <div className="flex items-center">
              <div className="p-3 rounded-full bg-purple-100">
                <svg className="h-5 w-5 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Total Countries</p>
                <p className="text-2xl font-bold text-gray-900">{globalStats?.uniqueCountries || 0}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Filterable Data Section */}
        <div className="mb-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-xl font-semibold text-gray-900">Filterable Data Analysis</h2>
              <p className="text-sm text-gray-600 mt-1">
                {startDate && endDate 
                  ? `Showing data from ${format(new Date(startDate), 'MMM dd, yyyy')} to ${format(new Date(endDate), 'MMM dd, yyyy')}`
                  : startDate 
                    ? `Showing data from ${format(new Date(startDate), 'MMM dd, yyyy')} onwards`
                    : endDate
                      ? `Showing data up to ${format(new Date(endDate), 'MMM dd, yyyy')}`
                      : 'Showing data for last 15 days'
                }
              </p>
            </div>
            {(startDate || endDate) && (
              <button
                onClick={clearDateFilter}
                className="px-3 py-1 text-sm text-red-600 hover:text-red-800 transition-colors border border-red-200 rounded-md hover:bg-red-50"
              >
                Clear All Filters
              </button>
            )}
          </div>
        </div>

        {/* Search and Filter Bar */}
        <div className="bg-white rounded-xl shadow-lg p-6 mb-8">
          <div className="space-y-4">
            {/* Search Input */}
            <div className="relative">
              <input
                type="text"
                placeholder="Search by IP, country, or organization..."
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setIsLoading(true);
                }}
                className="w-full px-4 py-3 pl-12 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
              {isLoading ? (
                <svg className="absolute left-4 top-3.5 h-4 w-4 text-blue-500 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
              ) : (
                <svg className="absolute left-4 top-3.5 h-4 w-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
              )}
            </div>

            {/* Filter Toggles */}
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-4">
                {/* Date Filter Toggle */}
                <button
                  onClick={() => setShowDateFilter(!showDateFilter)}
                  className="flex items-center px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
                >
                  <svg className="h-4 w-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                  {showDateFilter ? 'Hide Date Filter' : 'Show Date Filter'}
                </button>

                {/* Unique IPs Toggle */}
                <button
                  onClick={() => setUniqueIPsOnly(!uniqueIPsOnly)}
                  className={`flex items-center px-4 py-2 text-sm font-medium rounded-lg transition-colors ${uniqueIPsOnly
                    ? 'bg-blue-500 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }`}
                >
                  <svg className="h-4 w-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197m13.5-9a2.5 2.5 0 11-5 0 2.5 2.5 0 015 0z" />
                  </svg>
                  User Count Only
                </button>
              </div>

              {(startDate || endDate) && (
                <button
                  onClick={clearDateFilter}
                  className="px-3 py-1 text-sm text-red-600 hover:text-red-800 transition-colors"
                >
                  Clear Date Filter
                </button>
              )}
            </div>

            {/* Date Range Picker */}
            {showDateFilter && (
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4 p-4 bg-gray-50 rounded-lg">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Start Date</label>
                  <input
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    min={format(dateRange.minDate, 'yyyy-MM-dd')}
                    max={endDate || format(dateRange.maxDate, 'yyyy-MM-dd')}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">End Date</label>
                  <input
                    type="date"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    min={startDate || format(dateRange.minDate, 'yyyy-MM-dd')}
                    max={format(dateRange.maxDate, 'yyyy-MM-dd')}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div className="flex items-end">
                  <div className="text-sm text-gray-600">
                    <p>Available Data Range:</p>
                    <p>{format(dateRange.minDate, 'MMM dd, yyyy')} - {format(dateRange.maxDate, 'MMM dd, yyyy')}</p>
                  </div>
                </div>
                <div className="flex items-end">
                  <div className="text-sm text-gray-600">
                    <p>Selected Date Range:</p>
                    <p className="font-medium text-blue-600">
                      {startDate && endDate 
                        ? `${format(new Date(startDate), 'MMM dd, yyyy')} - ${format(new Date(endDate), 'MMM dd, yyyy')}`
                        : startDate 
                          ? `${format(new Date(startDate), 'MMM dd, yyyy')} - Select end date`
                          : endDate
                            ? `Select start date - ${format(new Date(endDate), 'MMM dd, yyyy')}`
                            : 'Select start and end dates'
                      }
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Filtered Data Metrics */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          {/* Total Page Views */}
          <div className="bg-white rounded-xl shadow-lg p-6">
            <div className="flex items-center">
              <div className="p-3 rounded-full bg-orange-100">
                <svg className="h-5 w-5 text-orange-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                </svg>
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Page Views</p>
                <p className="text-2xl font-bold text-gray-900">{stats.totalHits.toLocaleString()}</p>
              </div>
            </div>
          </div>

          {/* Geographic Reach */}
          <div className="bg-white rounded-xl shadow-lg p-6">
            <div className="flex items-center">
              <div className="p-3 rounded-full bg-teal-100">
                <svg className="h-5 w-5 text-teal-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Geographic Reach</p>
                <p className="text-2xl font-bold text-gray-900">{stats.uniqueCountries} Countries</p>
              </div>
            </div>
          </div>

          {/* Unique Visitors */}
          <div className="bg-white rounded-xl shadow-lg p-6">
            <div className="flex items-center">
              <div className="p-3 rounded-full bg-indigo-100">
                <svg className="h-5 w-5 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197m13.5-9a2.5 2.5 0 11-5 0 2.5 2.5 0 015 0z" />
                </svg>
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Unique Visitors</p>
                <p className="text-2xl font-bold text-gray-900">{stats.uniqueIPs.toLocaleString()}</p>
              </div>
            </div>
          </div>
        </div>

        {/* View Toggle */}
        <div className="bg-white rounded-xl shadow-lg p-6 mb-8">
          <div className="flex space-x-4 mb-6">
            <button
              onClick={() => setSelectedView('chart')}
              className={`px-4 py-2 rounded-lg font-medium transition-colors ${selectedView === 'chart'
                ? 'bg-blue-500 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
            >
              Chart View
            </button>
            <button
              onClick={() => setSelectedView('table')}
              className={`px-4 py-2 rounded-lg font-medium transition-colors ${selectedView === 'table'
                ? 'bg-blue-500 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
            >
              Table View
            </button>
          </div>

          {selectedView === 'chart' ? (
            <div className="space-y-6">
              <div className="bg-gray-50 rounded-lg p-6">
                <h3 className="text-lg font-semibold mb-4 text-gray-800">Top Countries by Hits</h3>
                <div className="h-80">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={chartData}>
                      <XAxis dataKey="country" />
                      <YAxis />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: 'white',
                          border: '1px solid #e5e7eb',
                          borderRadius: '8px',
                          boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
                          padding: '8px 12px'
                        }}
                        formatter={(value, name) => [`${value} hits`, name]}
                        labelFormatter={(label) => `${label}`}
                      />
                      <Bar dataKey="count" fill="#3B82F6" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>

              <div className="bg-gray-50 rounded-lg p-6">
                <h3 className="text-lg font-semibold mb-4 text-gray-800">Country Distribution</h3>
                <div className="h-96">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={chartData}
                        cx="50%"
                        cy="50%"
                        labelLine={true}
                        label={({ country, percent }) => {
                          const percentage = ((percent || 0) * 100).toFixed(1);
                          return parseFloat(percentage) > 2 ? `${country}\n${percentage}%` : '';
                        }}
                        outerRadius={120}
                        innerRadius={40}
                        fill="#8884d8"
                        dataKey="count"
                        paddingAngle={2}
                      >
                        {chartData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip
                        contentStyle={{
                          backgroundColor: 'white',
                          border: '1px solid #e5e7eb',
                          borderRadius: '8px',
                          boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
                          padding: '8px 12px'
                        }}
                        formatter={(value, name) => [`${value} hits`, name]}
                        labelFormatter={(label) => `${label}`}
                        cursor={{ fill: 'rgba(0, 0, 0, 0.1)' }}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                {/* Legend for small percentages */}
                <div className="mt-4 grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2">
                  {chartData.map((entry, index) => {
                    const percentage = ((entry.count / filteredLogs.length) * 100).toFixed(1);
                    if (parseFloat(percentage) <= 2) {
                      return (
                        <div key={entry.country} className="flex items-center space-x-2 text-sm">
                          <div
                            className="w-3 h-3 rounded-full"
                            style={{ backgroundColor: COLORS[index % COLORS.length] }}
                          />
                          <span className="text-gray-700">{entry.country}</span>
                          <span className="text-gray-500">({percentage}%)</span>
                        </div>
                      );
                    }
                    return null;
                  })}
                </div>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <h3 className="text-lg font-semibold text-gray-800">Log Entries</h3>
                <p className="text-sm text-gray-600">
                  Showing {((currentPage - 1) * itemsPerPage) + 1} to {Math.min(currentPage * itemsPerPage, filteredLogs.length)} of {filteredLogs.length} entries
                </p>
              </div>

              <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th
                          className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                          onClick={() => handleSort('ip')}
                        >
                          <div className="flex items-center space-x-1">
                            <span>IP Address</span>
                            {getSortIcon('ip')}
                          </div>
                        </th>
                        <th
                          className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                          onClick={() => handleSort('timestamp')}
                        >
                          <div className="flex items-center space-x-1">
                            <span>Timestamp UTC</span>
                            {getSortIcon('timestamp')}
                          </div>
                        </th>
                        <th
                          className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                          onClick={() => handleSort('country')}
                        >
                          <div className="flex items-center space-x-1">
                            <span>Country</span>
                            {getSortIcon('country')}
                          </div>
                        </th>
                        <th
                          className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                          onClick={() => handleSort('org')}
                        >
                          <div className="flex items-center space-x-1">
                            <span>Organization</span>
                            {getSortIcon('org')}
                          </div>
                        </th>
                        <th
                          className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                          onClick={() => handleSort('city')}
                        >
                          <div className="flex items-center space-x-1">
                            <span>City</span>
                            {getSortIcon('city')}
                          </div>
                        </th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {sortedAndPaginatedLogs.map((log, i) => (
                        <tr key={i} className="hover:bg-gray-50 transition-colors">
                          <td className="px-6 py-4 whitespace-nowrap text-sm font-mono text-gray-900">{log.ip}</td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                            {format(parseISO(log.timestamp), 'MMM dd, yyyy HH:mm')}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                              {log.country}
                            </span>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{log.org}</td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">{log.city}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <button
                      onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                      disabled={currentPage === 1}
                      className="px-3 py-2 text-sm font-medium text-gray-500 bg-white border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      Previous
                    </button>
                    <span className="text-sm text-gray-700">
                      Page {currentPage} of {totalPages}
                    </span>
                    <button
                      onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
                      disabled={currentPage === totalPages}
                      className="px-3 py-2 text-sm font-medium text-gray-500 bg-white border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      Next
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

