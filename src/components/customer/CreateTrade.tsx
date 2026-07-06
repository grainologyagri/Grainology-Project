import { useState, useEffect } from 'react';
import { Package, Calendar, ClipboardCheck, PlusCircle, IndianRupee } from 'lucide-react';
import { fetchCommodities, fetchVarieties } from '../../lib/commodityVariety';
import { useToast } from '../Toast';

interface TradeQualityParameter {
  id: string;
  s_no: number;
  parameter_name: string;
  unit_of_measurement: string;
  standard_value: string;
  actual_value: string;
  remarks: string;
  options: string[];
}

const toTitleCase = (value: string) =>
  value
    .toLowerCase()
    .split(' ')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');

interface CreateTradeProps {
  qualityParams: unknown[];
  onCreateOffer: (offerData: any) => Promise<{ error: any }>;
  userRole: 'farmer' | 'trader';
  userId: string;
}

export default function CreateTrade({ userId }: CreateTradeProps) {
  const { showSuccess, showError } = useToast();
  const [tradeType, setTradeType] = useState<'sell' | 'buy'>('sell');
  const [commodity, setCommodity] = useState('');
  const [variety, setVariety] = useState('');
  const [quantityMt, setQuantityMt] = useState<number>(0);
  const [pricePerQuintal, setPricePerQuintal] = useState<number>(0);
  const [address, setAddress] = useState('');
  const [saudaDate, setSaudaDate] = useState('');
  const [qualityTerms, setQualityTerms] = useState('');
  const [qualityReport, setQualityReport] = useState<Record<string, string>>({});
  const [qualityParameters, setQualityParameters] = useState<TradeQualityParameter[]>([]);
  const [qualityParametersLoading, setQualityParametersLoading] = useState(false);
  const [agreeToTerms, setAgreeToTerms] = useState(false);
  const [loading, setLoading] = useState(false);

  const [commodities, setCommodities] = useState<string[]>([]);
  const [varieties, setVarieties] = useState<string[]>([]);

  // Fetch commodities on mount
  useEffect(() => {
    fetchCommodities().then(setCommodities).catch(() => {
      // Fallback to static defaults on error
      setCommodities(['Paddy', 'Maize', 'Wheat']);
    });
  }, []);

  // Fetch varieties when commodity changes
  useEffect(() => {
    if (commodity) {
      fetchVarieties(commodity).then(setVarieties).catch(() => {
        // Fallback to static defaults on error
        // setVarieties(COMMODITY_VARIETIES[toTitleCase(commodity)] || []);
      });
      setVariety(''); // Reset variety when commodity changes
    } else {
      setVarieties([]);
    }
  }, [commodity]);

  // Update Quality Parameters based on Commodity selection
  useEffect(() => {
    let cancelled = false;

    const loadQualityParameters = async () => {
      if (!commodity) {
        setQualityParameters([]);
        setQualityReport({});
        return;
      }

      setQualityParametersLoading(true);
      setQualityParameters([]);
      setQualityReport({});

      const qualityCommodity = toTitleCase(commodity);
      const token = localStorage.getItem('auth_token');

      if (!token) {
        showError('Authentication token not found. Please sign in again.');
        setQualityParametersLoading(false);
        return;
      }

      const queryParams = new URLSearchParams({
        commodity: qualityCommodity,
        is_active: 'true',
        sort: JSON.stringify({ s_no: 1 })
      });

      try {
        const response = await fetch(`/api/quality?${queryParams.toString()}`, {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Accept': 'application/json'
          }
        });

        if (cancelled) return;

        if (!response.ok) {
          const error = await response.json().catch(() => ({}));
          showError(error.error || 'Failed to load quality parameters');
          setQualityParametersLoading(false);
          return;
        }

        const data = await response.json();

        const params: TradeQualityParameter[] = (data || []).map((param: any, index: number) => {
          const parameterName = param.parameter_name || param.param_name || '';
          const unitOfMeasurement = param.unit_of_measurement || param.unit || '';
          const standardValue = param.standard_value || param.standard || '';
          const options = Array.isArray(param.options) && param.options.length > 0
            ? param.options
            : [standardValue].filter(Boolean);

          return {
            id: param.id || `${commodity}-${index}`,
            s_no: param.s_no || index + 1,
            parameter_name: parameterName,
            unit_of_measurement: unitOfMeasurement,
            standard_value: standardValue,
            actual_value: options[0] || '',
            remarks: param.remarks || '',
            options
          };
        });

        setQualityParameters(params);

        const initialReport: Record<string, string> = {};
        params.forEach(p => {
          initialReport[p.parameter_name] = p.actual_value;
        });
        setQualityReport(initialReport);
        setQualityParametersLoading(false);
      } catch (error: any) {
        if (!cancelled) {
          showError(error.message || 'Failed to load quality parameters');
          setQualityParametersLoading(false);
        }
      }
    };

    loadQualityParameters();

    return () => {
      cancelled = true;
    };
  }, [commodity]);

  const handleQualityChange = (paramName: string, value: string) => {
    setQualityReport(prev => ({
      ...prev,
      [paramName]: value,
    }));
    
    // Also update the qualityParameters state to keep UI in sync
    setQualityParameters(prev =>
      prev.map(p => p.parameter_name === paramName ? { ...p, actual_value: value } : p)
    );
  };


  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!agreeToTerms) {
      showError('Please agree to the terms and conditions to continue');
      return;
    }
    setLoading(true);

    try {
      const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';
      const token = localStorage.getItem('auth_token');

      if (!token) {
        showError('Authentication token not found. Please sign in again.');
        setLoading(false);
        return;
      }

      let endpoint = '';
      let data: any = {
        commodity,
        variety,
        quantity_mt: quantityMt,
        delivery_location: address,
        sauda_confirmation_date: saudaDate || null,
        notes: qualityTerms,
      };

      if (tradeType === 'sell') {
        endpoint = `${apiUrl}/sale-orders`;
        data.price_per_quintal = pricePerQuintal / 10;
        data.quality_report = qualityReport;
        data.seller_id = userId;
      } else {
        endpoint = `${apiUrl}/purchase-orders`;
        data.expected_price_per_quintal = pricePerQuintal / 10;
        data.quality_requirements = qualityReport;
        data.buyer_id = userId;
      }

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        const errorData = await response.json();
        showError(errorData.error || `Failed to create ${tradeType} order. Please try again.`);
      } else {
        // Success message
        showSuccess(`${tradeType === 'sell' ? 'Sale' : 'Purchase'} order created successfully!`);
        
        // Reset form
        setCommodity('Paddy');
        setVariety('');
        setQuantityMt(0);
        setPricePerQuintal(0);
        setAddress('');
        setSaudaDate('');
        setQualityTerms('');
        setQualityReport({});
        setAgreeToTerms(false);
      }
    } catch (err: any) {
      showError(err.message || `Failed to create ${tradeType} order. Please check your connection and try again.`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-7xl mx-auto">
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gray-900 mb-2 flex items-center gap-3">
          <PlusCircle className="w-8 h-8 text-green-600" />
          Create Trade
        </h1>
        <p className="text-gray-600">
          Create your own negotiable trade. Sell or buy commodities at your convenience and price.
          <a href="#" className="text-green-600 hover:text-green-700 ml-1 font-medium">Learn How</a>
        </p>
      </div>

      <div className="max-w-5xl mx-auto">
        <div>
          <div className="bg-white rounded-lg shadow">
            <div className="p-6 border-b border-gray-200">
              <h2 className="text-lg font-semibold text-gray-800 mb-4">Tell us about your requirements</h2>

              <div className="flex gap-4 mb-6">
                <button
                  type="button"
                  onClick={() => setTradeType('sell')}
                  className={`px-6 py-2 rounded-lg font-medium transition-colors ${
                    tradeType === 'sell'
                      ? 'bg-green-600 text-white'
                      : 'bg-white border-2 border-gray-300 text-gray-700 hover:border-green-600'
                  }`}
                >
                  I want to Sell
                </button>
                <button
                  type="button"
                  onClick={() => setTradeType('buy')}
                  className={`px-6 py-2 rounded-lg font-medium transition-colors ${
                    tradeType === 'buy'
                      ? 'bg-green-600 text-white'
                      : 'bg-white border-2 border-gray-300 text-gray-700 hover:border-green-600'
                  }`}
                >
                  I want to Buy
                </button>
              </div>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-6">
              {/* 1. Commodity Selection First */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    <span className="text-gray-900">1. Commodity: (Drop Down)</span>
                  </label>
                  <div className="relative">
                    <Package className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                    <select
                      value={commodity}
                      onChange={(e) => setCommodity(e.target.value)}
                      required
                      className="w-full pl-12 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent text-lg appearance-none"
                    >
                      <option value="">Select Commodity</option>
                      {commodities.map((c) => (
                        <option key={c} value={c}>{c}</option>
                      ))}
                    </select>
                  </div>
                  <p className="text-sm text-gray-600 mt-1">Paddy/Maize/Wheat</p>
                </div>

                {/* Variety selection */}
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    <span className="text-gray-900">Variety: (Drop Down)</span>
                  </label>
                  <select
                    value={variety}
                    onChange={(e) => setVariety(e.target.value)}
                    required
                    disabled={!commodity}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent text-lg appearance-none disabled:bg-gray-100"
                  >
                    <option value="">Select Variety</option>
                    {varieties.map((v) => (
                      <option key={v} value={v}>
                        {v}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* 2. Choose Date */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  <span className="text-gray-900">2. Date: DD/MM/YYYY</span>
                  <span className="text-gray-600 font-normal ml-2">(Date of Sauda confirmation)</span>
                </label>
                <div className="relative">
                  <Calendar className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                  <input
                    type="date"
                    value={saudaDate}
                    onChange={(e) => setSaudaDate(e.target.value)}
                    required
                    className="w-full pl-12 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent text-lg"
                  />
                </div>
              </div>

              {/* 3, 4, 5. Unit, Rate, Quantity */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    <span className="text-gray-900">3. Unit of Measurement</span>
                  </label>
                  <select
                    value="MT"
                    disabled
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent text-lg font-semibold appearance-none bg-gray-50"
                  >
                    <option value="MT">MT</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    <span className="text-gray-900">4. Rate per MT (INR)*</span>
                  </label>
                  <div className="relative">
                    <IndianRupee className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                    <input
                      type="number"
                      value={pricePerQuintal || ''}
                      onChange={(e) => setPricePerQuintal(Number(e.target.value))}
                      required
                      min="0"
                      step="0.01"
                      className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent text-lg font-bold"
                      placeholder="Enter rate"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    <span className="text-gray-900">5. Quantity (MT)*</span>
                  </label>
                  <input
                    type="number"
                    value={quantityMt || ''}
                    onChange={(e) => setQuantityMt(Number(e.target.value))}
                    required
                    min="0"
                    step="0.01"
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent text-lg font-bold"
                    placeholder="Enter quantity"
                  />
                </div>
              </div>

              {/* 6. Quality Parameters (Particulars Section) */}
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <ClipboardCheck className="w-6 h-6 text-green-600" />
                  <label className="text-sm font-semibold text-gray-700">
                    <span className="text-gray-900">6. Quality Parameters (Particulars Section):</span>
                  </label>
                </div>

                {commodity ? (
                  <div className="bg-gradient-to-r from-green-50 to-blue-50 p-4 rounded-lg border-2 border-green-200 mb-4">
                    <p className="text-sm font-semibold text-green-800 mb-2">
                      ✓ Quality parameters auto-populated for {commodity}
                    </p>
                    <p className="text-xs text-gray-600">
                      Select the appropriate value for each parameter from the dropdowns below.
                    </p>
                  </div>
                ) : (
                  <div className="bg-yellow-50 p-4 rounded-lg border border-yellow-200 mb-4">
                    <p className="text-sm text-yellow-800">
                      Please select a commodity to view quality parameters
                    </p>
                  </div>
                )}

                {qualityParametersLoading && (
                  <div className="bg-white p-4 rounded-lg border border-gray-200 text-sm text-gray-600">
                    Loading quality parameters...
                  </div>
                )}

                {!qualityParametersLoading && commodity && qualityParameters.length === 0 && (
                  <div className="bg-white p-4 rounded-lg border border-gray-200 text-sm text-gray-600">
                    No active quality parameters found for {commodity}.
                  </div>
                )}

                {!qualityParametersLoading && qualityParameters.length > 0 && (
                  <div className="border-2 border-gray-300 rounded-lg overflow-hidden">
                    {/* Table Header */}
                    <div className="bg-gray-800 text-white">
                      <div className="grid grid-cols-12 gap-2 px-4 py-3 font-semibold text-sm">
                        <div className="col-span-1">S No.</div>
                        <div className="col-span-3">Particulars</div>
                        <div className="col-span-2">UOM</div>
                        <div className="col-span-3">Standard</div>
                        <div className="col-span-3">Actual Value</div>
                      </div>
                    </div>

                    {/* Table Body */}
                    <div className="divide-y divide-gray-300">
                      {qualityParameters.map((param) => (
                        <div key={param.id} className="grid grid-cols-12 gap-2 px-4 py-3 bg-white hover:bg-gray-50">
                          <div className="col-span-1 flex items-center">
                            <span className="font-semibold text-gray-700">{param.s_no}</span>
                          </div>
                          <div className="col-span-3 flex items-center">
                            <span className="font-medium text-gray-900">{param.parameter_name}</span>
                          </div>
                          <div className="col-span-2 flex items-center">
                            <span className="text-gray-700">{param.unit_of_measurement}</span>
                          </div>
                          <div className="col-span-3 flex items-center text-xs text-gray-600">
                            {param.standard_value}
                          </div>
                          <div className="col-span-3 flex items-center">
                            <select
                              value={qualityReport[param.parameter_name] || ''}
                              onChange={(e) => handleQualityChange(param.parameter_name, e.target.value)}
                              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent bg-yellow-50 font-medium text-sm"
                            >
                              {param.options.map((opt: string) => (
                                <option key={opt} value={opt}>{opt}</option>
                              ))}
                            </select>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* 7. Address */}
              <div className="border-t border-gray-200 pt-6">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    <span className="text-gray-900">7. Address</span>
                  </label>
                  <input
                    type="text"
                    value={address}
                    onChange={(e) => setAddress(e.target.value)}
                    required
                    placeholder="Enter full address"
                    // className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent font-bold"
                  />
                </div>
              </div>

              {/* 8. Remarks */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  <span className="text-gray-900">8. Remarks</span>
                </label>
                <textarea
                  value={qualityTerms}
                  onChange={(e) => setQualityTerms(e.target.value)}
                  placeholder="Enter additional information, special instructions, or quality terms..."
                  rows={4}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent resize-none"
                />
              </div>

              <div className="flex items-start gap-2 pt-4">
                <input
                  type="checkbox"
                  id="terms"
                  checked={agreeToTerms}
                  onChange={(e) => setAgreeToTerms(e.target.checked)}
                  className="mt-1 h-4 w-4 text-green-600 focus:ring-green-500 border-gray-300 rounded"
                />
                <label htmlFor="terms" className="text-sm text-gray-600">
                  By creating this trade, I agree to share my contact information with the support representative.
                  I have read, understood and agreed to abide by{' '}
                  <a href="#" className="text-green-600 hover:text-green-700 font-medium">Grainology's Terms of Use.</a>
                </label>
              </div>

              <div className="flex gap-4">
                <button
                  type="button"
                  onClick={() => {
                    localStorage.setItem('draft_trade', JSON.stringify({
                      commodity, variety, quantityMt, pricePerQuintal, address
                    }));
                  }}
                  className="px-6 py-3 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors font-medium"
                >
                  Save as Draft
                </button>
                <button
                  type="submit"
                  disabled={loading || !agreeToTerms}
                  className="flex-1 bg-green-600 hover:bg-green-700 text-white font-medium py-3 px-4 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {loading ? 'Submitting...' : 'Submit'}
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}
