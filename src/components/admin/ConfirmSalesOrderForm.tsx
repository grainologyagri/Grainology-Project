import { useEffect, useRef, useState } from 'react';
import { Calendar, ClipboardCheck, FileText, IndianRupee, Package, Save } from 'lucide-react';
import { COMMODITY_VARIETIES } from '../../constants/commodityVarieties';
import { fetchCommodities, fetchVarieties } from '../../lib/commodityVariety';
import { useToastContext } from '../../contexts/ToastContext';

interface User {
  id: string;
  name: string;
  trade_name?: string;
  email: string;
}

interface InitialSaleOrder {
  id: string;
  commodity: string;
  variety?: string;
  quantity_mt: number;
  price_per_quintal: number;
  delivery_location: string;
  sauda_confirmation_date?: string;
  notes?: string;
  quality_report?: Record<string, string>;
  seller_id?: User;
}

interface ConfirmSalesOrderFormProps {
  initialOrder?: InitialSaleOrder | null;
}

interface QualityParameter {
  id: string;
  s_no: number;
  parameter_name: string;
  unit_of_measurement: string;
  standard_value: string;
  actual_value: string;
  options: string[];
}

interface QualityDeductionRow {
  parameterName: string;
  expectedValue: number;
  actualValue: number;
  excessPercentage: number;
  weightDeductionKg: number;
  deductionAmount: number;
}

const toUpperText = (value?: string | null) => String(value ?? '').trim().toUpperCase();

const toTitleCase = (value: string) =>
  value
    .toLowerCase()
    .split(' ')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');

const toDateInputValue = (value?: string | null) => {
  if (!value) return new Date().toISOString().slice(0, 10);
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return String(value).slice(0, 10);
  return parsed.toISOString().slice(0, 10);
};

const normalizeOption = (value?: string | null) => String(value ?? '').trim().toLowerCase();

const matchOption = (value: string | undefined, options: string[]) => {
  const normalizedValue = normalizeOption(value);
  if (!normalizedValue) return '';
  return options.find((option) => normalizeOption(option) === normalizedValue) || value || '';
};

const roundToTwo = (value: number) => Math.round((value + Number.EPSILON) * 100) / 100;

const parseQualityNumber = (value?: string | null) => {
  const match = String(value ?? '').match(/\d+(?:\.\d+)?/);
  if (!match) return null;

  const parsed = Number(match[0]);
  return Number.isFinite(parsed) ? parsed : null;
};

const formatCurrency = (value: number) =>
  value.toLocaleString('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 2
  });

