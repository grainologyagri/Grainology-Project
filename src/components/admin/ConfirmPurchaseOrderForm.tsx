import { useState, useEffect, useRef } from 'react';
import { FileText, Save, Upload, FileSpreadsheet, Download, Map, AlertTriangle } from 'lucide-react';
import { COMMODITY_VARIETIES } from '../../constants/commodityVarieties';
import { fetchCommodities, fetchVarieties } from '../../lib/commodityVariety';
import { useToastContext } from '../../contexts/ToastContext';
import ColumnMappingDialog from './ColumnMappingDialog';
import FileFormatRequirementsModal from './FileFormatRequirementsModal';
import { generateSampleExcel, downloadExcelBuffer } from '../../utils/sampleExcel';
import { useLiveRefresh } from '../../hooks/useLiveRefresh';

interface User {
  id: string;
  name: string;
  trade_name?: string;
  email: string;
}

interface InitialPurchaseOrder {
  id: string;
  commodity: string;
  variety?: string;
  quantity_mt: number;
  expected_price_per_quintal?: number;
  delivery_location: string;
  sauda_confirmation_date?: string;
  notes?: string;
  quality_requirements?: Record<string, string>;
  buyer_id?: User;
}

interface ConfirmPurchaseOrderFormProps {
  initialOrder?: InitialPurchaseOrder | null;
}

