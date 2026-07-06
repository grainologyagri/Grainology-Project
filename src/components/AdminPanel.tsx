import { useState, useEffect, useCallback } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { Profile, api } from '../lib/client';
import { LayoutDashboard, LogOut, Users, Package, Truck, TrendingUp, Cloud, FileText, ShoppingBag, Menu, X, BarChart3, MapPin, Settings, MessageSquare } from 'lucide-react';
// Commented out unused imports - can be restored if needed
// import { ClipboardCheck, Calculator, PackageCheck } from 'lucide-react';
import EnhancedDashboard from './admin/EnhancedDashboard';
import UserManagement from './admin/UserManagement';
import { AgmarknetDashboard } from './agmarknet/AgmarknetDashboard';
import CedaAgmarknetEmbed from './CedaAgmarknetEmbed';
import WeatherForecast from './WeatherForecast';
import LogisticsProviderManagement from './admin/LogisticsProviderManagement';
import AllPurchaseOrders from './admin/AllPurchaseOrders';
import AllSaleOrders from './admin/AllSaleOrders';
import ConfirmSalesOrderForm from './admin/ConfirmSalesOrderForm';
import ConfirmPurchaseOrderForm from './admin/ConfirmPurchaseOrderForm';
import AllConfirmedOrders from './admin/AllConfirmedOrders';
import CommodityVarietyManagement from './admin/CommodityVarietyManagement';
import WarehouseManagement from './admin/WarehouseManagement';
import LocationManagement from './admin/LocationManagement';
import { AnalyticsDashboard } from './admin/analytics';
import { DashboardCache } from '../lib/sessionStorage';
import SiteSettingsPanel from './admin/SiteSettingsPanel';
import ContactInquiriesPanel from './admin/ContactInquiriesPanel';
// Commented out unused component imports - can be restored if needed
// import OrderManagementEnhanced from './admin/OrderManagementEnhanced';
// import OfferOversight from './admin/OfferOversight';
// import QualityManagement from './admin/QualityManagement';
// import LogisticsManagement from './admin/LogisticsManagement';
// import Reports from './admin/Reports';
// import SupplierCommodityManagement from './admin/SupplierCommodityManagement';
// import CustomerCommoditySales from './admin/CustomerCommoditySales';
// import SupplyTransactionsView from './admin/SupplyTransactionsView';

type View = 'dashboard' | 'orders' | 'users' | 'offers' | 'quality' | 'logistics' | 'mandi' | 'ceda-agmarknet' | 'weather' | 'reports' | 'supplier-commodity' | 'customer-sales' | 'logistics-providers' | 'supply-transactions' | 'all-purchase-orders' | 'all-sale-orders' | 'confirm-sales-order' | 'confirm-purchase-order' | 'all-confirmed-orders' | 'commodity-variety-management' | 'warehouse-management' | 'location-management' | 'analytics' | 'site-settings' | 'contact-inquiries';

const VIEW_KEYS: View[] = ['dashboard', 'orders', 'users', 'offers', 'quality', 'logistics', 'mandi', 'ceda-agmarknet', 'weather', 'reports', 'supplier-commodity', 'customer-sales', 'logistics-providers', 'supply-transactions', 'all-purchase-orders', 'all-sale-orders', 'confirm-sales-order', 'confirm-purchase-order', 'all-confirmed-orders', 'commodity-variety-management', 'warehouse-management', 'location-management', 'analytics', 'site-settings', 'contact-inquiries'];
function isView(s: string | null): s is View {
  return s !== null && VIEW_KEYS.includes(s as View);
}

interface AdminPanelProps {
  profile: Profile;
  onSignOut: () => void;
  signingOut: boolean;
}

interface PendingConfirmSaleOrder {
  id: string;
  commodity: string;
  variety?: string;
  quantity_mt: number;
  price_per_quintal: number;
  delivery_location: string;
  sauda_confirmation_date?: string;
  notes?: string;
  quality_report?: Record<string, string>;
  seller_id?: {
    id: string;
    name: string;
    trade_name?: string;
    email: string;
  };
}