export default function ConfirmSalesOrderForm({ initialOrder }: ConfirmSalesOrderFormProps) {
  const { showSuccess, showError } = useToastContext();
  const prefillSelectionRef = useRef<{ commodity: string; variety: string } | null>(null);
  const pendingQualityReportRef = useRef<Record<string, string> | null>(null);

  const [customers, setCustomers] = useState<User[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [commodities, setCommodities] = useState<string[]>(['Paddy', 'Maize', 'Wheat']);
  const [varieties, setVarieties] = useState<string[]>([]);

  const [customerId, setCustomerId] = useState('');
  const [transactionDate, setTransactionDate] = useState('');
  const [sellerName, setSellerName] = useState('');
  const [commodity, setCommodity] = useState('');
  const [variety, setVariety] = useState('');
  const [grossWeightMt, setGrossWeightMt] = useState<number>(0);
  const [tareWeightMt, setTareWeightMt] = useState<number>(0);
  const [netWeightMt, setNetWeightMt] = useState<number>(0);
  const [ratePerMt, setRatePerMt] = useState<number>(0);
  const [grossAmount, setGrossAmount] = useState<number>(0);
  const [deliveryLocation, setDeliveryLocation] = useState('');
  const [remarks, setRemarks] = useState('');

  const [qualityReport, setQualityReport] = useState<Record<string, string>>({});
  const [actualQualityValues, setActualQualityValues] = useState<Record<string, string>>({});
  const [qualityParameters, setQualityParameters] = useState<QualityParameter[]>([]);
  const [qualityParametersLoading, setQualityParametersLoading] = useState(false);

  const getDisplayName = (customer?: User | null) => {
    if (!customer) return '';
    const trade = String(customer.trade_name || '').trim();
    if (trade) return trade;
    if (customer.name) return customer.name;
    return customer.email || '';
  };

  useEffect(() => {
    fetchCustomers();
    fetchCommodities().then(setCommodities).catch(() => {
      setCommodities(['Paddy', 'Maize', 'Wheat']);
    });
  }, []);

  useEffect(() => {
    if (!initialOrder) return;

    const seller = initialOrder.seller_id;
    const selectedCommodity = matchOption(initialOrder.commodity, commodities);
    const selectedVariety = initialOrder.variety || '';

    prefillSelectionRef.current = {
      commodity: selectedCommodity,
      variety: selectedVariety
    };
    pendingQualityReportRef.current = initialOrder.quality_report || null;

    setCustomerId(seller?.id || '');
    setTransactionDate(toDateInputValue(initialOrder.sauda_confirmation_date));
    setSellerName(getDisplayName(seller));
    setCommodity(selectedCommodity);
    setVariety(selectedVariety);
    setGrossWeightMt(Number(initialOrder.quantity_mt) || 0);
    setTareWeightMt(3.50);
    setRatePerMt((Number(initialOrder.price_per_quintal) || 0) * 10);
    setDeliveryLocation(initialOrder.delivery_location || '');
    setRemarks(initialOrder.notes || '');
  }, [initialOrder]);

  useEffect(() => {
    if (!initialOrder || commodities.length === 0) return;

    const matchedCommodity = matchOption(initialOrder.commodity, commodities);
    if (!matchedCommodity || matchedCommodity === commodity) return;

    prefillSelectionRef.current = {
      commodity: matchedCommodity,
      variety: initialOrder.variety || ''
    };
    setCommodity(matchedCommodity);
  }, [initialOrder, commodities]);

  useEffect(() => {
    if (!initialOrder || varieties.length === 0) return;

    const matchedVariety = matchOption(initialOrder.variety, varieties);
    if (matchedVariety && matchedVariety !== variety) {
      setVariety(matchedVariety);
    }
  }, [initialOrder, varieties]);

  useEffect(() => {
    if (!commodity) {
      setVarieties([]);
      setVariety('');
      return;
    }

    fetchVarieties(commodity).then(setVarieties).catch(() => {
      setVarieties(COMMODITY_VARIETIES[commodity] || []);
    });

    if (prefillSelectionRef.current) {
      if (prefillSelectionRef.current.commodity === commodity) {
        setVariety(matchOption(prefillSelectionRef.current.variety, varieties));
        prefillSelectionRef.current = null;
      }
      return;
    }

    setVariety('');
  }, [commodity]);

  useEffect(() => {
    const net = grossWeightMt - tareWeightMt;
    setNetWeightMt(net > 0 ? roundToTwo(net) : 0);
  }, [grossWeightMt, tareWeightMt]);

  useEffect(() => {
    setGrossAmount(roundToTwo(netWeightMt * ratePerMt));
  }, [netWeightMt, ratePerMt]);

  useEffect(() => {
    let cancelled = false;

    const loadQualityParameters = async () => {
      if (!commodity) {
        setQualityParameters([]);
        setQualityReport({});
        setActualQualityValues({});
        return;
      }

      setQualityParametersLoading(true);
      setQualityParameters([]);
      setQualityReport({});
      setActualQualityValues({});

      const token = localStorage.getItem('auth_token');
      if (!token) {
        showError('Authentication required. Please sign in again.');
        setQualityParametersLoading(false);
        return;
      }

      const queryParams = new URLSearchParams({
        commodity: toTitleCase(commodity),
        is_active: 'true',
        sort: JSON.stringify({ s_no: 1 })
      });

      try {
        const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';
        const response = await fetch(`${apiUrl}/quality?${queryParams.toString()}`, {
          headers: {
            Authorization: `Bearer ${token}`,
            Accept: 'application/json'
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
        const params: QualityParameter[] = (data || []).map((param: any, index: number) => {
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
            options
          };
        });

        const initialReport: Record<string, string> = {};
        params.forEach((param) => {
          initialReport[param.parameter_name] = param.actual_value;
        });

        const mergedReport = {
          ...initialReport,
          ...(pendingQualityReportRef.current || {})
        };

        const initialActualValues: Record<string, string> = {};
        params.forEach((param) => {
          const savedValue = mergedReport[`${param.parameter_name} Actual Value (%)`];
          if (savedValue) initialActualValues[param.parameter_name] = savedValue;
        });

        setQualityParameters(params.map((param) => ({
          ...param,
          actual_value: mergedReport[param.parameter_name] || param.actual_value
        })));
        setQualityReport(mergedReport);
        setActualQualityValues(initialActualValues);
        pendingQualityReportRef.current = null;
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

  const fetchCustomers = async () => {
    try {
      const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';
      const token = localStorage.getItem('auth_token');

      if (!token) {
        showError('Authentication required. Please sign in again.');
        return;
      }

      const response = await fetch(`${apiUrl}/admin/users`, {
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        throw new Error('Failed to fetch suppliers');
      }

      const data = await response.json();
      const customerList = data.filter((user: any) => user.role !== 'admin' && String(user.approval_status || '').toLowerCase() === 'approved');
      setCustomers(customerList);
    } catch (err: any) {
      showError(err.message || 'Failed to fetch suppliers. Please try again.');
    }
  };

  const handleQualityChange = (paramName: string, value: string) => {
    setQualityReport((prev) => ({
      ...prev,
      [paramName]: value
    }));

    setQualityParameters((prev) =>
      prev.map((param) => param.parameter_name === paramName ? { ...param, actual_value: value } : param)
    );
  };

  const handleActualQualityValueChange = (paramName: string, value: string) => {
    const sanitizedValue = value.replace(/%/g, '');

    setActualQualityValues((prev) => ({
      ...prev,
      [paramName]: sanitizedValue
    }));
  };

  const qualityDeductionRows: QualityDeductionRow[] = qualityParameters.reduce((rows: QualityDeductionRow[], param) => {
    const actualValueText = actualQualityValues[param.parameter_name];
    if (actualValueText === undefined || actualValueText === '') return rows;

    const expectedValue = parseQualityNumber(qualityReport[param.parameter_name] || param.actual_value);
    const actualValue = Number(actualValueText);

    if (expectedValue === null || !Number.isFinite(actualValue)) return rows;

    const excessPercentage = roundToTwo(Math.max(actualValue - expectedValue, 0));
    const weightDeductionKg = roundToTwo(excessPercentage * netWeightMt * 10);
    const deductionAmount = roundToTwo((ratePerMt * weightDeductionKg) / 1000);

    rows.push({
      parameterName: param.parameter_name,
      expectedValue,
      actualValue,
      excessPercentage,
      weightDeductionKg,
      deductionAmount
    });

    return rows;
  }, []);

  const activeDeductionRows = qualityDeductionRows.filter((row) => row.excessPercentage > 0);
  const totalWeightDeductionKg = roundToTwo(activeDeductionRows.reduce((sum, row) => sum + row.weightDeductionKg, 0));
  const totalDeductionAmount = roundToTwo(activeDeductionRows.reduce((sum, row) => sum + row.deductionAmount, 0));
  const netPayableAmount = roundToTwo(Math.max(grossAmount - totalDeductionAmount, 0));

  const resetForm = () => {
    prefillSelectionRef.current = null;
    pendingQualityReportRef.current = null;
    setCustomerId('');
    setTransactionDate('');
    setSellerName('');
    setCommodity('');
    setVariety('');
    setGrossWeightMt(0);
    setTareWeightMt(0);
    setNetWeightMt(0);
    setRatePerMt(0);
    setGrossAmount(0);
    setQualityReport({});
    setActualQualityValues({});
    setDeliveryLocation('');
    setRemarks('');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);

    try {
      const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';
      const token = localStorage.getItem('auth_token');

      if (!token) {
        showError('Authentication required. Please sign in again.');
        setSubmitting(false);
        return;
      }

      if (!customerId) {
        showError('Please select a supplier name');
        setSubmitting(false);
        return;
      }

      const submittedQualityReport = {
        ...qualityReport,
        ...Object.fromEntries(
          Object.entries(actualQualityValues)
            .filter(([, value]) => value !== '')
            .map(([paramName, value]) => [`${paramName} Actual Value (%)`, value])
        ),
        ...Object.fromEntries(
          qualityDeductionRows.flatMap((row) => [
            [`${row.parameterName} Excess (%)`, String(row.excessPercentage)],
            [`${row.parameterName} Weight Deduction (KG)`, String(row.weightDeductionKg)],
            [`${row.parameterName} Deduction Amount`, String(row.deductionAmount)]
          ])
        )
      };

      const orderData = {
        customer_id: customerId,
        transaction_date: transactionDate,
        seller_name: sellerName,
        commodity: toUpperText(commodity),
        variety: toUpperText(variety),
        gross_weight_mt: grossWeightMt,
        tare_weight_mt: tareWeightMt,
        net_weight_mt: netWeightMt,
        rate_per_mt: ratePerMt,
        gross_amount: grossAmount,
        quality_report: submittedQualityReport,
        delivery_location: deliveryLocation,
        remarks,

        // Safe defaults for legacy confirmed-order fields not shown in this simplified form.
        state: '',
        location: '',
        warehouse_name: '',
        chamber_no: '',
        gate_pass_no: '',
        vehicle_no: '',
        weight_slip_no: '',
        no_of_bags: 0,
        hlw_wheat: 0,
        excess_hlw: 0,
        deduction_amount_hlw: 0,
        moisture_moi: 0,
        excess_moisture: 0,
        bdoi: 0,
        excess_bdoi: 0,
        moi_bdoi: 0,
        weight_deduction_kg: totalWeightDeductionKg,
        deduction_amount_moi_bdoi: 0,
        other_deductions: activeDeductionRows.map((row) => ({
          amount: row.deductionAmount,
          remarks: `${row.parameterName}: Excess ${row.excessPercentage}%, Weight Deduction ${row.weightDeductionKg} KG`
        })),
        total_deduction: totalDeductionAmount,
        net_amount: netPayableAmount
      };

      const response = await fetch(`${apiUrl}/confirmed-sales-orders`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(orderData)
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to create confirmed sales order');
      }

      showSuccess('Confirmed sales order created successfully!');
      setTimeout(() => {
        resetForm();
      }, 1000);
    } catch (err: any) {
      showError(err.message || 'Failed to create confirmed sales order. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="max-w-7xl mx-auto">
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gray-900 mb-2 flex items-center gap-2">
          <FileText className="w-8 h-8 text-green-600" />
          Confirm Sales Order
        </h1>
        <p className="text-gray-600">Review the deal details and confirm the sales order.</p>
      </div>

      <form onSubmit={handleSubmit} className="bg-white rounded-lg shadow-lg p-8 space-y-8">
        <div className="border-b border-gray-200 pb-6">
          <h2 className="text-xl font-semibold text-gray-800 mb-4">Deal Information</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Date of Deal <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-5 h-5" />
                <input
                  type="date"
                  value={transactionDate}
                  onChange={(e) => setTransactionDate(e.target.value)}
                  required
                  className="w-full pl-12 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Supplier Name <span className="text-red-500">*</span>
              </label>
              <select
                value={customerId}
                onChange={(e) => {
                  const selectedCustomer = customers.find((customer) => customer.id === e.target.value);
                  setCustomerId(e.target.value);
                  setSellerName(getDisplayName(selectedCustomer));
                }}
                required
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
              >
                <option value="">Select Supplier Name</option>
                {customers.map((customer) => (
                  <option key={customer.id} value={customer.id}>{getDisplayName(customer)}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Commodity <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <Package className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-5 h-5" />
                <select
                  value={commodity}
                  onChange={(e) => setCommodity(e.target.value)}
                  required
                  className="w-full pl-12 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent appearance-none"
                >
                  <option value="">Select Commodity</option>
                  {commodities.map((item) => (
                    <option key={item} value={item}>{item}</option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Variety <span className="text-red-500">*</span>
              </label>
              <select
                value={variety}
                onChange={(e) => setVariety(e.target.value)}
                required
                disabled={!commodity}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent appearance-none disabled:bg-gray-100"
              >
                <option value="">Select Variety</option>
                {varieties.map((item) => (
                  <option key={item} value={item}>{item}</option>
                ))}
              </select>
            </div>
          </div>
        </div>

        <div className="border-b border-gray-200 pb-6">
          <h2 className="text-xl font-semibold text-gray-800 mb-4">Quantity and Rate</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Gross Weight (MT) <span className="text-red-500">*</span>
              </label>
              <input
                type="number"
                value={grossWeightMt || ''}
                onChange={(e) => setGrossWeightMt(Number(e.target.value))}
                required
                min="0"
                step="0.01"
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent font-bold"
                placeholder="0.00"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Tare Weight (MT) <span className="text-red-500">*</span>
              </label>
              <input
                type="number"
                value={tareWeightMt || ''}
                onChange={(e) => setTareWeightMt(Number(e.target.value))}
                required
                min="0"
                step="0.01"
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent font-bold"
                placeholder="0.00"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Rate Per MT <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <IndianRupee className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-5 h-5" />
                <input
                  type="number"
                  value={ratePerMt || ''}
                  onChange={(e) => setRatePerMt(Number(e.target.value))}
                  required
                  min="0"
                  step="0.01"
                  className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent font-bold"
                  placeholder="0.00"
                />
              </div>
            </div>

          </div>
        </div>

        <div className="border-b border-gray-200 pb-6">
          <h2 className="text-xl font-semibold text-gray-800 mb-4">Address</h2>
          <input
            type="text"
            value={deliveryLocation}
            onChange={(e) => setDeliveryLocation(e.target.value)}
            required
            className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent font-bold"
            placeholder="Enter full address"
          />
        </div>

        <div className="border-b border-gray-200 pb-6">
          <div className="flex items-center gap-2 mb-4">
            <ClipboardCheck className="w-6 h-6 text-green-600" />
            <h2 className="text-xl font-semibold text-gray-800">Quality Parameters</h2>
          </div>

          {commodity ? (
            <div className="bg-gradient-to-r from-green-50 to-blue-50 p-4 rounded-lg border-2 border-green-200 mb-4">
              <p className="text-sm font-semibold text-green-800 mb-2">
                Quality parameters auto-populated for {commodity}
              </p>
              <p className="text-xs text-gray-600">
                Select the appropriate value for each parameter from the dropdowns below.
              </p>
            </div>
          ) : (
            <div className="bg-yellow-50 p-4 rounded-lg border border-yellow-200 mb-4">
              <p className="text-sm text-yellow-800">Please select a commodity to view quality parameters</p>
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
              <div className="bg-gray-800 text-white">
                <div className="grid grid-cols-12 gap-2 px-4 py-3 font-semibold text-sm">
                  <div className="col-span-1">S No.</div>
                  <div className="col-span-3">Particulars</div>
                  <div className="col-span-2">UOM</div>
                  <div className="col-span-2">Standard</div>
                  <div className="col-span-2">Expected Value</div>
                  <div className="col-span-2">Actual Value (%)</div>
                </div>
              </div>

              <div className="divide-y divide-gray-300">
                {qualityParameters.map((param) => {
                  const deductionRow = qualityDeductionRows.find((row) => row.parameterName === param.parameter_name);
                  const hasExcess = Boolean(deductionRow && deductionRow.excessPercentage > 0);

                  return (
                    <div
                      key={param.id}
                      className={`grid grid-cols-12 gap-2 px-4 py-3 ${hasExcess ? 'bg-red-50 hover:bg-red-100' : 'bg-white hover:bg-gray-50'}`}
                    >
                      <div className="col-span-1 flex items-center">
                        <span className="font-semibold text-gray-700">{param.s_no}</span>
                      </div>
                      <div className="col-span-3 flex items-center">
                        <span className="font-medium text-gray-900">{param.parameter_name}</span>
                      </div>
                      <div className="col-span-2 flex items-center">
                        <span className="text-gray-700">{param.unit_of_measurement}</span>
                      </div>
                      <div className="col-span-2 flex items-center text-xs text-gray-600">
                        {param.standard_value}
                      </div>
                      <div className="col-span-2 flex items-center">
                        <select
                          value={qualityReport[param.parameter_name] || ''}
                          onChange={(e) => handleQualityChange(param.parameter_name, e.target.value)}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent bg-yellow-50 font-medium text-sm"
                        >
                          {param.options.map((option) => (
                            <option key={option} value={option}>{option}</option>
                          ))}
                        </select>
                      </div>
                      <div className="col-span-2 flex items-center">
                        <input
                          type="number"
                          value={actualQualityValues[param.parameter_name] || ''}
                          onChange={(e) => handleActualQualityValueChange(param.parameter_name, e.target.value)}
                          onPaste={(e) => {
                            if (e.clipboardData.getData('text').includes('%')) e.preventDefault();
                          }}
                          min="0"
                          step="0.01"
                          inputMode="decimal"
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent font-medium text-sm"
                          placeholder="5.00"
                        />
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* <div className="bg-blue-50 border-b border-blue-200 px-4 py-3 text-sm text-blue-800">
                Enter actual values as numbers only, for example 16. Do not enter 0.16 or 16%.
              </div> */}

            </div>
          )}
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Remarks</label>
          <textarea
            value={remarks}
            onChange={(e) => setRemarks(e.target.value)}
            rows={4}
            className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent resize-none"
            placeholder="Enter remarks or additional information"
          />
        </div>

        <div className="border border-gray-300 rounded-xl overflow-hidden bg-white shadow-sm">
          <div className="bg-gray-900 px-6 py-4 text-white">
            <h2 className="text-xl font-semibold">Summary</h2>
            <p className="text-sm text-gray-300">Final weight and amount review before confirming the sales order.</p>
          </div>

          <div className="p-6 space-y-5">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="rounded-lg border border-gray-200 bg-gray-50 p-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Net Weight</p>
                <p className="mt-2 text-2xl font-bold text-gray-900">
                  {netWeightMt.toLocaleString('en-IN', { maximumFractionDigits: 2 })} MT
                </p>
              </div>

              <div className="rounded-lg border border-gray-200 bg-gray-50 p-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Rate Per MT</p>
                <p className="mt-2 text-2xl font-bold text-gray-900">{formatCurrency(ratePerMt || 0)}</p>
              </div>

              <div className="rounded-lg border border-green-200 bg-green-50 p-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-green-700">Gross Amount</p>
                <p className="mt-2 text-2xl font-bold text-green-800">{formatCurrency(grossAmount || 0)}</p>
              </div>
            </div>

            <div className="overflow-hidden rounded-lg border border-gray-200">
              <div className="grid grid-cols-12 bg-gray-100 px-4 py-3 text-sm font-semibold text-gray-700">
                <div className="col-span-8">Particulars</div>
                <div className="col-span-4 text-right">Amount</div>
              </div>

              <div className="divide-y divide-gray-200 text-sm">
                <div className="grid grid-cols-12 px-4 py-3">
                  <div className="col-span-8 text-gray-700">Gross Amount</div>
                  <div className="col-span-4 text-right font-semibold text-gray-900">{formatCurrency(grossAmount || 0)}</div>
                </div>

                {activeDeductionRows.length > 0 ? (
                  activeDeductionRows.map((row) => (
                    <div key={row.parameterName} className="grid grid-cols-12 px-4 py-3 bg-red-50">
                      <div className="col-span-8 text-gray-700">
                        <p className="font-semibold text-red-800">{row.parameterName}</p>
                        <p className="text-xs text-red-700">
                          Excess {row.excessPercentage.toLocaleString('en-IN', { maximumFractionDigits: 2 })}% | Weight Deduction {row.weightDeductionKg.toLocaleString('en-IN', { maximumFractionDigits: 2 })} KG
                        </p>
                      </div>
                      <div className="col-span-4 text-right font-semibold text-red-600">-{formatCurrency(row.deductionAmount)}</div>
                    </div>
                  ))
                ) : (
                  <div className="grid grid-cols-12 px-4 py-3">
                    <div className="col-span-8 text-gray-700">Quality Deductions</div>
                    <div className="col-span-4 text-right font-semibold text-red-600">{formatCurrency(0)}</div>
                  </div>
                )}

                <div className="grid grid-cols-12 px-4 py-3 bg-gray-50">
                  <div className="col-span-8 font-semibold text-gray-800">Total Quality Deductions</div>
                  <div className="col-span-4 text-right font-bold text-red-600">-{formatCurrency(totalDeductionAmount)}</div>
                </div>

                <div className="grid grid-cols-12 bg-green-50 px-4 py-4 text-base font-bold">
                  <div className="col-span-8 text-green-900">Net Payable Amount</div>
                  <div className="col-span-4 text-right text-green-900">{formatCurrency(netPayableAmount)}</div>
                </div>
              </div>
            </div>

            <p className="rounded-lg border border-yellow-200 bg-yellow-50 px-4 py-3 text-sm text-yellow-800">
              Deduction Amount = Rate Per MT x Weight Deduction (KG) / 1000.
            </p>
          </div>
        </div>

        <button
          type="submit"
          disabled={submitting}
          className="w-full bg-green-600 hover:bg-green-700 text-white font-semibold py-3 px-6 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
        >
          {submitting ? (
            <>
              <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
              Submitting...
            </>
          ) : (
            <>
              <Save className="w-5 h-5" />
              Confirm Sales Order
            </>
          )}
        </button>
      </form>
    </div>
  );
}