export default function ConfirmPurchaseOrderForm({ initialOrder }: ConfirmPurchaseOrderFormProps) {
  const { showSuccess, showError } = useToastContext();
  const prefillSelectionRef = useRef<{ commodity: string; variety: string } | null>(null);
  const [customers, setCustomers] = useState<User[]>([]);
  const [, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadMode, setUploadMode] = useState<'manual' | 'upload'>('manual');
  const [isDragging, setIsDragging] = useState(false);
  const [columnMapping, setColumnMapping] = useState<Record<string, string>>({});
  const [showMappingDialog, setShowMappingDialog] = useState(false);
  const [showFormatRequirements, setShowFormatRequirements] = useState(false);
  const [duplicateChoice, setDuplicateChoice] = useState<{ duplicateCount: number; totalRows: number; duplicateRowNumbers: number[] } | null>(null);
  const [availableColumns, setAvailableColumns] = useState<string[]>([]);
  const [previewRows, setPreviewRows] = useState<Array<Record<string, any>>>([]);
  const [uploadErrors, setUploadErrors] = useState<string[]>([]);
  const [commodities, setCommodities] = useState<string[]>(['Paddy', 'Maize', 'Wheat']);
  const [varieties, setVarieties] = useState<string[]>([]);
  const [warehouses, setWarehouses] = useState<string[]>([]);
  const [locations, setLocations] = useState<Array<{ id: string; name: string; state?: string }>>([]);

  // Form fields
  const [customerId, setCustomerId] = useState('');
  const [transactionDate, setTransactionDate] = useState('');
  const [state, setState] = useState('');
  const [supplierName, setSupplierName] = useState('');
  const [locationId, setLocationId] = useState('');
  const [warehouseName, setWarehouseName] = useState('');
  const [chamberNo, setChamberNo] = useState('');
  const [commodity, setCommodity] = useState('Paddy');
  const [variety, setVariety] = useState('');
  const [gatePassNo, setGatePassNo] = useState('');
  const [vehicleNo, setVehicleNo] = useState('');
  const [weightSlipNo, setWeightSlipNo] = useState('');
  const [grossWeightMt, setGrossWeightMt] = useState<number>(0);
  const [tareWeightMt, setTareWeightMt] = useState<number>(0);
  const [noOfBags, setNoOfBags] = useState<number>(0);
  const [netWeightMt, setNetWeightMt] = useState<number>(0);
  const [ratePerMt, setRatePerMt] = useState<number>(0);
  const [grossAmount, setGrossAmount] = useState<number>(0);
  
  // Quality parameters
  const [hlwWheat, setHlwWheat] = useState<number>(0);
  const [excessHlw, setExcessHlw] = useState<number>(0);
  const [deductionAmountHlw, setDeductionAmountHlw] = useState<number>(0);
  const [moistureMoi, setMoistureMoi] = useState<number>(0);
  const [excessMoisture, setExcessMoisture] = useState<number>(0);
  const [bddi, setBddi] = useState<number>(0); // Changed from bdoi to bddi
  const [excessBddi, setExcessBddi] = useState<number>(0);
  const [moiBddi, setMoiBddi] = useState<number>(0);
  const [weightDeductionKg, setWeightDeductionKg] = useState<number>(0);
  const [deductionAmountMoiBddi, setDeductionAmountMoiBddi] = useState<number>(0);
  const [otherDeductions, setOtherDeductions] = useState<Array<{ amount: number; remarks: string }>>([{ amount: 0, remarks: '' }]);
  
  const [qualityReport, setQualityReport] = useState<Record<string, string>>({});
  const [deliveryLocation, setDeliveryLocation] = useState('');
  const [remarks, setRemarks] = useState('');

  const indianStates = [
    'Andhra Pradesh', 'Arunachal Pradesh', 'Assam', 'Bihar', 'Chhattisgarh',
    'Goa', 'Gujarat', 'Haryana', 'Himachal Pradesh', 'Jharkhand', 'Karnataka',
    'Kerala', 'Madhya Pradesh', 'Maharashtra', 'Manipur', 'Meghalaya', 'Mizoram',
    'Nagaland', 'Odisha', 'Punjab', 'Rajasthan', 'Sikkim', 'Tamil Nadu',
    'Telangana', 'Tripura', 'Uttar Pradesh', 'Uttarakhand', 'West Bengal'
  ];

  const getDisplayName = (customer?: User | null) => {
    if (!customer) return '';
    const trade = String(customer.trade_name || '').trim();
    if (trade) return trade;
    if (customer.name) return customer.name;
    return customer.email || '';
  };

  const toUpperText = (value?: string | null) => String(value ?? '').trim().toUpperCase();

  const toDateInputValue = (value?: string | null) => {
    if (!value) return new Date().toISOString().slice(0, 10);
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) return String(value).slice(0, 10);
    return parsed.toISOString().slice(0, 10);
  };

  useEffect(() => {
    if (!initialOrder) return;

    const buyer = initialOrder.buyer_id;
    const buyerDisplayName = getDisplayName(buyer);

    prefillSelectionRef.current = {
      commodity: initialOrder.commodity || 'Paddy',
      variety: initialOrder.variety || ''
    };
    setUploadMode('manual');
    setCustomerId(buyer?.id || '');
    setTransactionDate(toDateInputValue(initialOrder.sauda_confirmation_date));
    setSupplierName(buyerDisplayName);
    setCommodity(initialOrder.commodity || 'Paddy');
    setVariety(initialOrder.variety || '');
    setGrossWeightMt(Number(initialOrder.quantity_mt) || 0);
    setTareWeightMt(0);
    setRatePerMt((Number(initialOrder.expected_price_per_quintal) || 0) * 10);
    setQualityReport(initialOrder.quality_requirements || {});
    setDeliveryLocation(initialOrder.delivery_location || '');
    setRemarks(initialOrder.notes || '');
  }, [initialOrder]);

  useEffect(() => {
    fetchCustomers();
    fetchCommodities().then(setCommodities).catch(() => {
      setCommodities(['Paddy', 'Maize', 'Wheat']);
    });
  }, []);

  // Keep master lists in sync without page refresh
  useLiveRefresh(() => {
    fetchCommodities().then(setCommodities).catch(() => {
      setCommodities(['Paddy', 'Maize', 'Wheat']);
    });
  }, 30000, []);

  useEffect(() => {
    if (!state) {
      setLocations([]);
      setLocationId('');
      setWarehouseName('');
      setWarehouses([]);
      return;
    }
    fetchLocationsByState(state);
  }, [state]);

  useLiveRefresh(() => {
    if (state) {
      fetchLocationsByState(state);
    }
  }, 10000, [state]);

  useEffect(() => {
    if (!locationId) {
      setWarehouses([]);
      setWarehouseName('');
      return;
    }
    fetchWarehousesByLocation(locationId);
  }, [locationId]);

  useLiveRefresh(() => {
    if (locationId) {
      fetchWarehousesByLocation(locationId);
    }
  }, 10000, [locationId]);

  useEffect(() => {
    // Fetch varieties when commodity changes
    if (commodity) {
      fetchVarieties(commodity).then(setVarieties).catch(() => {
        setVarieties(COMMODITY_VARIETIES[commodity] || []);
      });
      if (prefillSelectionRef.current) {
        if (prefillSelectionRef.current.commodity === commodity) {
          setVariety(prefillSelectionRef.current.variety);
          prefillSelectionRef.current = null;
        }
        return;
      }

      setVariety(''); // Reset variety when commodity changes
    } else {
      setVarieties([]);
    }
  }, [commodity]);

  useLiveRefresh(() => {
    if (commodity) {
      fetchVarieties(commodity).then(setVarieties).catch(() => {
        setVarieties(COMMODITY_VARIETIES[commodity] || []);
      });
    }
  }, 15000, [commodity]);


  useEffect(() => {
    // Calculate net weight
    const net = grossWeightMt - tareWeightMt;
    setNetWeightMt(net > 0 ? net : 0);
  }, [grossWeightMt, tareWeightMt]);

  useEffect(() => {
    // Calculate gross amount
    const amount = netWeightMt * ratePerMt;
    setGrossAmount(amount);
  }, [netWeightMt, ratePerMt]);

  useEffect(() => {
    // Calculate MOI+BDDI
    const total = excessMoisture + excessBddi;
    setMoiBddi(total);
  }, [excessMoisture, excessBddi]);

  const fetchCustomers = async () => {
    try {
      setLoading(true);
      const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';
      const token = localStorage.getItem('auth_token');

      if (!token) {
        showError('Authentication required. Please sign in again.');
        setLoading(false);
        return;
      }

      const response = await fetch(`${apiUrl}/admin/users`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error('Failed to fetch customers');
      }

      const data = await response.json();
      // Filter to show only customers (farmers, traders, etc., not admins)
      const customerList = data.filter((user: any) => user.role !== 'admin' && String(user.approval_status || '').toLowerCase() === 'approved');
      setCustomers(customerList);
    } catch (err: any) {
      showError(err.message || 'Failed to fetch customers. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const fetchLocationsByState = async (stateName: string) => {
    try {
      const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';
      const token = localStorage.getItem('auth_token');
      if (!token) return;
      const response = await fetch(`${apiUrl}/location-master?is_active=true&approval_status=approved&state=${encodeURIComponent(stateName)}`, {
        headers: { 'Authorization': `Bearer ${token}` },
      });
      if (response.ok) {
        const data = await response.json();
        const approvedOnly = data.filter((l: any) => String(l.approval_status || '').toLowerCase() === 'approved');
        setLocations(approvedOnly.map((l: any) => ({ id: l.id, name: l.name, state: l.state })));
        setLocationId('');
        setWarehouseName('');
        setWarehouses([]);
      } else {
        setLocations([]);
      }
    } catch (error) {
      console.error('Failed to fetch locations:', error);
      setLocations([]);
    }
  };

  const fetchWarehousesByLocation = async (locId: string) => {
    try {
      const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';
      const token = localStorage.getItem('auth_token');
      if (!token) return;
      const response = await fetch(`${apiUrl}/warehouse-master?is_active=true&approval_status=approved&location_id=${encodeURIComponent(locId)}`, {
        headers: { 'Authorization': `Bearer ${token}` },
      });
      if (response.ok) {
        const data = await response.json();
        const approvedOnly = data.filter((w: any) => String(w.approval_status || '').toLowerCase() === 'approved');
        setWarehouses(approvedOnly.map((w: any) => w.name));
        setWarehouseName('');
      } else {
        setWarehouses([]);
      }
    } catch (error) {
      console.error('Failed to fetch warehouses:', error);
      setWarehouses([]);
    }
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

      // Validate other deductions - if amount is filled, remarks is required
      for (const ded of otherDeductions) {
        if (ded.amount > 0 && !ded.remarks.trim()) {
          showError('Remarks are required for all deductions with an amount greater than 0');
          setSubmitting(false);
          return;
        }
      }

      // Filter out empty deductions and calculate total
      const validDeductions = otherDeductions.filter(ded => ded.amount > 0);
      const otherDeductionsTotal = validDeductions.reduce((sum, ded) => sum + (ded.amount || 0), 0);
      
      // Calculate total deduction
      const totalDeduction = 
        deductionAmountHlw +
        deductionAmountMoiBddi +
        otherDeductionsTotal;

      const netAmount = grossAmount - totalDeduction;

      if (!customerId) {
        showError('Please select a supplier name');
        setSubmitting(false);
        return;
      }

      const locationName = locations.find((l) => l.id === locationId)?.name ?? '';
      const orderData = {
        customer_id: customerId,
        transaction_date: transactionDate,
        state: toUpperText(state),
        supplier_name: supplierName,
        location: locationName,
        warehouse_name: warehouseName,
        chamber_no: chamberNo,
        commodity: toUpperText(commodity),
        variety: toUpperText(variety),
        gate_pass_no: gatePassNo,
        vehicle_no: vehicleNo,
        weight_slip_no: weightSlipNo,
        gross_weight_mt: grossWeightMt,
        tare_weight_mt: tareWeightMt,
        no_of_bags: noOfBags,
        net_weight_mt: netWeightMt,
        rate_per_mt: ratePerMt,
        gross_amount: grossAmount,
        hlw_wheat: hlwWheat,
        excess_hlw: excessHlw,
        deduction_amount_hlw: deductionAmountHlw,
        moisture_moi: moistureMoi,
        excess_moisture: excessMoisture,
        bddi, // Changed from bdoi
        excess_bddi: excessBddi,
        moi_bddi: moiBddi,
        weight_deduction_kg: weightDeductionKg,
        deduction_amount_moi_bddi: deductionAmountMoiBddi,
        other_deductions: validDeductions,
        total_deduction: totalDeduction,
        net_amount: netAmount,
        quality_report: qualityReport,
        delivery_location: deliveryLocation,
        remarks,
      };

      const response = await fetch(`${apiUrl}/confirmed-purchase-orders`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(orderData),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to create confirmed purchase order');
      }

      showSuccess('Confirmed purchase order created successfully!');
      // Reset form after a short delay
      setTimeout(() => {
        resetForm();
      }, 1000);
    } catch (err: any) {
      showError(err.message || 'Failed to create confirmed purchase order. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleBulkUpload = async (skipDuplicates: boolean) => {
    if (!uploadFile) return;
    setDuplicateChoice(null);
    setUploadErrors([]);
    setUploading(true);
    try {
      const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';
      const token = localStorage.getItem('auth_token');
      if (!token) {
        showError('Authentication required. Please sign in again.');
        return;
      }
      const formData = new FormData();
      formData.append('file', uploadFile);
      if (Object.keys(columnMapping).length > 0) {
        formData.append('columnMapping', JSON.stringify(columnMapping));
      }
      formData.append('skipDuplicates', String(skipDuplicates));
      const response = await fetch(`${apiUrl}/confirmed-purchase-orders/bulk-upload`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` },
        body: formData,
      });
      const result = await response.json();
      if (!response.ok) {
        setUploadErrors(result.errors || []);
        throw new Error(result.error || result.message || 'Upload failed');
      }
      if (result.requiresDuplicateChoice) {
        setDuplicateChoice({
          duplicateCount: result.duplicateCount,
          totalRows: result.totalRows,
          duplicateRowNumbers: result.duplicateRowNumbers || [],
        });
        setUploading(false);
        return;
      }
      if (result.success && result.count > 0) {
        const dupMsg = result.duplicateSkipped > 0 ? ` (${result.duplicateSkipped} duplicates skipped)` : '';
        const warningMsg = result.warnings?.length ? ` (${result.warnings.length} warnings)` : '';
        showSuccess(`Successfully uploaded ${result.count} confirmed purchase orders!${dupMsg}${warningMsg}`);
      } else if (result.errors?.length && !result.count) {
        setUploadErrors(result.errors);
        showError(`Upload failed with ${result.errors.length} error(s). See details below.`);
      } else {
        showSuccess(`Successfully uploaded ${result.count || 0} confirmed purchase orders!`);
      }
      if (!result.errors || result.errors.length === 0) {
        setUploadErrors([]);
      }
      setUploadFile(null);
      setColumnMapping({});
      const fileInput = document.getElementById('file-upload-purchase') as HTMLInputElement;
      if (fileInput) fileInput.value = '';
    } catch (err: any) {
      showError(err.message || 'Failed to upload file. Please try again.');
    } finally {
      setUploading(false);
    }
  };

  const resetForm = () => {
    setCustomerId('');
    setTransactionDate('');
    setState('');
    setSupplierName('');
    setLocationId('');
    setWarehouseName('');
    setChamberNo('');
    setCommodity('Paddy');
    setVariety('');
    setGatePassNo('');
    setVehicleNo('');
    setWeightSlipNo('');
    setGrossWeightMt(0);
    setTareWeightMt(0);
    setNoOfBags(0);
    setNetWeightMt(0);
    setRatePerMt(0);
    setGrossAmount(0);
    setHlwWheat(0);
    setExcessHlw(0);
    setDeductionAmountHlw(0);
    setMoistureMoi(0);
    setExcessMoisture(0);
    setBddi(0);
    setExcessBddi(0);
    setMoiBddi(0);
    setWeightDeductionKg(0);
    setDeductionAmountMoiBddi(0);
    setOtherDeductions([{ amount: 0, remarks: '' }]);
    setQualityReport({});
    setDeliveryLocation('');
    setRemarks('');
  };

  return (
    <div className="max-w-7xl mx-auto">
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gray-900 mb-2 flex items-center gap-2">
          <FileText className="w-8 h-8 text-green-600" />
          Confirm Purchase Order
        </h1>
        <p className="text-gray-600">Fill in all the details to confirm a purchase order</p>
      </div>

      {/* Upload Mode Toggle */}
      <div className="bg-white rounded-lg shadow-lg p-6 mb-6">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-semibold text-gray-800 mb-2">Entry Mode</h3>
            <p className="text-sm text-gray-600">Choose to enter data manually or upload CSV/Excel file</p>
          </div>
          <div className="flex gap-3">
            <button
              type="button"
              onClick={() => setUploadMode('manual')}
              className={`px-6 py-3 rounded-lg font-medium transition-all ${
                uploadMode === 'manual'
                  ? 'bg-green-600 text-white shadow-md'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              Manual Entry
            </button>
            <button
              type="button"
              onClick={() => setUploadMode('upload')}
              className={`px-6 py-3 rounded-lg font-medium transition-all flex items-center gap-2 ${
                uploadMode === 'upload'
                  ? 'bg-green-600 text-white shadow-md'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              <Upload className="w-4 h-4" />
              CSV/Excel Upload
            </button>
          </div>
        </div>
      </div>

      {uploadMode === 'upload' ? (
        <div className="bg-white rounded-lg shadow-lg p-8">
          <div className="mb-6">
            <h2 className="text-xl font-semibold text-gray-800 mb-2 flex items-center gap-2">
              <FileSpreadsheet className="w-6 h-6 text-green-600" />
              Bulk Upload Confirmed Purchase Orders
            </h2>
            <p className="text-gray-600">Upload a CSV or Excel file to create multiple confirmed purchase orders at once</p>
          </div>

          <div className="space-y-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Upload File (CSV or Excel) <span className="text-red-500">*</span>
              </label>
              <div
                className={`mt-1 flex justify-center px-6 pt-5 pb-6 border-2 border-dashed rounded-lg transition-colors ${
                  isDragging ? 'border-green-500 bg-green-50' : 'border-gray-300 hover:border-green-400'
                }`}
                onDragEnter={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  setIsDragging(true);
                }}
                onDragOver={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                }}
                onDragLeave={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  setIsDragging(false);
                }}
                onDrop={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  setIsDragging(false);

                  const files = e.dataTransfer.files;
                  if (files && files.length > 0) {
                    const file = files[0];
                    const ext = file.name.split('.').pop()?.toLowerCase();
                    if (['csv', 'xlsx', 'xls'].includes(ext || '')) {
                      setUploadFile(file);
                    } else {
                      showError('Please select a CSV or Excel file (.csv, .xlsx, .xls)');
                    }
                  }
                }}
              >
                <div className="space-y-1 text-center">
                  <Upload className="mx-auto h-12 w-12 text-gray-400" />
                  <div className="flex text-sm text-gray-600">
                    <label htmlFor="file-upload-purchase" className="relative cursor-pointer bg-white rounded-md font-medium text-green-600 hover:text-green-500 focus-within:outline-none focus-within:ring-2 focus-within:ring-offset-2 focus-within:ring-green-500">
                      <span>Upload a file</span>
                      <input
                        id="file-upload-purchase"
                        name="file-upload-purchase"
                        type="file"
                        accept=".csv,.xlsx,.xls"
                        className="sr-only"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) {
                            const ext = file.name.split('.').pop()?.toLowerCase();
                            if (['csv', 'xlsx', 'xls'].includes(ext || '')) {
                              setUploadFile(file);
                            } else {
                              showError('Please select a CSV or Excel file (.csv, .xlsx, .xls)');
                            }
                          }
                        }}
                      />
                    </label>
                    <p className="pl-1">or drag and drop</p>
                  </div>
                  <p className="text-xs text-gray-500">CSV, XLSX, XLS up to 10MB</p>
                  {uploadFile && (
                    <p className="text-sm text-green-600 mt-2">
                      Selected: {uploadFile.name}
                    </p>
                  )}
                </div>
              </div>
            </div>

            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <div className="flex items-center justify-between mb-2 flex-wrap gap-2">
                <h4 className="font-semibold text-blue-900">File Format Requirements:</h4>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setShowFormatRequirements(true)}
                    className="px-3 py-1 bg-amber-500 text-white text-sm rounded hover:bg-amber-600"
                  >
                    View detailed format requirements
                  </button>
                <button
                  type="button"
                  onClick={async () => {
                    try {
                      const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';
                      const token = localStorage.getItem('auth_token');
                      if (!token) {
                        showError('Authentication required');
                        return;
                      }

                      // Fetch master list from API so Sample CSV always has current dropdown values (even if state was empty)
                      const [locRes, whRes, commRes, usersRes] = await Promise.all([
                        fetch(`${apiUrl}/location-master?is_active=true&approval_status=approved`, { headers: { 'Authorization': `Bearer ${token}` } }),
                        fetch(`${apiUrl}/warehouse-master?is_active=true&approval_status=approved`, { headers: { 'Authorization': `Bearer ${token}` } }),
                        fetch(`${apiUrl}/commodity-master?is_active=true`, { headers: { 'Authorization': `Bearer ${token}` } }),
                        fetch(`${apiUrl}/admin/users`, { headers: { 'Authorization': `Bearer ${token}` } }),
                      ]);
                      const locRaw = locRes.ok ? await locRes.json() : [];
                      const whRaw = whRes.ok ? await whRes.json() : [];
                      const locList = locRaw
                        .filter((l: any) => String(l.approval_status || '').toLowerCase() === 'approved')
                        .map((l: any) => l.name);
                      const whList = whRaw
                        .filter((w: any) => String(w.approval_status || '').toLowerCase() === 'approved')
                        .map((w: any) => w.name);
                      const commList = commRes.ok ? (await commRes.json()).map((c: any) => c.name) : commodities.length ? commodities : ['Maize', 'Wheat'];
                      const usersData = usersRes.ok ? await usersRes.json() : [];
                      const customerList = (usersData.length ? usersData : customers).filter((u: any) => u.role !== 'admin' && String(u.approval_status || '').toLowerCase() === 'approved');

                      const sampleState = toUpperText(indianStates[0] || 'Bihar');
                      const sampleLocation = locList[0] || 'GULABBAGH';
                      const sampleLocation2 = (locList[1] ?? locList[0]) || 'BUXAR';
                      const sampleWarehouse = whList[0] || 'SATISH KUMAR WAREHOUSE';
                      const sampleWarehouse2 = (whList[1] ?? whList[0]) || 'SIDDHASHRAM WAREHOUSE';
                      const sampleCommodity1 = toUpperText(commList[0] || 'Maize');
                      const sampleCommodity2 = toUpperText((commList[1] ?? commList[0]) || 'Wheat');
                      const sampleSupplier1 = getDisplayName(customerList[0] as User) || 'FARMKEN VENTURES';
                      const sampleSupplier2 = getDisplayName(customerList[1] as User) || getDisplayName(customerList[0] as User) || 'Agro Valley Trading';

                      // Fetch varieties for sample commodities (dropdown values for those commodities)
                      let sampleVarieties1: string[] = [];
                      let sampleVarieties2: string[] = [];
                      try {
                        const var1Res = await fetch(`${apiUrl}/variety-master?commodity_name=${encodeURIComponent(sampleCommodity1)}`, {
                          headers: { 'Authorization': `Bearer ${token}` }
                        });
                        if (var1Res.ok) {
                          const var1Data = await var1Res.json();
                          sampleVarieties1 = var1Data.filter((v: any) => v.is_active).map((v: any) => toUpperText(v.variety_name));
                        }
                      } catch {}
                      try {
                        const var2Res = await fetch(`${apiUrl}/variety-master?commodity_name=${encodeURIComponent(sampleCommodity2)}`, {
                          headers: { 'Authorization': `Bearer ${token}` }
                        });
                        if (var2Res.ok) {
                          const var2Data = await var2Res.json();
                          sampleVarieties2 = var2Data.filter((v: any) => v.is_active).map((v: any) => toUpperText(v.variety_name));
                        }
                      } catch {}

                      const finalVariety1 = toUpperText(sampleVarieties1[0] || 'Hybrid');
                      const finalVariety2 = toUpperText(sampleVarieties2[0] || 'Dara');

                      // Create sample CSV matching Excel format exactly - 39 columns as per image
                      const headers = [
                        'Date of Transaction',
                        'State',
                        'Supplier Name',
                        'Location',
                        'Warehouse Name',
                        'Chamber No.',
                        'Commodity',
                        'Variety',
                        'Gate Pass No.',
                        'Vehicle No.',
                        'Weight Slip No.',
                        'Gross Weight in MT (Vehicle + Goods)',
                        'Tare Weight of Vehicle',
                        'No. of Bags',
                        'Net Weight in MT',
                        'Rate Per MT',
                        'Gross Amount',
                        'HLW (Hectolitre Weight) in Wheat',
                        'Excess HLW',
                        'Deduction Amount Rs. (HLW)',
                        'Moisture (MOI)',
                        'Excess Moisture',
                        'Broken, Damage, Discolour, Immature (BDOI)',
                        'Excess BDOI',
                        'MOI+BDOI',
                        'Weight Deduction in KG',
                        'Deduction Amount Rs. (MOI+BDOI)',
                        'Other Deduction 1',
                        'Other Deduction 2',
                        'Other Deduction 3',
                        'Other Deduction 4',
                        'Other Deduction 5',
                        'Other Deduction 6',
                        'Other Deduction 7',
                        'Other Deduction 8',
                        'Other Deduction 9',
                        'Other Deduction 10',
                        'Net Amount',
                        'Remarks'
                      ];
                    
                      const today = new Date();
                      const date1 = new Date(today);
                      date1.setDate(date1.getDate() - 5);
                      const date2 = new Date(today);
                      date2.setDate(date2.getDate() - 10);
                      
                      const sampleRow1 = [
                        date1.toLocaleDateString('en-GB'),
                        sampleState,
                        sampleSupplier1, // Supplier Name
                        sampleLocation,
                        sampleWarehouse,
                        '16',
                        sampleCommodity1,
                        finalVariety1,
                      '754201',
                      'BR11GD-8172',
                      '1300',
                      '12.690',
                      '6.790',
                      '93',
                      '5.900',
                      '22310.00',
                      '131629.00',
                      'Not Applicable',
                      'Not Applicable',
                      '0.00',
                      '14.80',
                      '0.80',
                      '4.95',
                      '0.00',
                      '0.80',
                      '47.20',
                      '1053.03',
                      '-',
                      '-',
                      '-',
                      '-',
                      '-',
                      '-',
                      '-',
                      '-',
                      '-',
                      '-',
                      '130575.97',
                      ''
                    ];
                    
                      const sampleRow2 = [
                        date2.toLocaleDateString('en-GB'),
                        sampleState,
                        sampleSupplier2, // Supplier Name
                        sampleLocation2,
                        sampleWarehouse2,
                        '2',
                        sampleCommodity2,
                        finalVariety2,
                      'Not Available',
                      'Not Available',
                      'Not Available',
                      'Not Available',
                      'Not Available',
                      '105',
                      '5.970',
                      '25900.00',
                      '154623.00',
                      '74.00',
                      '0.00',
                      '0.00',
                      '9.20',
                      '0.00',
                      '0.00',
                      '0.00',
                      '0.00',
                      '-',
                      '-',
                      '-',
                      '-',
                      '-',
                      '-',
                      '-',
                      '-',
                      '-',
                      '-',
                      '154623.00',
                      ''
                    ];
                    
                      const sampleData = [headers, sampleRow1, sampleRow2];
                      const csvContent = sampleData.map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(',')).join('\n');
                      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
                      const link = document.createElement('a');
                      const url = URL.createObjectURL(blob);
                      link.setAttribute('href', url);
                      link.setAttribute('download', 'sample_confirmed_purchase_order.csv');
                      link.style.visibility = 'hidden';
                      document.body.appendChild(link);
                      link.click();
                      document.body.removeChild(link);
                      URL.revokeObjectURL(url);
                    } catch (error: any) {
                      showError('Failed to generate sample CSV: ' + (error.message || 'Unknown error'));
                    }
                  }}
                  className="px-3 py-1 bg-green-600 text-white text-sm rounded hover:bg-green-700 flex items-center gap-1"
                >
                  <Download className="w-4 h-4" />
                  Download Sample CSV
                </button>
                <button
                  type="button"
                  onClick={async () => {
                    try {
                      const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';
                      const token = localStorage.getItem('auth_token');
                      if (!token) {
                        showError('Authentication required');
                        return;
                      }
                      const authHeaders = { headers: { 'Authorization': `Bearer ${token}` } };
                      const [locRes, whRes, commRes, usersRes, varietiesRes, statesRes] = await Promise.all([
                        fetch(`${apiUrl}/location-master?is_active=true&approval_status=approved`, authHeaders),
                        fetch(`${apiUrl}/warehouse-master?is_active=true&approval_status=approved`, authHeaders),
                        fetch(`${apiUrl}/commodity-master?is_active=true`, authHeaders),
                        fetch(`${apiUrl}/admin/users`, authHeaders),
                        fetch(`${apiUrl}/variety-master`, authHeaders),
                        fetch(`${apiUrl}/weather/states`, authHeaders),
                      ]);
                      const locRaw: Array<{ id: string; name: string; state: string; approval_status?: string }> = locRes.ok ? await locRes.json() : [];
                      const whRaw: Array<{ id: string; name: string; location_id: string; approval_status?: string }> = whRes.ok ? await whRes.json() : [];
                      const locData = locRaw.filter((l) => String(l.approval_status || '').toLowerCase() === 'approved');
                      const whData = whRaw.filter((w) => String(w.approval_status || '').toLowerCase() === 'approved');
                      const commList = commRes.ok ? (await commRes.json()).map((c: any) => toUpperText(c.name)) : ['MAIZE', 'WHEAT'];
                      const usersData = usersRes.ok ? await usersRes.json() : [];
                      const customerList = (usersData.length ? usersData : customers).filter((u: any) => u.role !== 'admin' && String(u.approval_status || '').toLowerCase() === 'approved');
                      const allVarietiesData = varietiesRes.ok ? await varietiesRes.json() : [];
                      const statesList: string[] = statesRes.ok ? (await statesRes.json()).map((s: string) => toUpperText(s)) : indianStates.map((s) => toUpperText(s));
                      const locList = locData.map((l: any) => l.name);
                      const whList = whData.map((w: any) => w.name);
                      const key = (s: string) => String(s || '').replace(/\s+/g, '');
                      const locationsByState: Record<string, string[]> = {};
                      for (const s of statesList) locationsByState[s] = [];
                      for (const l of locData) {
                        const s = (l.state || '').trim() || 'Other';
                        if (!locationsByState[s]) locationsByState[s] = [];
                        locationsByState[s].push(l.name);
                      }
                      const warehousesByLocationKey: Record<string, string[]> = {};
                      for (const l of locData) warehousesByLocationKey[key(l.name)] = [];
                      for (const w of whData) {
                        const loc = locData.find((l: any) => l.id === w.location_id);
                        const locKey = loc ? key(loc.name) : w.location_id;
                        if (!warehousesByLocationKey[locKey]) warehousesByLocationKey[locKey] = [];
                        warehousesByLocationKey[locKey].push(w.name);
                      }
                      const varietiesByCommodityKey: Record<string, string[]> = {};
                      for (const c of commList) varietiesByCommodityKey[key(c)] = [];
                      for (const v of (allVarietiesData as any[]).filter((x: any) => x.is_active !== false)) {
                        const c = toUpperText((v.commodity_name || '').trim() || 'Other');
                        const cKey = key(c);
                        if (!varietiesByCommodityKey[cKey]) varietiesByCommodityKey[cKey] = [];
                        varietiesByCommodityKey[cKey].push(toUpperText(v.variety_name));
                      }
                      const sampleState = toUpperText(statesList[0] || 'Bihar');
                      const sampleLocation = locList[0] || 'GULABBAGH';
                      const sampleLocation2 = (locList[1] ?? locList[0]) || 'BUXAR';
                      const sampleWarehouse = whList[0] || 'SATISH KUMAR WAREHOUSE';
                      const sampleWarehouse2 = (whList[1] ?? whList[0]) || 'SIDDHASHRAM WAREHOUSE';
                      const sampleCommodity1 = toUpperText(commList[0] || 'Maize');
                      const sampleCommodity2 = toUpperText((commList[1] ?? commList[0]) || 'Wheat');
                      const sampleSupplier1 = getDisplayName(customerList[0] as User) || 'FARMKEN VENTURES';
                      const sampleSupplier2 = getDisplayName(customerList[1] as User) || getDisplayName(customerList[0] as User) || 'Agro Valley Trading';
                      const allVarieties = (allVarietiesData as any[])
                        .filter((x: any) => x.is_active !== false)
                        .map((x: any) => toUpperText(x.variety_name));
                      const finalVariety1 = toUpperText(allVarieties[0] || 'Hybrid');
                      const finalVariety2 = toUpperText(allVarieties[1] || allVarieties[0] || 'Dara');
                      const headers = [
                        'Date of Transaction', 'State', 'Supplier Name', 'Location', 'Warehouse Name', 'Chamber No.', 'Commodity', 'Variety',
                        'Gate Pass No.', 'Vehicle No.', 'Weight Slip No.', 'Gross Weight in MT (Vehicle + Goods)', 'Tare Weight of Vehicle', 'No. of Bags', 'Net Weight in MT', 'Rate Per MT', 'Gross Amount',
                        'HLW (Hectolitre Weight) in Wheat', 'Excess HLW', 'Deduction Amount Rs. (HLW)', 'Moisture (MOI)', 'Excess Moisture', 'Broken, Damage, Discolour, Immature (BDOI)', 'Excess BDOI', 'MOI+BDOI', 'Weight Deduction in KG', 'Deduction Amount Rs. (MOI+BDOI)',
                        'Other Deduction 1', 'Other Deduction 2', 'Other Deduction 3', 'Other Deduction 4', 'Other Deduction 5', 'Other Deduction 6', 'Other Deduction 7', 'Other Deduction 8', 'Other Deduction 9', 'Other Deduction 10', 'Net Amount', 'Remarks'
                      ];
                      const today = new Date();
                      const d1 = new Date(today); d1.setDate(d1.getDate() - 5);
                      const d2 = new Date(today); d2.setDate(d2.getDate() - 10);
                      const sampleRow1 = [d1.toLocaleDateString('en-GB'), sampleState, sampleSupplier1, sampleLocation, sampleWarehouse, '16', sampleCommodity1, finalVariety1, '754201', 'BR11GD-8172', '1300', '12.690', '6.790', '93', '5.900', '22310.00', '131629.00', 'Not Applicable', 'Not Applicable', '0.00', '14.80', '0.80', '4.95', '0.00', '0.80', '47.20', '1053.03', '-', '-', '-', '-', '-', '-', '-', '-', '-', '-', '130575.97', ''];
                      const sampleRow2 = [d2.toLocaleDateString('en-GB'), sampleState, sampleSupplier2, sampleLocation2, sampleWarehouse2, '2', sampleCommodity2, finalVariety2, 'Not Available', 'Not Available', 'Not Available', 'Not Available', 'Not Available', '105', '5.970', '25900.00', '154623.00', '74.00', '0.00', '0.00', '9.20', '0.00', '0.00', '0.00', '0.00', '-', '-', '-', '-', '-', '-', '-', '-', '-', '-', '154623.00', ''];
                      const buffer = await generateSampleExcel({
                        headers,
                        sampleRows: [sampleRow1, sampleRow2],
                        masterList: {
                          locations: locList,
                          warehouses: whList,
                          commodities: commList,
                          customers: customerList.map((c: any) => getDisplayName(c)),
                          states: statesList,
                          locationsByState,
                          warehousesByLocationKey,
                          varietiesByCommodityKey: Object.keys(varietiesByCommodityKey).length > 0 ? varietiesByCommodityKey : undefined,
                        },
                        sheetName: 'Sample Data',
                        dropdownColumns: [
                          { columnIndex: 2, formula: 'States' },     // State (B)
                          { columnIndex: 3, formula: 'Customers' },   // Supplier (C)
                          { columnIndex: 4, formula: 'Locations' },  // Location (D) - fixed list, opens in all Excel
                          { columnIndex: 5, formula: 'Warehouses' },  // Warehouse (E) - fixed list, opens in all Excel
                          { columnIndex: 7, formula: 'Commodities' }, // Commodity (G)
                          { columnIndex: 8, formula: 'Varieties' },   // Variety (H) - fixed list, opens in all Excel
                        ],
                      });
                      downloadExcelBuffer(buffer, 'sample_confirmed_purchase_order.xlsx');
                      showSuccess('Sample Excel sheet downloaded.');
                    } catch (error: any) {
                      showError('Failed to generate sample Excel: ' + (error.message || 'Unknown error'));
                    }
                  }}
                  className="px-3 py-1 bg-blue-600 text-white text-sm rounded hover:bg-blue-700 flex items-center gap-1"
                >
                  <FileSpreadsheet className="w-4 h-4" />
                  Download Sample Excel Sheet
                </button>
                </div>
              </div>
              <ul className="text-sm text-blue-800 space-y-1 list-disc list-inside">
                <li>First row should contain column headers</li>
                <li>Required columns: Vehicle No, Net Weight (MT), Rate per MT</li>
                <li>Optional columns: Transaction Date, Commodity, Variety, Gross Weight (MT), Tare Weight (MT), No of Bags, Gross Amount, and all quality parameters</li>
                <li>Each row represents one confirmed purchase order</li>
              </ul>
            </div>

            <FileFormatRequirementsModal
              open={showFormatRequirements}
              onClose={() => setShowFormatRequirements(false)}
              type="purchase"
            />

            {duplicateChoice && (
              <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50" onClick={() => setDuplicateChoice(null)}>
                <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6" onClick={(e) => e.stopPropagation()}>
                  <h3 className="text-lg font-semibold text-gray-900 mb-2">Duplicate rows found</h3>
                  <p className="text-sm text-gray-600 mb-4">
                    {duplicateChoice.duplicateCount} duplicate row(s) found (out of {duplicateChoice.totalRows} total). Duplicates are rows with the same State, Supplier, Location, Warehouse, Date, Vehicle No., and Net Weight.
                  </p>
                  <p className="text-sm text-gray-600 mb-4">How do you want to proceed?</p>
                  <div className="flex gap-3">
                    <button
                      type="button"
                      onClick={() => handleBulkUpload(true)}
                      className="flex-1 px-4 py-2 bg-amber-500 text-white rounded-lg hover:bg-amber-600 font-medium"
                    >
                      Skip duplicates (keep first)
                    </button>
                    <button
                      type="button"
                      onClick={() => handleBulkUpload(false)}
                      className="flex-1 px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 font-medium"
                    >
                      Keep all
                    </button>
                    <button
                      type="button"
                      onClick={() => setDuplicateChoice(null)}
                      className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              </div>
            )}

            {uploadFile && (
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={async () => {
                    if (!uploadFile) {
                      showError('Please select a file first');
                      return;
                    }

                    try {
                      const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';
                      const token = localStorage.getItem('auth_token');

                      if (!token) {
                        showError('Authentication required. Please sign in again.');
                        return;
                      }

                      const formData = new FormData();
                      formData.append('file', uploadFile);

                      const response = await fetch(`${apiUrl}/confirmed-purchase-orders/bulk-upload/preview`, {
                        method: 'POST',
                        headers: {
                          'Authorization': `Bearer ${token}`,
                        },
                        body: formData,
                      });

                      const result = await response.json();

                      if (!response.ok) {
                        throw new Error(result.error || result.message || 'Preview failed');
                      }

                      setAvailableColumns(result.columns || []);
                      setPreviewRows(result.previewRows || []);
                      setShowMappingDialog(true);
                    } catch (err: any) {
                      showError(err.message || 'Failed to preview file. Please try again.');
                    }
                  }}
                  className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 px-6 rounded-lg transition-colors flex items-center justify-center gap-2"
                >
                  <Map className="w-5 h-5" />
                  Map Columns
                </button>
              </div>
            )}

            {uploadErrors.length > 0 && (
              <div className="mt-4 border border-red-200 bg-red-50 rounded-lg">
                <div className="px-4 py-2 font-semibold text-red-800 flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4" />
                  Validation errors found in your file ({uploadErrors.length})
                </div>
                <ul className="divide-y divide-red-100 max-h-60 overflow-y-auto">
                  {uploadErrors.map((err, idx) => (
                    <li key={idx} className="px-4 py-2 text-sm text-red-700 bg-red-50">
                      {err}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <button
              type="button"
              onClick={() => handleBulkUpload(false)}
              disabled={uploading || !uploadFile}
              className="w-full bg-green-600 hover:bg-green-700 text-white font-semibold py-3 px-6 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {uploading ? (
                <>
                  <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                  Uploading...
                </>
              ) : (
                <>
                  <Upload className="w-5 h-5" />
                  Upload & Submit
                </>
              )}
            </button>
          </div>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="bg-white rounded-lg shadow-lg p-8 space-y-8">
        {/* Basic Information */}
        <div className="border-b border-gray-200 pb-6">
          <h2 className="text-xl font-semibold text-gray-800 mb-4">Basic Information</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Supplier Name <span className="text-red-500">*</span>
              </label>
              <select
                value={customerId}
                onChange={(e) => {
                  const selectedCustomer = customers.find(c => c.id === e.target.value);
                  setCustomerId(e.target.value);
                  setSupplierName(getDisplayName(selectedCustomer));
                }}
                required
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
              >
                <option value="">Select Supplier Name</option>
                {customers.map((customer) => (
                  <option key={customer.id} value={customer.id}>
                    {getDisplayName(customer)}{customer.name && customer.name !== getDisplayName(customer) ? ` (${customer.name})` : ''} ({customer.email})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Transaction Date <span className="text-red-500">*</span>
              </label>
              <input
                type="date"
                value={transactionDate}
                onChange={(e) => setTransactionDate(e.target.value)}
                required
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">State</label>
              <select
                value={state}
                onChange={(e) => setState(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
              >
                <option value="">Select State</option>
                {indianStates.map((s) => (
                  <option key={s} value={s}>{toUpperText(s)}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Location</label>
              <select
                value={locationId}
                onChange={(e) => setLocationId(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                disabled={!state}
              >
                <option value="">Select Location</option>
                {locations.map((loc) => (
                  <option key={loc.id} value={loc.id}>{loc.name}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Warehouse Name</label>
              <select
                value={warehouseName}
                onChange={(e) => setWarehouseName(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                disabled={!locationId}
              >
                <option value="">Select Warehouse</option>
                {warehouses.map((wh) => (
                  <option key={wh} value={wh}>{wh}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Chamber No.</label>
              <input
                type="text"
                value={chamberNo}
                onChange={(e) => setChamberNo(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                placeholder="Enter chamber number"
              />
            </div>
          </div>
        </div>

        {/* Commodity Information */}
        <div className="border-b border-gray-200 pb-6">
          <h2 className="text-xl font-semibold text-gray-800 mb-4">Commodity Information</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Commodity <span className="text-red-500">*</span>
              </label>
              <select
                value={commodity}
                onChange={(e) => {
                  setCommodity(e.target.value);
                  setVariety('');
                }}
                required
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
              >
                <option value="">Select Commodity</option>
                {commodities.map((c) => (
                  <option key={c} value={c}>{toUpperText(c)}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Variety</label>
              <select
                value={variety}
                onChange={(e) => setVariety(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
              >
                <option value="">Select Variety</option>
                {varieties.map((v) => (
                  <option key={v} value={v}>{toUpperText(v)}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Gate Pass No.</label>
              <input
                type="text"
                value={gatePassNo}
                onChange={(e) => setGatePassNo(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                placeholder="Enter gate pass number"
              />
            </div>
          </div>
        </div>

        {/* Vehicle & Weight Information */}
        <div className="border-b border-gray-200 pb-6">
          <h2 className="text-xl font-semibold text-gray-800 mb-4">Vehicle & Weight Information</h2>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Vehicle No. <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={vehicleNo}
                onChange={(e) => setVehicleNo(e.target.value)}
                required
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                placeholder="Enter vehicle number"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Weight Slip No. (RST)</label>
              <input
                type="text"
                value={weightSlipNo}
                onChange={(e) => setWeightSlipNo(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                placeholder="Enter weight slip number"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Gross Weight (MT)</label>
              <input
                type="number"
                step="0.01"
                value={grossWeightMt || ''}
                onChange={(e) => setGrossWeightMt(Number(e.target.value))}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                placeholder="0.00"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Tare Weight (MT)</label>
              <input
                type="number"
                step="0.01"
                value={tareWeightMt || ''}
                onChange={(e) => setTareWeightMt(Number(e.target.value))}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                placeholder="0.00"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">No. of Bags</label>
              <input
                type="number"
                value={noOfBags || ''}
                onChange={(e) => setNoOfBags(Number(e.target.value))}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                placeholder="0"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Net Weight (MT) <span className="text-red-500">*</span></label>
              <input
                type="number"
                step="0.01"
                value={netWeightMt || ''}
                readOnly
                className="w-full px-4 py-2 border border-gray-300 rounded-lg bg-gray-50 font-bold"
                placeholder="Auto-calculated"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Rate Per MT <span className="text-red-500">*</span></label>
              <input
                type="number"
                step="0.01"
                value={ratePerMt || ''}
                onChange={(e) => setRatePerMt(Number(e.target.value))}
                required
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                placeholder="0.00"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Gross Amount</label>
              <input
                type="number"
                step="0.01"
                value={grossAmount || ''}
                readOnly
                className="w-full px-4 py-2 border border-gray-300 rounded-lg bg-gray-50 font-bold"
                placeholder="Auto-calculated"
              />
            </div>
          </div>
        </div>

        {/* Quality Parameters & Deductions */}
        <div className="border-b border-gray-200 pb-6">
          <h2 className="text-xl font-semibold text-gray-800 mb-4">Quality Parameters & Deductions</h2>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">HLW (Wheat)</label>
              <input
                type="number"
                step="0.01"
                value={hlwWheat || ''}
                onChange={(e) => setHlwWheat(Number(e.target.value))}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                placeholder="Enter Hectolitre Weight (e.g., 78.5)"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Excess HLW</label>
              <input
                type="number"
                step="0.01"
                value={excessHlw || ''}
                onChange={(e) => setExcessHlw(Number(e.target.value))}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                placeholder="Enter excess HLW value (e.g., 2.5)"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Deduction Amount (HLW) ₹</label>
              <input
                type="number"
                step="0.01"
                value={deductionAmountHlw || ''}
                onChange={(e) => setDeductionAmountHlw(Number(e.target.value))}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                placeholder="Enter deduction amount in ₹ (e.g., 500.00)"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Moisture (MOI)</label>
              <input
                type="number"
                step="0.01"
                value={moistureMoi || ''}
                onChange={(e) => setMoistureMoi(Number(e.target.value))}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                placeholder="Enter moisture percentage (e.g., 14.5)"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Excess Moisture</label>
              <input
                type="number"
                step="0.01"
                value={excessMoisture || ''}
                onChange={(e) => setExcessMoisture(Number(e.target.value))}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                placeholder="Enter excess moisture value (e.g., 1.5)"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">BDDI</label>
              <input
                type="number"
                step="0.01"
                value={bddi || ''}
                onChange={(e) => setBddi(Number(e.target.value))}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                placeholder="Enter BDDI value (Broken, Damage, Discolour, Immature)"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Excess BDDI</label>
              <input
                type="number"
                step="0.01"
                value={excessBddi || ''}
                onChange={(e) => setExcessBddi(Number(e.target.value))}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                placeholder="Enter excess BDDI value (e.g., 2.0)"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">MOI+BDDI</label>
              <input
                type="number"
                step="0.01"
                value={moiBddi || ''}
                readOnly
                className="w-full px-4 py-2 border border-gray-300 rounded-lg bg-gray-50 font-bold"
                placeholder="Auto-calculated (Excess Moisture + Excess BDDI)"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Weight Deduction (KG)</label>
              <input
                type="number"
                step="0.01"
                value={weightDeductionKg || ''}
                onChange={(e) => setWeightDeductionKg(Number(e.target.value))}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                placeholder="Enter weight deduction in KG (e.g., 50.00)"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Deduction Amount (MOI+BDDI) ₹</label>
              <input
                type="number"
                step="0.01"
                value={deductionAmountMoiBddi || ''}
                onChange={(e) => setDeductionAmountMoiBddi(Number(e.target.value))}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                placeholder="Enter deduction amount in ₹ (e.g., 750.00)"
              />
            </div>
          </div>

          {/* Other Deductions */}
          <div className="mt-6">
            <h3 className="text-lg font-semibold text-gray-800 mb-4">Other Deductions</h3>
            <div className="space-y-4">
              {otherDeductions.map((deduction, index) => (
                <div key={index} className="border border-gray-200 rounded-lg p-4 bg-gray-50">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Other Deduction {index + 1} Amount ₹ {deduction.amount > 0 && <span className="text-red-500">*</span>}
                      </label>
                      <input
                        type="number"
                        step="0.01"
                        value={deduction.amount || ''}
                        onChange={(e) => {
                          const updated = [...otherDeductions];
                          updated[index].amount = Number(e.target.value) || 0;
                          setOtherDeductions(updated);
                        }}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                        placeholder="0.00"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Remarks {deduction.amount > 0 && <span className="text-red-500">*</span>}
                      </label>
                      <input
                        type="text"
                        value={deduction.remarks}
                        onChange={(e) => {
                          const updated = [...otherDeductions];
                          updated[index].remarks = e.target.value;
                          setOtherDeductions(updated);
                        }}
                        required={deduction.amount > 0}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                        placeholder="Enter remarks for this deduction"
                      />
                    </div>
                  </div>
                  {otherDeductions.length > 1 && (
                    <button
                      type="button"
                      onClick={() => {
                        const updated = otherDeductions.filter((_, i) => i !== index);
                        setOtherDeductions(updated);
                      }}
                      className="mt-2 text-red-600 hover:text-red-800 text-sm font-medium"
                    >
                      Remove
                    </button>
                  )}
                </div>
              ))}
              <button
                type="button"
                onClick={() => setOtherDeductions([...otherDeductions, { amount: 0, remarks: '' }])}
                className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors font-medium"
              >
                <span className="text-xl">+</span>
                Add Another Deduction
              </button>
            </div>
          </div>
        </div>

        {/* Final Amounts */}
        <div className="border-b border-gray-200 pb-6">
          <h2 className="text-xl font-semibold text-gray-800 mb-4">Final Amounts</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Total Deduction ₹</label>
              <input
                type="number"
                step="0.01"
                value={
                  deductionAmountHlw +
                  deductionAmountMoiBddi +
                  otherDeductions.reduce((sum, ded) => sum + (ded.amount || 0), 0)
                }
                readOnly
                className="w-full px-4 py-2 border border-gray-300 rounded-lg bg-yellow-50 font-bold text-lg"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Net Amount ₹ <span className="text-red-500">*</span></label>
              <input
                type="number"
                step="0.01"
                value={grossAmount - (
                  deductionAmountHlw +
                  deductionAmountMoiBddi +
                  otherDeductions.reduce((sum, ded) => sum + (ded.amount || 0), 0)
                )}
                readOnly
                className="w-full px-4 py-2 border border-gray-300 rounded-lg bg-green-50 font-bold text-lg text-green-700"
              />
            </div>
          </div>
        </div>

        {/* Additional Information */}
        <div className="border-b border-gray-200 pb-6">
          <h2 className="text-xl font-semibold text-gray-800 mb-4">Additional Information</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Delivery Location</label>
              <input
                type="text"
                value={deliveryLocation}
                onChange={(e) => setDeliveryLocation(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                placeholder="Enter delivery location"
              />
            </div>
          </div>
        </div>

        {/* Remarks */}
        <div className="pb-6">
          <label className="block text-sm font-medium text-gray-700 mb-2">Remarks</label>
          <textarea
            value={remarks}
            onChange={(e) => setRemarks(e.target.value)}
            rows={4}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
            placeholder="Enter any additional remarks or notes"
          />
        </div>

        {/* Submit Button */}
        <div className="flex justify-end gap-4 pt-6 border-t border-gray-200">
          <button
            type="button"
            onClick={resetForm}
            className="px-6 py-3 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors font-medium"
          >
            Reset
          </button>
          <button
            type="submit"
            disabled={submitting}
            className="px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors font-medium flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Save className="w-5 h-5" />
            {submitting ? 'Submitting...' : 'Confirm Purchase Order'}
          </button>
        </div>
      </form>
      )}

      <ColumnMappingDialog
        isOpen={showMappingDialog}
        onClose={() => setShowMappingDialog(false)}
        onConfirm={(mapping) => {
          setColumnMapping(mapping);
          setShowMappingDialog(false);
          showSuccess('Column mapping saved! You can now upload the file.');
        }}
        availableColumns={availableColumns}
        requiredFields={[
          { key: 'supplier_name', label: 'Supplier Name', required: true },
          { key: 'transaction_date', label: 'Transaction Date', required: false },
          { key: 'state', label: 'State', required: false },
          { key: 'location', label: 'Location', required: false },
          { key: 'warehouse_name', label: 'Warehouse Name', required: false },
          { key: 'chamber_no', label: 'Chamber No', required: false },
          { key: 'commodity', label: 'Commodity', required: false },
          { key: 'variety', label: 'Variety', required: false },
          { key: 'gate_pass_no', label: 'Gate Pass No', required: false },
          { key: 'vehicle_no', label: 'Vehicle No', required: true },
          { key: 'weight_slip_no', label: 'Weight Slip No', required: false },
          { key: 'gross_weight_mt', label: 'Gross Weight (MT)', required: false },
          { key: 'tare_weight_mt', label: 'Tare Weight (MT)', required: false },
          { key: 'no_of_bags', label: 'No. of Bags', required: false },
          { key: 'net_weight_mt', label: 'Net Weight (MT)', required: true },
          { key: 'rate_per_mt', label: 'Rate Per MT', required: true },
          { key: 'gross_amount', label: 'Gross Amount', required: false },
          { key: 'hlw_wheat', label: 'HLW (Wheat)', required: false },
          { key: 'excess_hlw', label: 'Excess HLW', required: false },
          { key: 'deduction_amount_hlw', label: 'Deduction Amount (HLW)', required: false },
          { key: 'moisture_moi', label: 'Moisture (MOI)', required: false },
          { key: 'excess_moisture', label: 'Excess Moisture', required: false },
          { key: 'bddi', label: 'BDDI', required: false },
          { key: 'excess_bddi', label: 'Excess BDDI', required: false },
          { key: 'moi_bddi', label: 'MOI+BDDI', required: false },
          { key: 'weight_deduction_kg', label: 'Weight Deduction (KG)', required: false },
          { key: 'deduction_amount_moi_bddi', label: 'Deduction Amount (MOI+BDDI)', required: false },
          { key: 'other_deduction_1', label: 'Other Deduction 1', required: false },
          { key: 'other_deduction_2', label: 'Other Deduction 2', required: false },
          { key: 'other_deduction_3', label: 'Other Deduction 3', required: false },
          { key: 'other_deduction_4', label: 'Other Deduction 4', required: false },
          { key: 'other_deduction_5', label: 'Other Deduction 5', required: false },
          { key: 'other_deduction_6', label: 'Other Deduction 6', required: false },
          { key: 'other_deduction_7', label: 'Other Deduction 7', required: false },
          { key: 'other_deduction_8', label: 'Other Deduction 8', required: false },
          { key: 'other_deduction_9', label: 'Other Deduction 9', required: false },
          { key: 'other_deduction_10', label: 'Other Deduction 10', required: false },
          { key: 'net_amount', label: 'Net Amount', required: false },
          { key: 'delivery_location', label: 'Delivery Location', required: false },
          { key: 'remarks', label: 'Remarks', required: false },
        ]}
        previewRows={previewRows}
      />
    </div>
  );
}