interface PendingConfirmPurchaseOrder {
  id: string;
  commodity: string;
  variety?: string;
  quantity_mt: number;
  expected_price_per_quintal?: number;
  delivery_location: string;
  sauda_confirmation_date?: string;
  notes?: string;
  quality_requirements?: Record<string, string>;
  buyer_id?: {
    id: string;
    name: string;
    trade_name?: string;
    email: string;
  };
}

const DEFAULT_ADMIN_STATS = {
  totalUsers: 0,
  totalFarmers: 0,
  totalTraders: 0,
  totalCorporates: 0,
  totalFpos: 0,
  totalMillers: 0,
  totalFinancers: 0,
  totalAdmins: 0,
  totalSuperAdmins: 0,
  verifiedUsers: 0,
  pendingApprovalUsers: 0,
  locationPendingCount: 0,
  locationApprovedCount: 0,
  locationDeclinedCount: 0,
  warehousePendingCount: 0,
  warehouseApprovedCount: 0,
  warehouseDeclinedCount: 0,
  confirmedOrdersPendingCount: 0,
  confirmedOrdersApprovedCount: 0,
  confirmedOrdersDeclinedCount: 0,
  totalPurchaseOrders: 0,
  totalSaleOrders: 0,
  totalConfirmedSalesOrders: 0,
  totalConfirmedPurchaseOrders: 0,
  totalConfirmedSalesAmount: 0,
  totalConfirmedPurchaseAmount: 0,
};

const normalizeAdminStats = (statsLike?: any) => ({
  ...DEFAULT_ADMIN_STATS,
  ...(statsLike || {}),
});

export default function AdminPanel({ profile, onSignOut, signingOut }: AdminPanelProps) {
  if (!profile) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading profile...</p>
        </div>
      </div>
    );
  }
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const viewFromUrl = searchParams.get('view');
  const [currentView, setCurrentView] = useState<View>(() => (isView(viewFromUrl) ? viewFromUrl : 'dashboard'));
  const [users, setUsers] = useState<Profile[]>([]);
  const [usersLoaded, setUsersLoaded] = useState(false);
  const [dataVersion, setDataVersion] = useState<number>(0);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState('');
  const [stats, setStats] = useState(DEFAULT_ADMIN_STATS);
  const [pendingConfirmSaleOrder, setPendingConfirmSaleOrder] = useState<PendingConfirmSaleOrder | null>(null);
  const [pendingConfirmPurchaseOrder, setPendingConfirmPurchaseOrder] = useState<PendingConfirmPurchaseOrder | null>(null);
  const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';
  const toVersionNumber = (value: unknown) => {
    const parsed = Number(value);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
  };
  const syncDataVersionCache = useCallback((nextVersion: number) => {
    if (!nextVersion) return;
    setDataVersion((prev) => (nextVersion > prev ? nextVersion : prev));
    DashboardCache.setAdminDataVersion(profile.id, nextVersion);
  }, [profile.id]);

  // Sync URL with currentView so refresh keeps same page
  useEffect(() => {
    const urlView = searchParams.get('view');
    if (isView(urlView) && urlView !== currentView) setCurrentView(urlView);
  }, [searchParams]);

  const getAuthToken = useCallback(async () => {
    const session = await api.auth.getSession();
    return session.data.session?.access_token || null;
  }, []);

  const fetchAdminStats = useCallback(async ({ force = false }: { force?: boolean } = {}) => {
    try {
      if (!force) {
        const cachedStats = DashboardCache.getAdminStatsData(profile.id);
        if (cachedStats) {
          setStats(normalizeAdminStats(cachedStats));
          return true;
        }
      }

      const token = await getAuthToken();

      if (!token) {
        setErrorMessage('You are not authenticated. Please sign in again.');
        return false;
      }

      const statsResponse = await fetch(`${apiUrl}/admin/stats`, {
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        }
      });

      if (!statsResponse.ok) {
        const errorData = await statsResponse.json().catch(() => ({}));
        setErrorMessage(`Unable to load dashboard stats (${statsResponse.status}). Please check API/auth.`);
        console.error('Stats fetch error:', statsResponse.status, errorData);
        setStats(DEFAULT_ADMIN_STATS);
        return false;
      }

      const statsData = await statsResponse.json();
      const normalizedStats = normalizeAdminStats({
        totalUsers: statsData.totalUsers || 0,
        totalFarmers: statsData.totalFarmers || 0,
        totalTraders: statsData.totalTraders || 0,
        totalCorporates: statsData.totalCorporates || 0,
        totalFpos: statsData.totalFpos || 0,
        totalMillers: statsData.totalMillers || 0,
        totalFinancers: statsData.totalFinancers || 0,
        totalAdmins: statsData.totalAdmins || 0,
        totalSuperAdmins: statsData.totalSuperAdmins || 0,
        verifiedUsers: statsData.verifiedUsers || 0,
        pendingApprovalUsers: statsData.pendingApprovalUsers ?? 0,
        locationPendingCount: statsData.locationPendingCount ?? 0,
        locationApprovedCount: statsData.locationApprovedCount ?? 0,
        locationDeclinedCount: statsData.locationDeclinedCount ?? 0,
        warehousePendingCount: statsData.warehousePendingCount ?? 0,
        warehouseApprovedCount: statsData.warehouseApprovedCount ?? 0,
        warehouseDeclinedCount: statsData.warehouseDeclinedCount ?? 0,
        confirmedOrdersPendingCount: statsData.confirmedOrdersPendingCount ?? 0,
        confirmedOrdersApprovedCount: statsData.confirmedOrdersApprovedCount ?? 0,
        confirmedOrdersDeclinedCount: statsData.confirmedOrdersDeclinedCount ?? 0,
        totalPurchaseOrders: statsData.totalPurchaseOrders || 0,
        totalSaleOrders: statsData.totalSaleOrders || 0,
        totalConfirmedSalesOrders: statsData.totalConfirmedSalesOrders || 0,
        totalConfirmedPurchaseOrders: statsData.totalConfirmedPurchaseOrders || 0,
        totalConfirmedSalesAmount: statsData.totalConfirmedSalesAmount || 0,
        totalConfirmedPurchaseAmount: statsData.totalConfirmedPurchaseAmount || 0,
      });

      setErrorMessage('');
      setStats(normalizedStats);
      DashboardCache.setAdminStatsData(profile.id, normalizedStats);
      syncDataVersionCache(toVersionNumber(statsData.dataVersion));
      return true;
    } catch (error) {
      console.error('Error loading admin stats:', error);
      setErrorMessage('Failed to load dashboard data. Please check your connection and API.');
      return false;
    }
  }, [apiUrl, getAuthToken, profile.id, syncDataVersionCache]);

  const fetchAdminUsers = useCallback(async ({ force = false }: { force?: boolean } = {}) => {
    try {
      if (!force) {
        const cachedUsers = DashboardCache.getAdminUsersData(profile.id) as Profile[] | null;
        if (Array.isArray(cachedUsers)) {
          setUsers(cachedUsers);
          setUsersLoaded(true);
          return true;
        }
      }

      const token = await getAuthToken();
      if (!token) {
        setErrorMessage('You are not authenticated. Please sign in again.');
        return false;
      }

      const usersResponse = await fetch(`${apiUrl}/admin/users`, {
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        }
      });

      if (!usersResponse.ok) {
        const errorData = await usersResponse.json().catch(() => ({}));
        setErrorMessage('Unable to load users. Please check API/auth.');
        console.error('Users fetch error:', usersResponse.status, errorData);
        return false;
      }

      const usersData = await usersResponse.json();
      setErrorMessage('');
      setUsers(usersData);
      setUsersLoaded(true);
      DashboardCache.setAdminUsersData(profile.id, usersData);
      return true;
    } catch (error) {
      console.error('Error loading users:', error);
      setErrorMessage('Failed to load users. Please check your connection and API.');
      return false;
    }
  }, [apiUrl, getAuthToken, profile.id]);

  const checkForAdminUpdates = useCallback(async () => {
    try {
      const token = await getAuthToken();
      if (!token) return;

      const versionResponse = await fetch(`${apiUrl}/admin/data-version`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (!versionResponse.ok) return;

      const versionData = await versionResponse.json();
      const nextVersion = toVersionNumber(versionData.dataVersion);
      if (!nextVersion) return;

      const cachedVersion = toVersionNumber(DashboardCache.getAdminDataVersion(profile.id)?.dataVersion);
      const currentMaxVersion = Math.max(cachedVersion, dataVersion);

      if (nextVersion > currentMaxVersion) {
        syncDataVersionCache(nextVersion);
        await fetchAdminStats({ force: true });
        if (usersLoaded || currentView === 'users') {
          await fetchAdminUsers({ force: true });
        }
      }
    } catch (error) {
      console.error('Admin update polling error:', error);
    }
  }, [
    apiUrl,
    getAuthToken,
    profile.id,
    dataVersion,
    usersLoaded,
    currentView,
    fetchAdminStats,
    fetchAdminUsers,
    syncDataVersionCache
  ]);

  const loadData = useCallback(async () => {
    await fetchAdminStats({ force: true });
    await fetchAdminUsers({ force: true });
  }, [fetchAdminStats, fetchAdminUsers]);

  useEffect(() => {
    const cachedStats = DashboardCache.getAdminStatsData(profile.id);
    const cachedUsers = DashboardCache.getAdminUsersData(profile.id) as Profile[] | null;
    const cachedVersion = toVersionNumber(DashboardCache.getAdminDataVersion(profile.id)?.dataVersion);

    if (cachedStats) {
      setStats(normalizeAdminStats(cachedStats));
      setLoading(false);
    }
    if (Array.isArray(cachedUsers)) {
      setUsers(cachedUsers);
      setUsersLoaded(true);
    }
    if (cachedVersion) {
      setDataVersion(cachedVersion);
    }

    let active = true;
    const bootstrap = async () => {
      if (!cachedStats) {
        await fetchAdminStats({ force: true });
      }
      if (active) {
        setLoading(false);
      }
      await checkForAdminUpdates();
    };

    void bootstrap();

    const pollTimer = setInterval(() => {
      void checkForAdminUpdates();
    }, 15000);

    return () => {
      active = false;
      clearInterval(pollTimer);
    };
  }, [profile.id, fetchAdminStats, checkForAdminUpdates]);

  useEffect(() => {
    if (currentView !== 'users') return;
    if (usersLoaded) return;
    setLoading(true);
    void fetchAdminUsers().finally(() => setLoading(false));
  }, [currentView, usersLoaded, fetchAdminUsers]);


  const handleViewChange = (view: View) => {
    setCurrentView(view);
    setSearchParams({ view });
    setIsMobileMenuOpen(false);
  };

  const handleManualConfirmSalesOrder = () => {
    setPendingConfirmSaleOrder(null);
    handleViewChange('confirm-sales-order');
  };

  const handleManualConfirmPurchaseOrder = () => {
    setPendingConfirmPurchaseOrder(null);
    handleViewChange('confirm-purchase-order');
  };

  const handleVerifySaleOrder = (order: PendingConfirmSaleOrder) => {
    setPendingConfirmSaleOrder(order);
    handleViewChange('confirm-sales-order');
  };

  const handleVerifyPurchaseOrder = (order: PendingConfirmPurchaseOrder) => {
    setPendingConfirmPurchaseOrder(order);
    handleViewChange('confirm-purchase-order');
  };

  const navButtonClass = (view: View) =>
    `w-full flex items-center justify-start gap-3 px-4 py-2.5 rounded-lg text-sm transition-colors ${
      currentView === view ? 'bg-slate-700 text-white' : 'text-slate-300 hover:bg-slate-700/50'
    }`;

  const handleUserUpdated = useCallback((userId: string, updates: Partial<Profile>) => {
    if (!userId) return;
    setUsers(prev => {
      const nextUsers = prev.map(u => {
        const id = String((u as any).id ?? (u as any)._id ?? '');
        return id === String(userId) ? { ...u, ...updates } : u;
      });
      DashboardCache.setAdminUsersData(profile.id, nextUsers);
      return nextUsers;
    });
  }, [profile.id]);

  return (
    <div className="flex h-screen bg-gray-50">
      <aside className={`fixed md:static inset-y-0 left-0 z-50 w-72 bg-gradient-to-b from-slate-800 to-slate-900 shadow-xl flex flex-col transform transition-transform duration-300 ease-in-out ${
        isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'
      }`}>
        <div className="p-6 border-b border-slate-700 flex-shrink-0">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-white">Grainology</h1>
              <p className="text-sm text-slate-300 mt-1">{profile?.name || 'Admin User'}</p>
              <p className="text-xs text-slate-400">{profile?.role === 'super_admin' ? 'Super Admin' : (profile?.role || 'Admin')} Panel</p>
            </div>
            <button
              onClick={() => setIsMobileMenuOpen(false)}
              className="md:hidden text-white hover:bg-slate-700 p-2 rounded-lg"
            >
              <X className="w-6 h-6" />
            </button>
          </div>
        </div>

        <nav className="p-4 space-y-2 flex-1 overflow-y-auto">
          {/* 1. Dashboard */}
          <button
            onClick={() => handleViewChange('dashboard')}
            className={navButtonClass('dashboard')}
          >
            <LayoutDashboard className="w-5 h-5" />
            <span className="font-medium text-sm">Dashboard</span>
          </button>

          {/* Analytics Dashboard */}
          <button
            onClick={() => handleViewChange('analytics')}
            className={navButtonClass('analytics')}
          >
            <BarChart3 className="w-5 h-5" />
            <span className="font-medium text-sm">Analytics & Reports</span>
          </button>

          {/* 2. User Management */}
          <button
            onClick={() => handleViewChange('users')}
            className={navButtonClass('users')}
          >
            <Users className="w-5 h-5" />
            <span className="font-medium text-sm">User Management</span>
          </button>

          {/* 3. All Purchase Orders */}
          <button
            onClick={() => handleViewChange('all-purchase-orders')}
            className={navButtonClass('all-purchase-orders')}
          >
            <Package className="w-5 h-5" />
            <span className="font-medium text-sm">All Purchase Orders</span>
          </button>

          {/* 4. All Sale Orders */}
          <button
            onClick={() => handleViewChange('all-sale-orders')}
            className={navButtonClass('all-sale-orders')}
          >
            <ShoppingBag className="w-5 h-5" />
            <span className="font-medium text-sm">All Sale Orders</span>
          </button>

          {/* 5. Confirm Sales Order Form */}
          <button
            onClick={handleManualConfirmSalesOrder}
            className={navButtonClass('confirm-sales-order')}
          >
            <FileText className="w-5 h-5" />
            <span className="font-medium text-sm">Confirm Sales Order</span>
          </button>

          {/* 6. Confirm Purchase Order Form */}
          <button
            onClick={handleManualConfirmPurchaseOrder}
            className={navButtonClass('confirm-purchase-order')}
          >
            <FileText className="w-5 h-5" />
            <span className="font-medium text-sm">Confirm Purchase Order</span>
          </button>

          {/* 7. All Confirmed Orders */}
          <button
            onClick={() => handleViewChange('all-confirmed-orders')}
            className={navButtonClass('all-confirmed-orders')}
          >
            <FileText className="w-5 h-5" />
            <span className="font-medium text-sm">All Confirmed Orders</span>
          </button>

          {/* 8. Mandi Bhav */}
          <button
            onClick={() => handleViewChange('mandi')}
            className={navButtonClass('mandi')}
          >
            <TrendingUp className="w-5 h-5" />
            <span className="font-medium text-sm">Mandi Bhaav</span>
          </button>

          {/* 9. CEDA Agri Market Data */}
          <button
            onClick={() => handleViewChange('ceda-agmarknet')}
            className={navButtonClass('ceda-agmarknet')}
          >
            <BarChart3 className="w-5 h-5" />
            <span className="font-medium text-sm">CEDA Agri Market Data</span>
          </button>

          {/* 10. Weather Forecast */}
          <button
            onClick={() => handleViewChange('weather')}
            className={navButtonClass('weather')}
          >
            <Cloud className="w-5 h-5" />
            <span className="font-medium text-sm">Weather Forecast</span>
          </button>

          {/* 10. Logistics Provider Management */}
          <button
            onClick={() => handleViewChange('logistics-providers')}
            className={navButtonClass('logistics-providers')}
          >
            <Truck className="w-5 h-5" />
            <span className="font-medium text-sm">Logistics Providers</span>
          </button>

          {/* 11. Commodity & Variety Management */}
          <button
            onClick={() => handleViewChange('commodity-variety-management')}
            className={navButtonClass('commodity-variety-management')}
          >
            <Package className="w-5 h-5" />
            <span className="font-medium text-sm">Commodity & Variety</span>
          </button>

          {/* 12. Warehouse Management */}
          <button
            onClick={() => handleViewChange('warehouse-management')}
            className={navButtonClass('warehouse-management')}
          >
            <Package className="w-5 h-5" />
            <span className="font-medium text-sm">Warehouse Management</span>
          </button>

          {/* 13. Location Management */}
          <button
            onClick={() => handleViewChange('location-management')}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${
              currentView === 'location-management'
                ? 'bg-slate-700 text-white'
                : 'text-slate-300 hover:bg-slate-700/50'
            }`}
          >
            <MapPin className="w-5 h-5" />
            <span className="font-medium text-sm">Location Management</span>
          </button>

          <button
            onClick={() => handleViewChange('site-settings')}
            className={navButtonClass('site-settings')}
          >
            <Settings className="w-5 h-5" />
            <span className="font-medium text-sm">Website Settings</span>
          </button>

          <button
            onClick={() => handleViewChange('contact-inquiries')}
            className={navButtonClass('contact-inquiries')}
          >
            <MessageSquare className="w-5 h-5" />
            <span className="font-medium text-sm">Contact Inquiries</span>
          </button>

          {/* ========== COMMENTED OUT - NOT IN USE ========== */}
          {/* 
          <button
            onClick={() => handleViewChange('orders')}
            className={navButtonClass('orders')}
          >
            <ClipboardCheck className="w-5 h-5" />
            <span className="font-medium text-sm">Orders & QC</span>
            {stats.pendingOrders > 0 && (
              <span className="ml-auto bg-orange-500 text-white text-xs font-bold px-2 py-1 rounded-full">
                {stats.pendingOrders}
              </span>
            )}
          </button>

          <button
            onClick={() => handleViewChange('offers')}
            className={navButtonClass('offers')}
          >
            <Package className="w-5 h-5" />
            <span className="font-medium text-sm">Offer Oversight</span>
          </button>

          <button
            onClick={() => handleViewChange('quality')}
            className={navButtonClass('quality')}
          >
            <Calculator className="w-5 h-5" />
            <span className="font-medium text-sm">Quality & Deductions</span>
          </button>

          <button
            onClick={() => handleViewChange('logistics')}
            className={navButtonClass('logistics')}
          >
            <Truck className="w-5 h-5" />
            <span className="font-medium text-sm">Logistics</span>
          </button>

          <button
            onClick={() => handleViewChange('supplier-commodity')}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${
              currentView === 'supplier-commodity'
                ? 'bg-slate-700 text-white'
                : 'text-slate-300 hover:bg-slate-700/50'
            }`}
          >
            <PackageCheck className="w-5 h-5" />
            <span className="font-medium">Supplier Commodity</span>
          </button>

          <button
            onClick={() => handleViewChange('supply-transactions')}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${
              currentView === 'supply-transactions'
                ? 'bg-slate-700 text-white'
                : 'text-slate-300 hover:bg-slate-700/50'
            }`}
          >
            <FileText className="w-5 h-5" />
            <span className="font-medium">Supply Transactions</span>
          </button>

          <button
            onClick={() => handleViewChange('customer-sales')}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${
              currentView === 'customer-sales'
                ? 'bg-slate-700 text-white'
                : 'text-slate-300 hover:bg-slate-700/50'
            }`}
          >
            <ShoppingBag className="w-5 h-5" />
            <span className="font-medium">Customer Sales</span>
          </button>

          <button
            onClick={() => handleViewChange('reports')}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${
              currentView === 'reports'
                ? 'bg-slate-700 text-white'
                : 'text-slate-300 hover:bg-slate-700/50'
            }`}
          >
            <FileText className="w-5 h-5" />
            <span className="font-medium">Reports</span>
          </button>
          */}
          {/* ========== END COMMENTED OUT ========== */}
        </nav>

        <div className="p-4 border-t border-slate-700 flex-shrink-0">
          <button
            onClick={async () => {
              console.log('📍 [AdminPanel] Sign out button clicked');
              try {
                await onSignOut();
                console.log('📍 [AdminPanel] onSignOut completed, navigating to /login');
                setTimeout(() => {
                  navigate('/login');
                }, 50);
              } catch (error) {
                console.error('📍 [AdminPanel] Sign out error:', error);
                localStorage.removeItem('auth_token');
                sessionStorage.clear();
                navigate('/login');
              }
            }}
            disabled={signingOut}
            className="w-full flex items-center gap-3 px-4 py-3 rounded-lg text-red-400 hover:bg-slate-700/50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <LogOut className="w-5 h-5" />
            <span className="font-medium">
              {signingOut ? 'Signing Out...' : 'Sign Out'}
            </span>
          </button>
        </div>
      </aside>

      {isMobileMenuOpen && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 z-40 md:hidden"
          onClick={() => setIsMobileMenuOpen(false)}
        />
      )}

      <main className="flex-1 overflow-auto">
        <header className="bg-white shadow-sm border-b border-gray-200 p-4 md:p-6">
          <div className="flex items-center gap-4">
            <button
              onClick={() => setIsMobileMenuOpen(true)}
              className="md:hidden text-gray-600 hover:text-gray-900 p-2 -ml-2"
            >
              <Menu className="w-6 h-6" />
            </button>
            <h2 className="text-xl md:text-2xl font-bold text-gray-800 flex-1">
            {currentView === 'dashboard' && 'Admin Dashboard'}
            {currentView === 'analytics' && 'Analytics & Reports'}
            {currentView === 'users' && 'User Management'}
            {currentView === 'all-purchase-orders' && 'All Purchase Orders'}
            {currentView === 'all-sale-orders' && 'All Sale Orders'}
            {currentView === 'confirm-sales-order' && 'Confirm Sales Order'}
            {currentView === 'confirm-purchase-order' && 'Confirm Purchase Order'}
            {currentView === 'all-confirmed-orders' && 'All Confirmed Orders'}
            {currentView === 'mandi' && 'Mandi Bhaav - Market Prices'}
            {currentView === 'ceda-agmarknet' && 'CEDA Agri Market Data'}
            {currentView === 'weather' && 'Weather Forecast'}
            {currentView === 'logistics-providers' && 'Logistics Provider Management'}
            {currentView === 'commodity-variety-management' && 'Commodity & Variety Management'}
            {currentView === 'warehouse-management' && 'Warehouse Management'}
            {currentView === 'location-management' && 'Location Management'}
            {currentView === 'site-settings' && 'Website Settings'}
            {currentView === 'contact-inquiries' && 'Contact Inquiries'}
            {/* Commented out header titles for unused views */}
            {/* {currentView === 'orders' && 'Order Management & Quality Control'} */}
            {/* {currentView === 'offers' && 'Offer Oversight & Inventory'} */}
            {/* {currentView === 'quality' && 'Quality Management & Deductions'} */}
            {/* {currentView === 'logistics' && 'Logistics Management'} */}
            {/* {currentView === 'supplier-commodity' && 'Supplier Commodity Management'} */}
            {/* {currentView === 'supply-transactions' && 'Supply Transactions (Demo Data)'} */}
            {/* {currentView === 'customer-sales' && 'Customer Commodity Sales'} */}
            {/* {currentView === 'reports' && 'Reports & Analytics'} */}
            </h2>
          </div>
        </header>

        <div className="p-4 md:p-6">
          {loading && (
            <div className="mb-4 rounded-lg border border-blue-200 bg-blue-50 text-blue-800 p-4">
              Loading dashboard data...
            </div>
          )}
          {errorMessage && (
            <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 text-amber-800 p-4">
              {errorMessage}
            </div>
          )}
          {currentView === 'dashboard' && (
            <EnhancedDashboard
              userId={profile.id}
              dataVersion={dataVersion}
              stats={stats}
              onPendingApprovalClick={() => handleViewChange('users')}
            />
          )}
          {currentView === 'analytics' && (
            <AnalyticsDashboard />
          )}
          {currentView === 'users' && (
            <UserManagement
              users={users}
              onRefresh={loadData}
              onUserUpdated={handleUserUpdated}
              currentUserRole={profile.role}
              currentUserId={profile.id}
            />
          )}
          {currentView === 'all-purchase-orders' && (
            <AllPurchaseOrders currentUserRole={profile.role} onVerifyOrder={handleVerifyPurchaseOrder} />
          )}
          {currentView === 'all-sale-orders' && (
            <AllSaleOrders currentUserRole={profile.role} onVerifyOrder={handleVerifySaleOrder} />
          )}
          {currentView === 'confirm-sales-order' && (
            <ConfirmSalesOrderForm initialOrder={pendingConfirmSaleOrder} />
          )}
          {currentView === 'confirm-purchase-order' && (
            <ConfirmPurchaseOrderForm initialOrder={pendingConfirmPurchaseOrder} />
          )}
          {currentView === 'all-confirmed-orders' && (
            <AllConfirmedOrders currentUserRole={profile.role} dataVersion={dataVersion} />
          )}
          {currentView === 'mandi' && (
            <AgmarknetDashboard />
          )}
          {currentView === 'ceda-agmarknet' && (
            <CedaAgmarknetEmbed />
          )}
          {currentView === 'weather' && (
            <WeatherForecast />
          )}
          {currentView === 'logistics-providers' && (
            <LogisticsProviderManagement />
          )}
          {currentView === 'commodity-variety-management' && (
            <CommodityVarietyManagement currentUserRole={profile.role} />
          )}
          {currentView === 'warehouse-management' && (
            <WarehouseManagement currentUserRole={profile.role} dataVersion={dataVersion} />
          )}
          {currentView === 'location-management' && (
            <LocationManagement currentUserRole={profile.role} dataVersion={dataVersion} />
          )}
          {currentView === 'site-settings' && (
            <SiteSettingsPanel />
          )}
          {currentView === 'contact-inquiries' && (
            <ContactInquiriesPanel />
          )}
          {/* ========== COMMENTED OUT - NOT IN USE ========== */}
          {/* 
          {currentView === 'orders' && (
            <OrderManagementEnhanced orders={orders} onRefresh={loadData} />
          )}
          {currentView === 'offers' && (
            <OfferOversight offers={offers} onRefresh={loadData} />
          )}
          {currentView === 'quality' && (
            <QualityManagement />
          )}
          {currentView === 'logistics' && (
            <LogisticsManagement />
          )}
          {currentView === 'supplier-commodity' && (
            <SupplierCommodityManagement />
          )}
          {currentView === 'supply-transactions' && (
            <SupplyTransactionsView />
          )}
          {currentView === 'customer-sales' && (
            <CustomerCommoditySales />
          )}
          {currentView === 'reports' && (
            <Reports />
          )}
          */}
          {/* ========== END COMMENTED OUT ========== */}
        </div>
      </main>
    </div>
  );
}
