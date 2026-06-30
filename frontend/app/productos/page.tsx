/* eslint-disable @next/next/no-img-element */
/* eslint-disable react-hooks/exhaustive-deps */
/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable react-hooks/set-state-in-effect */
'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import AppLayout from '@/components/AppLayout';
import api from '@/lib/api';
import type { Product, ProductCategory, ProductComponent } from '@/types';
import {
  categoryName,
  fmtMoney,
  normalizeArray,
} from '@/lib/helpers';
import {
  Layers,
  Package,
  Plus,
  Search,
  Trash2,
  Edit2,
  X,
  Tags,
  RefreshCcw,
  ImagePlus,
  AlertTriangle,
  CheckCircle2,
  Calculator,
  ScanBarcode,
} from 'lucide-react';

type Modal = 'product-create' | 'product-edit' | 'category' | 'sku-scanner' | 'stock-notice' | null;
type ProductFormStep = 'basico' | 'precios' | 'componentes';
type ProductSortMode = 'default' | 'name-asc' | 'name-desc' | 'category-asc' | 'category-desc';
type SkuScannerMode = 'form' | 'search';
type ComponentForm = { componentId: string; quantity: string; quantityKg: string };

type ToastState = {
  type: 'success' | 'error';
  message: string;
} | null;

type ConfirmState = {
  title: string;
  message: string;
  confirmText?: string;
  danger?: boolean;
  onConfirm: () => Promise<void> | void;
} | null;

type PaginatedProductsResponse = {
  data: Product[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
};

const emptyProductForm = {
  name: '',
  description: '',
  sku: '',
  type: 'SIMPLE',
  categoryId: '',
  isService: 'false',
  saleUnit: 'UNIT',
  price: '',
  clientPrice: '',
  wholesalePrice: '',
  purchasePrice: '',
  ivaPorcentaje: '21',
  pricePerKg: '',
  clientPricePerKg: '',
  wholesalePricePerKg: '',
  stockLocal: '0',
  stockDeposito: '0',
  stockLocalKg: '0',
  stockDepositoKg: '0',
  minStock: '0',
  minStockDeposito: '0',
  minStockKg: '0',
  minStockDepositoKg: '0',
};

const PRODUCTS_PAGE_SIZE = 12;

const EMPTY_PROFIT_CALC = {
  cost: '',
  minoristPrice: '',
  wholesalePrice: '',
};

const PROFIT_CALCULATOR_STORAGE_KEY = 'comarpos-products-profit-calculator';
const SKU_SCANNER_ELEMENT_ID = 'comarpos-sku-scanner';
const MAX_PRODUCT_IMAGE_SIZE_MB = 5;
const MAX_PRODUCT_IMAGE_SIZE_BYTES = MAX_PRODUCT_IMAGE_SIZE_MB * 1024 * 1024;
const PRODUCT_IMAGE_ACCEPT = 'image/*,.heic,.heif';

function num(value: unknown, fallback = 0): number {
  if (value === null || value === undefined || value === '') return fallback;

  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : fallback;
  }

  const raw = String(value)
    .trim()
    .replace(/\s/g, '')
    .replace(/\$/g, '');

  if (!raw) return fallback;

  const hasComma = raw.includes(',');
  const hasDot = raw.includes('.');

  let normalized = raw;

  if (hasComma && hasDot) {
    // Formato argentino: 1.234,56 => 1234.56
    normalized = raw.replace(/\./g, '').replace(',', '.');
  } else if (hasComma) {
    // Decimal con coma: 2500,50 => 2500.50
    normalized = raw.replace(',', '.');
  } else if (hasDot) {
    const isThousandsOnly = /^-?\d{1,3}(\.\d{3})+$/.test(raw);

    // 2.500 debe ser 2500, no 2.5.
    normalized = isThousandsOnly ? raw.replace(/\./g, '') : raw;
  }

  const parsed = Number(normalized);

  return Number.isFinite(parsed) ? parsed : fallback;
}

function getInitialProfitCalculator() {
  if (typeof window === 'undefined') return EMPTY_PROFIT_CALC;

  try {
    const saved = window.localStorage.getItem(PROFIT_CALCULATOR_STORAGE_KEY);
    if (!saved) return EMPTY_PROFIT_CALC;

    const parsed = JSON.parse(saved) as Partial<typeof EMPTY_PROFIT_CALC>;

    return {
      cost: String(parsed.cost ?? ''),
      minoristPrice: String(parsed.minoristPrice ?? ''),
      wholesalePrice: String(parsed.wholesalePrice ?? ''),
    };
  } catch {
    return EMPTY_PROFIT_CALC;
  }
}


function getProductPublicPrice(product: Product) {
  return product.saleUnit === 'KG'
    ? num((product as any).pricePerKg ?? product.price)
    : num(product.price);
}


function getProductWholesalePrice(product: Product) {
  const fallback = getProductPublicPrice(product);

  return product.saleUnit === 'KG'
    ? num(
        (product as any).wholesalePricePerKg ??
          (product as any).wholesalePrice ??
          fallback
      )
    : num((product as any).wholesalePrice ?? fallback);
}



function getDirectGrossCost(product: Product): number {
  return num(
    (product as any).grossCost ??
      (product as any).costPrice ??
      (product as any).costPriceGross ??
      (product as any).costoBruto ??
      (product as any).costoCompra ??
      (product as any).purchaseCost ??
      (product as any).purchasePrice ??
      0
  );
}

function getProductGrossCost(product: Product): number {
  const directCost = getDirectGrossCost(product);

  if (directCost > 0 || product.type !== 'COMPUESTO') return directCost;

  return (product.components ?? []).reduce((total: number, relation: ProductComponent): number => {
    const component = relation.component as Product | undefined;
    if (!component) return total;

    const quantity =
      component.saleUnit === 'KG'
        ? num(relation.quantityKg ?? relation.quantity ?? 0)
        : num(relation.quantity ?? relation.quantityKg ?? 0);

    return total + getProductGrossCost(component) * quantity;
  }, 0);
}

function getPriceProfit(price: number, cost: number): number {
  return price - cost;
}

function getPriceProfitPercent(price: number, cost: number): number | null {
  if (cost <= 0 || price <= 0) return null;

  return (getPriceProfit(price, cost) / price) * 100;
}

function getProductMinoristProfit(product: Product): number {
  return getPriceProfit(getProductPublicPrice(product), getProductGrossCost(product));
}

function getProductMinoristProfitPercent(product: Product): number | null {
  return getPriceProfitPercent(getProductPublicPrice(product), getProductGrossCost(product));
}

function getProductWholesaleProfit(product: Product): number {
  return getPriceProfit(getProductWholesalePrice(product), getProductGrossCost(product));
}

function getProductWholesaleProfitPercent(product: Product): number | null {
  return getPriceProfitPercent(getProductWholesalePrice(product), getProductGrossCost(product));
}

function getProfit(product: Product): number {
  return getProductMinoristProfit(product);
}

function getProfitPercent(product: Product): number | null {
  return getProductMinoristProfitPercent(product);
}

function formatPercent(value: number | null): string {
  return value === null ? 'Sin costo' : `${value.toFixed(1)}%`;
}

function profitColor(value: number): string {
  return value >= 0 ? 'var(--success)' : 'var(--danger)';
}

function unitSuffix(product: Product) {
  return product.saleUnit === 'KG' ? '/kg' : '';
}

function getProductStockMayorista(product: Product): number {
  return product.saleUnit === 'KG'
    ? num((product as any).stockLocalKg)
    : num((product as any).stockLocal);
}

function getProductStockMinorista(product: Product): number {
  return product.saleUnit === 'KG'
    ? num((product as any).stockDepositoKg)
    : num((product as any).stockDeposito);
}

function getProductMinStockMayorista(product: Product): number {
  return product.saleUnit === 'KG'
    ? num((product as any).minStockKg)
    : num((product as any).minStock);
}

function getProductMinStockMinorista(product: Product): number {
  return product.saleUnit === 'KG'
    ? num((product as any).minStockDepositoKg)
    : num((product as any).minStockDeposito);
}

function isProductLowStockMayorista(product: Product): boolean {
  if ((product as any).isService) return false;

  const stock = getProductStockMayorista(product);
  const minStock = getProductMinStockMayorista(product);

  return minStock > 0 && stock <= minStock;
}

function isProductLowStockMinorista(product: Product): boolean {
  if ((product as any).isService) return false;

  const stock = getProductStockMinorista(product);
  const minStock = getProductMinStockMinorista(product);

  return minStock > 0 && stock <= minStock;
}

function isProductLowStock(product: Product): boolean {
  return isProductLowStockMayorista(product) || isProductLowStockMinorista(product);
}

function stockLabel(product: Product, stock: number) {
  return `${stock}${product.saleUnit === 'KG' ? ' kg' : ''}`;
}

function isValidImageFile(file: File): boolean {
  const mime = file.type?.toLowerCase() ?? '';
  const extension = file.name.split('.').pop()?.toLowerCase() ?? '';

  return (
    mime.startsWith('image/') ||
    ['jpg', 'jpeg', 'png', 'webp', 'heic', 'heif'].includes(extension)
  );
}


export default function ProductosPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [allProducts, setAllProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<ProductCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingAllProducts, setLoadingAllProducts] = useState(false);
  const [modal, setModal] = useState<Modal>(null);
  const [editing, setEditing] = useState<Product | null>(null);
  const [pendingProductAction, setPendingProductAction] = useState<
    { type: 'create' } | { type: 'edit'; product: Product } | null
  >(null);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [form, setForm] = useState<Record<string, string>>(emptyProductForm);
  const [productFormStep, setProductFormStep] = useState<ProductFormStep>('basico');
  const [components, setComponents] = useState<ComponentForm[]>([]);
  const [categoryForm, setCategoryForm] = useState({ name: '', description: '' });
  const [profitCalc, setProfitCalc] = useState(getInitialProfitCalculator);
  const [showProfitCalculator, setShowProfitCalculator] = useState(false);
  const [sortMode, setSortMode] = useState<ProductSortMode>('default');
  const [scannerError, setScannerError] = useState('');
  const [scannerLoading, setScannerLoading] = useState(false);
  const scannerInstanceRef = useRef<any>(null);
  const scannerHandledRef = useRef(false);
  const skuScannerModeRef = useRef<SkuScannerMode>('form');
  const productModalBeforeScannerRef = useRef<Modal>(null);
  const galleryImageInputRef = useRef<HTMLInputElement | null>(null);
  const cameraImageInputRef = useRef<HTMLInputElement | null>(null);

  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState('');

  const [toast, setToast] = useState<ToastState>(null);
  const [confirmModal, setConfirmModal] = useState<ConfirmState>(null);
  const [confirmLoading, setConfirmLoading] = useState(false);
  const [mobileProductSheet, setMobileProductSheet] = useState<Product | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalProducts, setTotalProducts] = useState(0);
  const [totalPages, setTotalPages] = useState(1);

  const showToast = (type: 'success' | 'error', message: string) => {
    setToast({ type, message });

    window.setTimeout(() => {
      setToast(null);
    }, 3200);
  };

  const load = async () => {
    setLoading(true);

    try {
      const params = new URLSearchParams();

      params.set('page', String(currentPage));
      params.set('limit', String(PRODUCTS_PAGE_SIZE));

      if (search.trim()) params.set('search', search.trim());
      if (categoryId) params.set('categoryId', categoryId);
      if (sortMode) params.set('sort', sortMode);

      const [pRes, cRes] = await Promise.all([
        api.get(`/products?${params.toString()}`),
        api.get('/categories?includeInactive=true'),
      ]);

      const paginated = pRes.data as PaginatedProductsResponse | Product[];

      if (Array.isArray(paginated)) {
        const list = normalizeArray<Product>(paginated);

        setProducts(list);
        setTotalProducts(list.length);
        setTotalPages(Math.max(1, Math.ceil(list.length / PRODUCTS_PAGE_SIZE)));
      } else {
        const list = normalizeArray<Product>(paginated.data);

        setProducts(list);
        setTotalProducts(Number(paginated.total ?? list.length));
        setTotalPages(Math.max(1, Number(paginated.totalPages ?? 1)));
      }

      setCategories(normalizeArray<ProductCategory>(cRes.data));
    } catch (e) {
      console.error(e);
      showToast('error', 'Error al cargar productos');
    } finally {
      setLoading(false);
    }
  };

  const loadAllProductsForComponents = async () => {
    if (allProducts.length > 0 || loadingAllProducts) return;

    setLoadingAllProducts(true);

    try {
      const res = await api.get('/products');
      setAllProducts(normalizeArray<Product>(res.data));
    } catch (e) {
      console.error(e);
      showToast('error', 'Error al cargar productos para componentes');
    } finally {
      setLoadingAllProducts(false);
    }
  };

  useEffect(() => {
    load();
  }, [currentPage, search, categoryId, sortMode]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    window.localStorage.setItem(PROFIT_CALCULATOR_STORAGE_KEY, JSON.stringify(profitCalc));
  }, [profitCalc]);

  useEffect(() => {
    return () => {
      if (imagePreview?.startsWith('blob:')) {
        URL.revokeObjectURL(imagePreview);
      }
    };
  }, [imagePreview]);

  useEffect(() => {
    if (productFormStep === 'componentes' && (form.isService === 'true' || form.type !== 'COMPUESTO')) {
      setProductFormStep('basico');
    }
  }, [form.isService, form.type, productFormStep]);

  const componentProductsSource = allProducts.length > 0 ? allProducts : products;

  const simpleProducts = useMemo(
    () =>
      componentProductsSource.filter(
        (p) =>
          p.type === 'SIMPLE' &&
          p.isActive !== false &&
          (p as any).isService !== true
      ),
    [componentProductsSource]
  );

  const paginatedProducts = products;

  const pageStart = totalProducts ? (currentPage - 1) * PRODUCTS_PAGE_SIZE + 1 : 0;
  const pageEnd = Math.min(currentPage * PRODUCTS_PAGE_SIZE, totalProducts);

  useEffect(() => {
    setCurrentPage(1);
  }, [search, categoryId, sortMode]);

  useEffect(() => {
    if (currentPage > totalPages) {
      setCurrentPage(totalPages);
    }
  }, [currentPage, totalPages]);

  const profitCalculatorResult = useMemo(() => {
    const cost = num(profitCalc.cost);
    const minoristPrice = num(profitCalc.minoristPrice);
    const wholesalePrice = num(profitCalc.wholesalePrice);

    return {
      cost,
      minoristProfit: getPriceProfit(minoristPrice, cost),
      minoristPercent: getPriceProfitPercent(minoristPrice, cost),
      wholesaleProfit: getPriceProfit(wholesalePrice, cost),
      wholesalePercent: getPriceProfitPercent(wholesalePrice, cost),
    };
  }, [profitCalc]);

  const formCost = num(form.purchasePrice);
  const formMinoristPrice = form.saleUnit === 'KG' ? num(form.pricePerKg) : num(form.price);
  const formWholesalePrice =
    form.saleUnit === 'KG' ? num(form.wholesalePricePerKg) : num(form.wholesalePrice);
  const formMinoristProfit = getPriceProfit(formMinoristPrice, formCost);
  const formWholesaleProfit = getPriceProfit(formWholesalePrice, formCost);
  const formMinoristPercent = getPriceProfitPercent(formMinoristPrice, formCost);
  const formWholesalePercent = getPriceProfitPercent(formWholesalePrice, formCost);

  const resetImage = () => {
    if (imagePreview?.startsWith('blob:')) {
      URL.revokeObjectURL(imagePreview);
    }

    setImageFile(null);
    setImagePreview('');

    if (galleryImageInputRef.current) galleryImageInputRef.current.value = '';
    if (cameraImageInputRef.current) cameraImageInputRef.current.value = '';
  };

  const openCreate = () => {
    setPendingProductAction({ type: 'create' });
    setModal('stock-notice');
  };

  const openEdit = (product: Product) => {
    setPendingProductAction({ type: 'edit', product });
    setModal('stock-notice');
  };

  const proceedCreate = () => {
    setEditing(null);
    setForm({ ...emptyProductForm, categoryId: categories[0]?.id ?? '' });
    setComponents([]);
    resetImage();
    setProductFormStep('basico');
    setModal('product-create');
    void loadAllProductsForComponents();
  };

  const proceedEdit = (product: Product) => {
    setEditing(product);
    setForm({
      name: product.name ?? '',
      description: (product as any).description ?? '',
      sku: product.sku ?? '',
      type: product.type,
      categoryId: product.categoryId ?? '',
      isService: String(Boolean((product as any).isService)),
      saleUnit: product.saleUnit,

      price: String(product.price ?? ''),
      clientPrice: String(getProductPublicPrice(product) || ''),
      wholesalePrice: String(product.wholesalePrice ?? ''),
      purchasePrice: String(getProductGrossCost(product) || ''),
      ivaPorcentaje: String((product as any).ivaPorcentaje ?? 21),

      pricePerKg: String(product.pricePerKg ?? ''),
      clientPricePerKg: String((product as any).pricePerKg ?? ''),
      wholesalePricePerKg: String(product.wholesalePricePerKg ?? ''),

      stockLocal: String(product.stockLocal ?? 0),
      stockDeposito: String(product.stockDeposito ?? 0),
      stockLocalKg: String(product.stockLocalKg ?? 0),
      stockDepositoKg: String(product.stockDepositoKg ?? 0),

      minStock: String(product.minStock ?? 0),
      minStockDeposito: String((product as any).minStockDeposito ?? 0),
      minStockKg: String(product.minStockKg ?? 0),
      minStockDepositoKg: String((product as any).minStockDepositoKg ?? 0),
    });

    setComponents(
      (product.components ?? []).map((c) => ({
        componentId: c.componentId,
        quantity: String(c.quantity ?? ''),
        quantityKg: String(c.quantityKg ?? ''),
      }))
    );

    setImageFile(null);
    setImagePreview(product.imageUrl ?? '');
    setProductFormStep('basico');
    setModal('product-edit');
    void loadAllProductsForComponents();
  };

  const confirmStockNotice = () => {
    if (!pendingProductAction) {
      setModal(null);
      return;
    }

    if (pendingProductAction.type === 'create') {
      proceedCreate();
    } else {
      proceedEdit(pendingProductAction.product);
    }

    setPendingProductAction(null);
  };

  const handleImageChange = (file?: File | null) => {
    if (!file) return;

    if (file.size <= 0) {
      showToast(
        'error',
        'No se pudo leer la imagen. Si viene de Google Fotos, abrila primero para que se descargue y volvé a seleccionarla.'
      );
      return;
    }

    if (!isValidImageFile(file)) {
      showToast('error', 'El archivo debe ser una imagen JPG, PNG, WEBP, HEIC o HEIF.');
      return;
    }

    if (file.size > MAX_PRODUCT_IMAGE_SIZE_BYTES) {
      showToast('error', `La imagen no puede pesar más de ${MAX_PRODUCT_IMAGE_SIZE_MB}MB.`);
      return;
    }

    if (imagePreview?.startsWith('blob:')) {
      URL.revokeObjectURL(imagePreview);
    }

    setImageFile(file);
    setImagePreview(URL.createObjectURL(file));
  };

  const buildPayloadObject = () => {
    const isService = form.isService === 'true';

    return {
      ...form,

      isService,
      type: isService ? 'SIMPLE' : form.type,
      saleUnit: isService ? 'UNIT' : form.saleUnit,

      description: form.description?.trim() || '',

      price: num(form.price),
      clientPrice: num(form.price),
      wholesalePrice: num(form.wholesalePrice),
      purchasePrice: num(form.purchasePrice),
      ivaPorcentaje: num(form.ivaPorcentaje, 21),

      pricePerKg: form.pricePerKg === '' ? undefined : num(form.pricePerKg),
      clientPricePerKg:
        form.pricePerKg === '' ? undefined : num(form.pricePerKg),
      wholesalePricePerKg:
        form.wholesalePricePerKg === '' ? undefined : num(form.wholesalePricePerKg),

      stockLocal: isService ? 0 : num(form.stockLocal),
      stockDeposito: isService ? 0 : num(form.stockDeposito),
      stockLocalKg: isService ? 0 : num(form.stockLocalKg),
      stockDepositoKg: isService ? 0 : num(form.stockDepositoKg),

      minStock: isService ? 0 : num(form.minStock),
      minStockDeposito: isService ? 0 : num(form.minStockDeposito),
      minStockKg: isService ? 0 : num(form.minStockKg),
      minStockDepositoKg: isService ? 0 : num(form.minStockDepositoKg),

      components:
        !isService && form.type === 'COMPUESTO'
          ? components
              .filter((c) => c.componentId)
              .map((c) => ({
                componentId: c.componentId,
                quantity: c.quantity ? num(c.quantity) : undefined,
                quantityKg: c.quantityKg ? num(c.quantityKg) : undefined,
              }))
          : undefined,
    };
  };

  const buildProductFormData = () => {
    const payload = buildPayloadObject();
    const fd = new FormData();

    Object.entries(payload).forEach(([key, value]) => {
      if (value === undefined || value === null) return;

      if (key === 'components') {
        fd.append(key, JSON.stringify(value));
        return;
      }

      fd.append(key, String(value));
    });

    if (imageFile) {
      fd.append('image', imageFile);
    }

    return fd;
  };

  const saveProduct = async () => {
    setSaving(true);

    try {
      const payload = buildPayloadObject();

      if (modal === 'product-create') {
        const fd = buildProductFormData();

        await api.post('/products', fd);
      }

      if (modal === 'product-edit' && editing) {
        await api.put(`/products/${editing.id}`, payload);

        if (form.type === 'COMPUESTO') {
          await api.put(`/products/${editing.id}/components`, {
            components: payload.components ?? [],
          });
        }

        if (imageFile) {
          const fd = new FormData();
          fd.append('image', imageFile);

          await api.patch(`/products/${editing.id}/image`, fd);
        }
      }

      showToast(
        'success',
        modal === 'product-create'
          ? 'Producto creado correctamente'
          : 'Producto actualizado correctamente'
      );

      setModal(null);
      resetImage();
      await load();
    } catch (e: unknown) {
      showToast(
        'error',
        (e as { response?: { data?: { message?: string } } })?.response?.data
          ?.message ?? 'Error al guardar producto'
      );
    } finally {
      setSaving(false);
    }
  };

  const saveCategory = async () => {
    if (!categoryForm.name.trim()) return;

    setSaving(true);

    try {
      await api.post('/categories', categoryForm);
      setCategoryForm({ name: '', description: '' });
      setModal(null);
      showToast('success', 'Categoría creada correctamente');
      await load();
    } catch (e: unknown) {
      showToast(
        'error',
        (e as { response?: { data?: { message?: string } } })?.response?.data
          ?.message ?? 'Error al crear categoría'
      );
    } finally {
      setSaving(false);
    }
  };

  const deleteProduct = async (product: Product) => {
    setConfirmModal({
      title: 'Eliminar producto',
      message: `¿Eliminar ${product.name}?`,
      confirmText: 'Eliminar',
      danger: true,
      onConfirm: async () => {
        try {
          await api.delete(`/products/${product.id}`);
          await load();
          showToast('success', 'Producto eliminado correctamente');
        } catch (e: unknown) {
          showToast(
            'error',
            (e as { response?: { data?: { message?: string } } })?.response?.data
              ?.message ?? 'Error al eliminar producto'
          );
        }
      },
    });
  };

  const confirmAction = async () => {
    if (!confirmModal) return;

    setConfirmLoading(true);

    try {
      await confirmModal.onConfirm();
      setConfirmModal(null);
    } finally {
      setConfirmLoading(false);
    }
  };

  const addComponent = () =>
    setComponents((prev) => [
      ...prev,
      { componentId: '', quantity: '1', quantityKg: '' },
    ]);

  const setComponent = (
    idx: number,
    key: keyof ComponentForm,
    value: string
  ) =>
    setComponents((prev) =>
      prev.map((c, i) => (i === idx ? { ...c, [key]: value } : c))
    );

  const stopSkuScanner = async () => {
    const scanner = scannerInstanceRef.current;

    scannerHandledRef.current = false;

    if (!scanner) return;

    try {
      const state = scanner.getState?.();

      if (state === 2) {
        await scanner.stop();
      }
    } catch (e) {
      console.warn('No se pudo detener el scanner', e);
    }

    try {
      await scanner.clear?.();
    } catch {
      // html5-qrcode puede tirar error si el contenedor ya fue desmontado.
    }

    scannerInstanceRef.current = null;
  };

  const closeSkuScanner = async () => {
    const previousModal = productModalBeforeScannerRef.current;

    await stopSkuScanner();
    setScannerError('');
    setScannerLoading(false);
    productModalBeforeScannerRef.current = null;
    skuScannerModeRef.current = 'form';

    if (previousModal === 'product-create' || previousModal === 'product-edit') {
      setModal(previousModal);
      return;
    }

    setModal(null);
  };

  const openSkuScanner = (mode: SkuScannerMode = 'form') => {
    skuScannerModeRef.current = mode;
    productModalBeforeScannerRef.current = mode === 'form' ? modal : null;
    setScannerError('');
    setScannerLoading(true);
    scannerHandledRef.current = false;
    setModal('sku-scanner');
  };

  useEffect(() => {
    if (modal !== 'sku-scanner') return;

    let cancelled = false;

    const startScanner = async () => {
      setScannerLoading(true);
      setScannerError('');

      try {
        if (typeof window === 'undefined') return;

        const { Html5Qrcode } = await import('html5-qrcode');

        if (cancelled) return;

        const scanner = new Html5Qrcode(SKU_SCANNER_ELEMENT_ID);
        scannerInstanceRef.current = scanner;

        await scanner.start(
          { facingMode: 'environment' },
          {
            fps: 10,
            qrbox: (viewfinderWidth: number, viewfinderHeight: number) => {
              const size = Math.floor(Math.min(viewfinderWidth, viewfinderHeight) * 0.72);

              return {
                width: Math.max(220, Math.min(size, 340)),
                height: Math.max(120, Math.min(Math.floor(size * 0.55), 220)),
              };
            },
            aspectRatio: 1.777,
          },
          async (decodedText: string) => {
            const sku = decodedText.trim();

            if (!sku || scannerHandledRef.current) return;

            scannerHandledRef.current = true;

            if (skuScannerModeRef.current === 'search') {
              setSearch(sku);
              setCurrentPage(1);
              showToast('success', `Buscando SKU: ${sku}`);
              await closeSkuScanner();
              return;
            }

            setForm((prev) => ({
              ...prev,
              sku,
            }));

            await closeSkuScanner();
          },
          () => {
            // Ignoramos lecturas fallidas mientras la cámara sigue buscando un código.
          }
        );

        if (!cancelled) {
          setScannerLoading(false);
        }
      } catch (e: any) {
        console.error(e);

        if (!cancelled) {
          setScannerLoading(false);
          setScannerError(
            e?.message?.includes('Permission')
              ? 'No se pudo acceder a la cámara. Revisá los permisos del navegador.'
              : 'No se pudo iniciar la cámara. Probá con HTTPS, otro navegador o cargá el SKU manualmente.'
          );
        }
      }
    };

    const timeoutId = window.setTimeout(startScanner, 120);

    return () => {
      cancelled = true;
      window.clearTimeout(timeoutId);
      void stopSkuScanner();
    };
  }, [modal]);

  return (
    <AppLayout
      title="Productos"
      subtitle="Catálogo empresarial, promos y stock"
      actions={
        <div className="products-actions" style={{ display: 'flex', gap: 8 }}>
          <button
            className={`btn btn-secondary btn-sm products-calculator-toggle ${showProfitCalculator ? 'is-active' : ''}`}
            onClick={() => setShowProfitCalculator((prev) => !prev)}
            title={showProfitCalculator ? 'Ocultar calculadora' : 'Abrir calculadora'}
            aria-label={showProfitCalculator ? 'Ocultar calculadora' : 'Abrir calculadora'}
          >
            <Calculator size={16} />
          </button>

          <button className="btn btn-primary btn-sm" onClick={openCreate}>
            <Plus size={14} /> Nuevo producto
          </button>
        </div>
      }
    >
      {toast &&
        typeof document !== 'undefined' &&
        createPortal(
          <div
            className="products-toast"
            style={{
              position: 'fixed',
              top: 18,
              right: 18,
              zIndex: 2147483647,
              minWidth: 280,
              maxWidth: 420,
              borderRadius: 14,
              border:
                toast.type === 'success'
                  ? '1px solid rgba(34,197,94,0.35)'
                  : '1px solid rgba(239,68,68,0.35)',
              background: 'rgba(255,255,255,0.98)',
              boxShadow: '0 20px 60px rgba(0,0,0,0.45)',
              padding: '14px 16px',
              display: 'flex',
              alignItems: 'flex-start',
              gap: 10,
              pointerEvents: 'auto',
            }}
          >
            {toast.type === 'success' ? (
              <CheckCircle2 size={18} style={{ color: 'var(--success)', marginTop: 1 }} />
            ) : (
              <AlertTriangle size={18} style={{ color: 'var(--danger)', marginTop: 1 }} />
            )}

            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 800, fontSize: 13, marginBottom: 2 }}>
                {toast.type === 'success' ? 'Listo' : 'Atención'}
              </div>

              <div style={{ color: 'var(--text2)', fontSize: 12, lineHeight: 1.45 }}>
                {toast.message}
              </div>
            </div>

            <button
              onClick={() => setToast(null)}
              style={{
                border: 0,
                background: 'transparent',
                color: 'var(--text3)',
                cursor: 'pointer',
                padding: 2,
              }}
            >
              <X size={15} />
            </button>
          </div>,
          document.body
        )}

      <div
        className="products-stats-grid"
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(4, 1fr)',
          gap: 12,
          marginBottom: 18,
        }}
      >
        <div className="stat-card">
          <div className="stat-value">{totalProducts}</div>
          <div className="stat-label">Productos</div>
        </div>

        <div className="stat-card">
          <div className="stat-value">
            {products.filter((p) => p.type === 'COMPUESTO').length}
          </div>
          <div className="stat-label">Promos visibles</div>
        </div>

        <div className="stat-card">
          <div className="stat-value">
            {categories.filter((c) => c.isActive).length}
          </div>
          <div className="stat-label">Categorías activas</div>
        </div>

        <div className="stat-card">
          <div className="stat-value">
            {products.filter(isProductLowStock).length}
          </div>
          <div className="stat-label">Stock bajo visible</div>
        </div>
      </div>

      <div className="products-category-action">
        <button
          className="btn btn-secondary btn-sm products-category-btn"
          onClick={() => setModal('category')}
        >
          <Tags size={14} /> Gestionar categorías
        </button>
      </div>

      <div className="products-filters" style={{ display: 'flex', gap: 10, marginBottom: 18, flexWrap: 'wrap' }}>
        <div className="products-search" style={{ position: 'relative', flex: 1, minWidth: 240 }}>
          <Search
            size={14}
            style={{
              position: 'absolute',
              left: 12,
              top: '50%',
              transform: 'translateY(-50%)',
              color: 'var(--text3)',
            }}
          />

          <div className="products-search-input-wrap">
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar por nombre, SKU o descripción..."
              style={{ paddingLeft: 34 }}
            />

            <button
              type="button"
              className="btn btn-secondary btn-sm products-search-scan-btn"
              onClick={() => openSkuScanner('search')}
              title="Escanear SKU para buscar"
              aria-label="Escanear SKU para buscar"
            >
              <ScanBarcode size={16} />
            </button>
          </div>
        </div>

        <select
          className="products-filter-select"
          value={categoryId}
          onChange={(e) => setCategoryId(e.target.value)}
          style={{ width: 220 }}
        >
          <option value="">Todas las categorías</option>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>

        <select
          className="products-sort-select"
          value={sortMode}
          onChange={(e) => setSortMode(e.target.value as ProductSortMode)}
          style={{ width: 230 }}
          title="Ordenar productos"
        >
          <option value="default">Orden original</option>
          <option value="name-asc">Nombre A-Z / alfanumérico</option>
          <option value="name-desc">Nombre Z-A / alfanumérico</option>
          <option value="category-asc">Categoría A-Z</option>
          <option value="category-desc">Categoría Z-A</option>
        </select>

        <button className="btn btn-secondary btn-sm products-refresh-btn" onClick={load}>
          <RefreshCcw size={14} /> Actualizar
        </button>
      </div>

      {showProfitCalculator && (
        <div className="card products-profit-calculator">
          <div className="products-profit-calculator-head">
            <div>
              <b>Calculadora de ganancia</b>
              <small>
                La podés usar rápido y cerrarla con la X cuando no la necesites.
              </small>
            </div>

            <div className="products-profit-calculator-actions">
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={() => setProfitCalc(EMPTY_PROFIT_CALC)}
              >
                Limpiar
              </button>

              <button
                type="button"
                className="btn btn-ghost btn-sm"
                onClick={() => setShowProfitCalculator(false)}
                title="Ocultar calculadora"
              >
                <X size={15} />
              </button>
            </div>
          </div>

          <div className="products-profit-calculator-grid">
            <div className="form-group">
              <label className="form-label">Costo bruto</label>
              <input
                type="number"
                value={profitCalc.cost}
                onChange={(e) => setProfitCalc((p) => ({ ...p, cost: e.target.value }))}
                placeholder="Ej: 1000"
              />
            </div>

            <div className="form-group">
              <label className="form-label">Precio minorista</label>
              <input
                type="number"
                value={profitCalc.minoristPrice}
                onChange={(e) => setProfitCalc((p) => ({ ...p, minoristPrice: e.target.value }))}
                placeholder="Ej: 1600"
              />
            </div>

            <div className="form-group">
              <label className="form-label">Precio mayorista</label>
              <input
                type="number"
                value={profitCalc.wholesalePrice}
                onChange={(e) => setProfitCalc((p) => ({ ...p, wholesalePrice: e.target.value }))}
                placeholder="Ej: 1400"
              />
            </div>
          </div>

          <div className="products-profit-result-grid">
            <div>
              <small>Ganancia minorista</small>
              <strong style={{ color: profitColor(profitCalculatorResult.minoristProfit) }}>
                {fmtMoney(profitCalculatorResult.minoristProfit)}
              </strong>
              <span>{formatPercent(profitCalculatorResult.minoristPercent)}</span>
            </div>

            <div>
              <small>Ganancia mayorista</small>
              <strong style={{ color: profitColor(profitCalculatorResult.wholesaleProfit) }}>
                {fmtMoney(profitCalculatorResult.wholesaleProfit)}
              </strong>
              <span>{formatPercent(profitCalculatorResult.wholesalePercent)}</span>
            </div>
          </div>
        </div>
      )}

      <div className="card products-table-card">
        <div className="table-wrap products-desktop-table">
          {loading ? (
            <div style={{ padding: 20 }}>
              <div className="skeleton" style={{ height: 220 }} />
            </div>
          ) : (
            <table>
              <thead>
                <tr>
                  <th>Producto</th>
                  <th>Categoría</th>
                  <th>Precios</th>
                  <th>Costo bruto</th>
                  <th>Ganancias</th>
                  <th>Stock Mayorista</th>
                  <th>Stock Minorista</th>
                  <th>Tipo</th>
                  <th>Componentes</th>
                  <th></th>
                </tr>
              </thead>

              <tbody>
                {paginatedProducts.map((p) => (
                  <tr key={p.id}>
                    <td>
                      <div className="products-row-main" style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                        {p.imageUrl ? (
                          <img
                            src={p.imageUrl}
                            alt=""
                            style={{
                              width: 34,
                              height: 34,
                              borderRadius: 8,
                              objectFit: 'cover',
                            }}
                          />
                        ) : (
                          <span
                            style={{
                              width: 34,
                              height: 34,
                              borderRadius: 8,
                              background: 'var(--surface2)',
                              display: 'grid',
                              placeItems: 'center',
                            }}
                          >
                            <Package size={15} />
                          </span>
                        )}

                        <div>
                          <div style={{ fontWeight: 800, fontSize: 13 }}>
                            {p.name}
                          </div>

                          <div
                            style={{
                              fontFamily: 'var(--mono)',
                              color: 'var(--text3)',
                              fontSize: 11,
                            }}
                          >
                            {p.sku ?? 'SIN-SKU'}
                          </div>

                          {(p as any).description ? (
                            <div
                              style={{
                                color: 'var(--text2)',
                                fontSize: 11,
                                maxWidth: 260,
                                overflow: 'hidden',
                                whiteSpace: 'nowrap',
                                textOverflow: 'ellipsis',
                                marginTop: 2,
                              }}
                            >
                              {(p as any).description}
                            </div>
                          ) : null}
                        </div>
                      </div>
                    </td>

                    <td>
                      <span className="badge badge-gray">{categoryName(p)}</span>
                    </td>

                    <td>
                      <div style={{ display: 'grid', gap: 4, fontFamily: 'var(--mono)', fontSize: 12 }}>
                        <strong>
                          Minorista: {fmtMoney(getProductPublicPrice(p))}
                          {unitSuffix(p)}
                        </strong>
                        <span style={{ color: 'var(--text2)' }}>
                          Mayorista: {fmtMoney(getProductWholesalePrice(p))}
                          {unitSuffix(p)}
                        </span>
                      </div>
                    </td>

                    <td style={{ fontFamily: 'var(--mono)', color: 'var(--text2)', fontWeight: 800 }}>
                      {fmtMoney(getProductGrossCost(p))}
                      {unitSuffix(p)}
                    </td>

                    <td>
                      <div className="products-profit-cell">
                        <div>
                          <small>Min.</small>
                          <strong style={{ color: profitColor(getProductMinoristProfit(p)) }}>
                            {fmtMoney(getProductMinoristProfit(p))}
                          </strong>
                          <span>{formatPercent(getProductMinoristProfitPercent(p))}</span>
                        </div>

                        <div>
                          <small>May.</small>
                          <strong style={{ color: profitColor(getProductWholesaleProfit(p)) }}>
                            {fmtMoney(getProductWholesaleProfit(p))}
                          </strong>
                          <span>{formatPercent(getProductWholesaleProfitPercent(p))}</span>
                        </div>
                      </div>
                    </td>

                    <td>
                      <span
                        style={{
                          fontFamily: 'var(--mono)',
                          color: isProductLowStockMayorista(p)
                            ? 'var(--danger)'
                            : 'var(--text)',
                        }}
                      >
                        {(p as any).isService
                          ? 'No descuenta stock'
                          : stockLabel(p, getProductStockMayorista(p))}
                      </span>
                    </td>

                    <td>
                      <span
                        style={{
                          fontFamily: 'var(--mono)',
                          color: isProductLowStockMinorista(p)
                            ? 'var(--danger)'
                            : 'var(--text)',
                        }}
                      >
                        {(p as any).isService
                          ? '-'
                          : stockLabel(p, getProductStockMinorista(p))}
                      </span>
                    </td>

                    <td>
                      <span
                        className={`badge ${
                          (p as any).isService
                            ? 'badge-gray'
                            : p.type === 'COMPUESTO'
                              ? 'badge-blue'
                              : 'badge-green'
                        }`}
                      >
                        {(p as any).isService ? 'SERVICIO' : p.type === 'COMPUESTO' ? 'PROMO' : 'SIMPLE'}
                      </span>
                    </td>

                    <td style={{ fontSize: 12, color: 'var(--text2)' }}>
                      {p.components?.length
                        ? p.components
                            .map(
                              (c: ProductComponent) =>
                                `${c.component?.name ?? 'Componente'} x${
                                  c.quantity ?? c.quantityKg ?? 0
                                }${c.quantityKg ? 'kg' : ''}`
                            )
                            .join(', ')
                        : '—'}
                    </td>

                    <td>
                      <div className="products-row-actions">
                        <button
                          className="btn btn-ghost btn-sm"
                          onClick={() => openEdit(p)}
                          title="Editar producto"
                        >
                          <Edit2 size={13} />
                        </button>

                        <button
                          className="btn btn-danger btn-sm"
                          onClick={() => deleteProduct(p)}
                          title="Eliminar producto"
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          {!loading && !products.length && (
            <div className="empty-state">
              <Package size={36} />
              <p>Sin productos</p>
            </div>
          )}
        </div>

        <div className="products-mobile-list">
          {loading ? (
            <div style={{ padding: 12 }}>
              <div className="skeleton" style={{ height: 180, borderRadius: 16 }} />
            </div>
          ) : (
            paginatedProducts.map((p) => {
              const isService = Boolean((p as any).isService);
              const typeLabel = isService ? 'SERVICIO' : p.type === 'COMPUESTO' ? 'PROMO' : 'SIMPLE';
              const mayoristaStockLabel = isService
                ? 'Servicio'
                : stockLabel(p, getProductStockMayorista(p));
              const minoristaStockLabel = isService
                ? '—'
                : stockLabel(p, getProductStockMinorista(p));

              return (
                <article className="products-mobile-item" key={p.id}>
                  <div className="products-mobile-head">
                    {p.imageUrl ? (
                      <img src={p.imageUrl} alt="" className="products-mobile-img" />
                    ) : (
                      <span className="products-mobile-img products-mobile-placeholder">
                        <Package size={15} />
                      </span>
                    )}

                    <div className="products-mobile-title">
                      <div className="products-mobile-title-line">
                        <b>{p.name}</b>
                        <span
                          className={`badge ${
                            isService ? 'badge-gray' : p.type === 'COMPUESTO' ? 'badge-blue' : 'badge-green'
                          }`}
                        >
                          {typeLabel}
                        </span>
                      </div>

                      <span>{p.sku ?? 'SIN-SKU'} · {categoryName(p)}</span>
                    </div>
                  </div>

                  <div className="products-mobile-quick">
                    <div>
                      <small>Precio min.</small>
                      <strong>
                        {fmtMoney(getProductPublicPrice(p))}
                        {unitSuffix(p)}
                      </strong>
                    </div>

                    <div>
                      <small>Gcia. min.</small>
                      <strong style={{ color: profitColor(getProductMinoristProfit(p)) }}>
                        {fmtMoney(getProductMinoristProfit(p))}
                      </strong>
                    </div>

                    <div>
                      <small>Gcia. may.</small>
                      <strong style={{ color: profitColor(getProductWholesaleProfit(p)) }}>
                        {fmtMoney(getProductWholesaleProfit(p))}
                      </strong>
                    </div>
                  </div>

                  <div className="products-mobile-quick products-mobile-quick-stock">
                    <div>
                      <small>Stock mayorista</small>
                      <strong className={isProductLowStockMayorista(p) ? 'products-danger-text' : ''}>
                        {mayoristaStockLabel}
                      </strong>
                    </div>

                    <div>
                      <small>Stock minorista</small>
                      <strong className={isProductLowStockMinorista(p) ? 'products-danger-text' : ''}>
                        {minoristaStockLabel}
                      </strong>
                    </div>

                    <div>
                      <small>Precio may.</small>
                      <strong>
                        {fmtMoney(getProductWholesalePrice(p))}
                        {unitSuffix(p)}
                      </strong>
                    </div>
                  </div>

                  <div className="products-mobile-actions">
                    <button className="btn btn-secondary btn-sm" onClick={() => setMobileProductSheet(p)}>
                      Ver más
                    </button>

                    <button className="btn btn-primary btn-sm" onClick={() => openEdit(p)}>
                      <Edit2 size={13} /> Editar
                    </button>
                  </div>
                </article>
              );
            })
          )}

          {!loading && !products.length && (
            <div className="empty-state">
              <Package size={36} />
              <p>Sin productos</p>
            </div>
          )}
        </div>

        {!loading && totalProducts > 0 && (
          <div className="products-pagination">
            <div className="products-pagination-info">
              Mostrando {pageStart} - {pageEnd} de {totalProducts} productos
            </div>

            <div className="products-pagination-actions">
              <button
                className="btn btn-secondary btn-sm"
                disabled={currentPage === 1}
                onClick={() => setCurrentPage((prev) => Math.max(1, prev - 1))}
              >
                Anterior
              </button>

              <span className="products-pagination-page">
                Página {currentPage} de {totalPages}
              </span>

              <button
                className="btn btn-secondary btn-sm"
                disabled={currentPage === totalPages}
                onClick={() => setCurrentPage((prev) => Math.min(totalPages, prev + 1))}
              >
                Siguiente
              </button>
            </div>
          </div>
        )}
      </div>

      {mobileProductSheet && typeof document !== 'undefined' &&
        createPortal(
          <div className="products-mobile-sheet-backdrop" onClick={() => setMobileProductSheet(null)}>
            <div className="products-mobile-sheet" onClick={(e) => e.stopPropagation()}>
              <div className="products-mobile-sheet-handle" />

              <div className="products-mobile-sheet-header">
                <div className="products-mobile-sheet-product">
                  {mobileProductSheet.imageUrl ? (
                    <img src={mobileProductSheet.imageUrl} alt="" />
                  ) : (
                    <span>
                      <Package size={17} />
                    </span>
                  )}

                  <div>
                    <b>{mobileProductSheet.name}</b>
                    <small>
                      {mobileProductSheet.sku ?? 'SIN-SKU'} · {categoryName(mobileProductSheet)}
                    </small>
                  </div>
                </div>

                <button className="btn btn-ghost btn-sm" onClick={() => setMobileProductSheet(null)}>
                  <X size={16} />
                </button>
              </div>

              <div className="products-mobile-sheet-body">
                <div className="products-mobile-sheet-grid">
                  <div>
                    <small>Precio minorista</small>
                    <strong>
                      {fmtMoney(getProductPublicPrice(mobileProductSheet))}
                      {unitSuffix(mobileProductSheet)}
                    </strong>
                  </div>

                  <div>
                    <small>Precio mayorista</small>
                    <strong>
                      {fmtMoney(getProductWholesalePrice(mobileProductSheet))}
                      {unitSuffix(mobileProductSheet)}
                    </strong>
                  </div>

                  <div>
                    <small>Costo bruto</small>
                    <strong>
                      {fmtMoney(getProductGrossCost(mobileProductSheet))}
                      {unitSuffix(mobileProductSheet)}
                    </strong>
                  </div>

                  <div>
                    <small>Ganancia minorista</small>
                    <strong className={getProductMinoristProfit(mobileProductSheet) < 0 ? 'products-danger-text' : ''}>
                      {fmtMoney(getProductMinoristProfit(mobileProductSheet))}
                      {getProductMinoristProfitPercent(mobileProductSheet) === null
                        ? ''
                        : ` (${getProductMinoristProfitPercent(mobileProductSheet)!.toFixed(1)}%)`}
                    </strong>
                  </div>

                  <div>
                    <small>Ganancia mayorista</small>
                    <strong className={getProductWholesaleProfit(mobileProductSheet) < 0 ? 'products-danger-text' : ''}>
                      {fmtMoney(getProductWholesaleProfit(mobileProductSheet))}
                      {getProductWholesaleProfitPercent(mobileProductSheet) === null
                        ? ''
                        : ` (${getProductWholesaleProfitPercent(mobileProductSheet)!.toFixed(1)}%)`}
                    </strong>
                  </div>

                  <div>
                    <small>Stock mayorista</small>
                    <strong
                      className={
                        isProductLowStockMayorista(mobileProductSheet)
                          ? 'products-danger-text'
                          : ''
                      }
                    >
                      {(mobileProductSheet as any).isService
                        ? 'No descuenta'
                        : stockLabel(mobileProductSheet, getProductStockMayorista(mobileProductSheet))}
                    </strong>
                  </div>

                  <div>
                    <small>Stock minorista</small>
                    <strong
                      className={
                        isProductLowStockMinorista(mobileProductSheet)
                          ? 'products-danger-text'
                          : ''
                      }
                    >
                      {(mobileProductSheet as any).isService
                        ? '—'
                        : stockLabel(mobileProductSheet, getProductStockMinorista(mobileProductSheet))}
                    </strong>
                  </div>

                  <div>
                    <small>Tipo</small>
                    <strong>
                      {(mobileProductSheet as any).isService
                        ? 'Servicio'
                        : mobileProductSheet.type === 'COMPUESTO'
                          ? 'Promo / compuesto'
                          : 'Simple'}
                    </strong>
                  </div>
                </div>

                {(mobileProductSheet as any).description ? (
                  <div className="products-mobile-sheet-box">
                    <small>Descripción</small>
                    <p>{(mobileProductSheet as any).description}</p>
                  </div>
                ) : null}

                {mobileProductSheet.components?.length ? (
                  <div className="products-mobile-sheet-box">
                    <small>Componentes</small>
                    <p>
                      {mobileProductSheet.components
                        .map(
                          (c: ProductComponent) =>
                            `${c.component?.name ?? 'Componente'} x${
                              c.quantity ?? c.quantityKg ?? 0
                            }${c.quantityKg ? 'kg' : ''}`
                        )
                        .join(', ')}
                    </p>
                  </div>
                ) : null}
              </div>

              <div className="products-mobile-sheet-actions">
                <button
                  className="btn btn-primary"
                  onClick={() => {
                    const product = mobileProductSheet;
                    setMobileProductSheet(null);
                    openEdit(product);
                  }}
                >
                  <Edit2 size={15} /> Editar producto
                </button>

                <button
                  className="btn btn-danger"
                  onClick={() => {
                    const product = mobileProductSheet;
                    setMobileProductSheet(null);
                    deleteProduct(product);
                  }}
                >
                  <Trash2 size={15} /> Eliminar
                </button>
              </div>
            </div>
          </div>,
          document.body
        )}

      {modal === 'stock-notice' && typeof document !== 'undefined' &&
        createPortal(
        <div className="modal-overlay">
          <div className="modal products-small-modal" style={{ maxWidth: 460 }}>
            <div className="modal-header">
              <b>Antes de continuar</b>

              <button
                className="btn btn-ghost btn-sm"
                onClick={() => {
                  setPendingProductAction(null);
                  setModal(null);
                }}
              >
                <X size={16} />
              </button>
            </div>

            <div className="modal-body">
              <p style={{ margin: 0, lineHeight: 1.5 }}>
                {pendingProductAction?.type === 'create'
                  ? 'Crear un producto desde aquí no genera ningún ingreso o egreso de stock.'
                  : 'Editar un producto desde aquí no genera ningún ingreso o egreso de stock.'}{' '}
                Lo recomendable es cargar y ajustar las cantidades desde la
                sección <b>Stock</b>, para que quede registrado el movimiento
                correspondiente.
              </p>
            </div>

            <div className="modal-footer">
              <button
                className="btn btn-ghost"
                onClick={() => {
                  setPendingProductAction(null);
                  setModal(null);
                }}
              >
                Cancelar
              </button>

              <button className="btn btn-primary" onClick={confirmStockNotice}>
                Entendido, continuar
              </button>
            </div>
          </div>
        </div>,
        document.body
        )}

      {(modal === 'product-create' || modal === 'product-edit') && typeof document !== 'undefined' &&
        createPortal(
        <div className="modal-overlay">
          <div className="modal products-product-modal" style={{ maxWidth: 1080 }}>
            <div className="modal-header">
              <b>{modal === 'product-create' ? 'Nuevo producto' : 'Editar producto'}</b>

              <button className="btn btn-ghost btn-sm" onClick={() => setModal(null)}>
                <X size={16} />
              </button>
            </div>

            <div className="modal-body products-product-modal-body">
              <div className="products-mobile-form-tabs">
                <button
                  type="button"
                  className={productFormStep === 'basico' ? 'is-active' : ''}
                  onClick={() => setProductFormStep('basico')}
                >
                  1. Básico
                </button>

                <button
                  type="button"
                  className={productFormStep === 'precios' ? 'is-active' : ''}
                  onClick={() => setProductFormStep('precios')}
                >
                  2. Precios / stock
                </button>

                {form.isService !== 'true' && form.type === 'COMPUESTO' && (
                  <button
                    type="button"
                    className={productFormStep === 'componentes' ? 'is-active' : ''}
                    onClick={() => setProductFormStep('componentes')}
                  >
                    3. Componentes
                  </button>
                )}
              </div>

              <section className={`products-form-section ${productFormStep === 'basico' ? 'products-form-section-active' : ''}`}>
                <div className="products-mobile-section-title">
                  <b>Datos principales</b>
                  <small>Nombre, SKU, foto y tipo de producto.</small>
                </div>

              <div className="form-row products-form-row">
                <div className="form-group">
                  <label className="form-label">Nombre *</label>
                  <input
                    value={form.name}
                    onChange={(e) =>
                      setForm((p) => ({ ...p, name: e.target.value }))
                    }
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">SKU *</label>

                  <div className="products-sku-input-wrap">
                    <input
                      value={form.sku}
                      onChange={(e) =>
                        setForm((p) => ({ ...p, sku: e.target.value }))
                      }
                      placeholder="Código / SKU"
                    />

                    <button
                      type="button"
                      className="btn btn-secondary btn-sm products-sku-scan-btn"
                      onClick={() => openSkuScanner('form')}
                      title="Escanear SKU con cámara"
                      aria-label="Escanear SKU con cámara"
                    >
                      <ScanBarcode size={16} />
                    </button>
                  </div>

                  <small className="products-sku-helper">
                    Podés escribirlo manualmente o escanear el código con la cámara.
                  </small>
                </div>
              </div>

              <div className="form-group">
                <label className="form-label">Descripción</label>
                <textarea
                  value={form.description}
                  onChange={(e) =>
                    setForm((p) => ({ ...p, description: e.target.value }))
                  }
                  placeholder="Descripción del producto para el sistema y la futura web..."
                  rows={3}
                  style={{
                    width: '100%',
                    resize: 'vertical',
                    minHeight: 90,
                  }}
                />
              </div>

              <div className="form-group">
                <label className="form-label">Imagen del producto</label>

                <div className="products-image-uploader">
                  <div className="products-image-actions">
                    <label className="btn btn-secondary btn-sm products-image-btn">
                      <ImagePlus size={14} />
                      Subir desde galería

                      <input
                        ref={galleryImageInputRef}
                        type="file"
                        accept={PRODUCT_IMAGE_ACCEPT}
                        hidden
                        onChange={(e) => {
                          handleImageChange(e.currentTarget.files?.[0]);
                          e.currentTarget.value = '';
                        }}
                      />
                    </label>

                    <label className="btn btn-secondary btn-sm products-image-btn">
                      <ImagePlus size={14} />
                      Sacar foto

                      <input
                        ref={cameraImageInputRef}
                        type="file"
                        accept="image/*"
                        capture="environment"
                        hidden
                        onChange={(e) => {
                          handleImageChange(e.currentTarget.files?.[0]);
                          e.currentTarget.value = '';
                        }}
                      />
                    </label>

                    {(imageFile || imagePreview) && (
                      <button
                        type="button"
                        className="btn btn-ghost btn-sm products-image-clear"
                        onClick={resetImage}
                      >
                        <X size={14} />
                        Quitar
                      </button>
                    )}
                  </div>

                  {imageFile ? (
                    <span className="products-image-helper products-image-filename">
                      {imageFile.name}
                    </span>
                  ) : (
                    <span className="products-image-helper">
                      JPG, PNG, WEBP, HEIC o HEIF. Máximo {MAX_PRODUCT_IMAGE_SIZE_MB}MB.
                      Si usás Google Fotos, abrí la imagen primero para que se descargue.
                    </span>
                  )}
                </div>

                {imagePreview ? (
                  <div
                    style={{
                      marginTop: 10,
                      width: 110,
                      height: 110,
                      borderRadius: 14,
                      overflow: 'hidden',
                      border: '1px solid var(--border)',
                      background: 'var(--surface2)',
                    }}
                  >
                    <img
                      src={imagePreview}
                      alt="Vista previa"
                      style={{
                        width: '100%',
                        height: '100%',
                        objectFit: 'cover',
                      }}
                    />
                  </div>
                ) : null}
              </div>

              <div className="form-row products-form-row">
                <div className="form-group">
                  <label className="form-label">Tipo</label>
                  <select
                    value={form.type}
                    disabled={form.isService === 'true'}
                    onChange={(e) =>
                      setForm((p) => ({
                        ...p,
                        type: e.target.value,
                        saleUnit: e.target.value === 'COMPUESTO' ? 'UNIT' : p.saleUnit,
                      }))
                    }
                  >
                    <option value="SIMPLE">Simple</option>
                    <option value="COMPUESTO">Promo / compuesto</option>
                  </select>
                </div>

                <div className="form-group">
                  <label className="form-label">Categoría</label>
                  <select
                    value={form.categoryId}
                    onChange={(e) =>
                      setForm((p) => ({ ...p, categoryId: e.target.value }))
                    }
                  >
                    <option value="">Sin categoría</option>
                    {categories
                      .filter((c) => c.isActive)
                      .map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name}
                        </option>
                      ))}
                  </select>
                </div>
              </div>

              <div className="form-row products-form-row">
                <div className="form-group">
                  <label className="form-label">Producto / servicio</label>
                  <select
                    value={form.isService}
                    onChange={(e) => {
                      const nextIsService = e.target.value === 'true';

                      setForm((p) => ({
                        ...p,
                        isService: String(nextIsService),
                        type: nextIsService ? 'SIMPLE' : p.type,
                        saleUnit: nextIsService ? 'UNIT' : p.saleUnit,
                        stockLocal: nextIsService ? '0' : p.stockLocal,
                        stockDeposito: nextIsService ? '0' : p.stockDeposito,
                        stockLocalKg: nextIsService ? '0' : p.stockLocalKg,
                        stockDepositoKg: nextIsService ? '0' : p.stockDepositoKg,
                        minStock: nextIsService ? '0' : p.minStock,
                        minStockDeposito: nextIsService ? '0' : p.minStockDeposito,
                        minStockKg: nextIsService ? '0' : p.minStockKg,
                        minStockDepositoKg: nextIsService ? '0' : p.minStockDepositoKg,
                      }));

                      if (nextIsService) setComponents([]);
                    }}
                  >
                    <option value="false">Producto físico</option>
                    <option value="true">Servicio</option>
                  </select>
                </div>

                <div className="form-group">
                  <label className="form-label">Unidad de venta</label>
                  <select
                    value={form.saleUnit}
                    disabled={form.type === 'COMPUESTO' || form.isService === 'true'}
                    onChange={(e) =>
                      setForm((p) => ({ ...p, saleUnit: e.target.value }))
                    }
                  >
                    <option value="UNIT">Unidad</option>
                    <option value="KG">Kilogramo</option>
                  </select>
                </div>

              </div>

              </section>

              <section className={`products-form-section ${productFormStep === 'precios' ? 'products-form-section-active' : ''}`}>
                <div className="products-mobile-section-title">
                  <b>Precios y stock</b>
                  <small>Minorista a la izquierda y mayorista a la derecha, cada uno con su precio, stock y mínimo.</small>
                </div>

              <div className="products-pricing-desktop-layout">
                <div className="products-pricing-shared-card">
                  <div className="products-pricing-card-title">
                    <b>Costo del producto</b>
                    <small>
                      Este valor se usa para calcular la ganancia minorista y mayorista.
                    </small>
                  </div>

                  <div className="form-group">
                    <label className="form-label">
                      {form.type === 'COMPUESTO' ? 'Costo manual' : form.saleUnit === 'KG' ? 'Costo de compra/kg' : 'Costo de compra'}
                    </label>
                    <input
                      type="number"
                      value={form.purchasePrice}
                      onChange={(e) =>
                        setForm((p) => ({
                          ...p,
                          purchasePrice: e.target.value,
                        }))
                      }
                      placeholder={form.saleUnit === 'KG' ? 'Costo por kg' : 'Costo por unidad'}
                    />
                  </div>

                  <div className="form-group">
                    <label className="form-label">IVA</label>
                    <select
                      value={form.ivaPorcentaje}
                      onChange={(e) =>
                        setForm((p) => ({
                          ...p,
                          ivaPorcentaje: e.target.value,
                        }))
                      }
                    >
                      <option value="0">0%</option>
                      <option value="10.5">10,5%</option>
                      <option value="21">21%</option>
                      <option value="27">27%</option>
                    </select>
                  </div>
                </div>

                <div className="products-pricing-channel-grid">
                  <div className="products-pricing-channel-card products-pricing-minorist-card">
                    <div className="products-pricing-channel-head">
                      <b>Minorista</b>
                      <small>Precio, stock y mínimo para venta minorista.</small>
                    </div>

                    <div className="products-pricing-fields">
                      <div className="form-group">
                        <label className="form-label">
                          {form.saleUnit === 'KG' ? 'Precio minorista/kg' : 'Precio minorista'}
                        </label>
                        <input
                          type="number"
                          value={form.saleUnit === 'KG' ? form.pricePerKg : form.price}
                          onChange={(e) =>
                            setForm((p) => ({
                              ...p,
                              [form.saleUnit === 'KG' ? 'pricePerKg' : 'price']: e.target.value,
                            }))
                          }
                        />
                      </div>

                      {form.type !== 'COMPUESTO' && form.isService !== 'true' && (
                        <>
                          <div className="form-group">
                            <label className="form-label">
                              {form.saleUnit === 'KG' ? 'Stock Minorista kg' : 'Stock Minorista'}
                            </label>
                            <input
                              type="number"
                              value={form.saleUnit === 'KG' ? form.stockDepositoKg : form.stockDeposito}
                              onChange={(e) =>
                                setForm((p) => ({
                                  ...p,
                                  [form.saleUnit === 'KG' ? 'stockDepositoKg' : 'stockDeposito']: e.target.value,
                                }))
                              }
                            />
                          </div>

                          <div className="form-group">
                            <label className="form-label">
                              {form.saleUnit === 'KG' ? 'Stock mínimo Minorista kg' : 'Stock mínimo Minorista'}
                            </label>
                            <input
                              type="number"
                              value={form.saleUnit === 'KG' ? form.minStockDepositoKg : form.minStockDeposito}
                              onChange={(e) =>
                                setForm((p) => ({
                                  ...p,
                                  [form.saleUnit === 'KG' ? 'minStockDepositoKg' : 'minStockDeposito']: e.target.value,
                                }))
                              }
                            />
                          </div>
                        </>
                      )}

                      {(form.type === 'COMPUESTO' || form.isService === 'true') && (
                        <div className="products-pricing-note">
                          {form.isService === 'true'
                            ? 'Los servicios no descuentan stock.'
                            : 'Las promos descuentan stock desde sus componentes.'}
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="products-pricing-channel-card products-pricing-wholesale-card">
                    <div className="products-pricing-channel-head">
                      <b>Mayorista</b>
                      <small>Precio, stock y mínimo para venta mayorista.</small>
                    </div>

                    <div className="products-pricing-fields">
                      <div className="form-group">
                        <label className="form-label">
                          {form.saleUnit === 'KG' ? 'Precio mayorista/kg' : 'Precio mayorista'}
                        </label>
                        <input
                          type="number"
                          value={form.saleUnit === 'KG' ? form.wholesalePricePerKg : form.wholesalePrice}
                          onChange={(e) =>
                            setForm((p) => ({
                              ...p,
                              [form.saleUnit === 'KG' ? 'wholesalePricePerKg' : 'wholesalePrice']: e.target.value,
                            }))
                          }
                        />
                      </div>

                      {form.type !== 'COMPUESTO' && form.isService !== 'true' && (
                        <>
                          <div className="form-group">
                            <label className="form-label">
                              {form.saleUnit === 'KG' ? 'Stock Mayorista kg' : 'Stock Mayorista'}
                            </label>
                            <input
                              type="number"
                              value={form.saleUnit === 'KG' ? form.stockLocalKg : form.stockLocal}
                              onChange={(e) =>
                                setForm((p) => ({
                                  ...p,
                                  [form.saleUnit === 'KG' ? 'stockLocalKg' : 'stockLocal']: e.target.value,
                                }))
                              }
                            />
                          </div>

                          <div className="form-group">
                            <label className="form-label">
                              {form.saleUnit === 'KG' ? 'Stock mínimo Mayorista kg' : 'Stock mínimo Mayorista'}
                            </label>
                            <input
                              type="number"
                              value={form.saleUnit === 'KG' ? form.minStockKg : form.minStock}
                              onChange={(e) =>
                                setForm((p) => ({
                                  ...p,
                                  [form.saleUnit === 'KG' ? 'minStockKg' : 'minStock']: e.target.value,
                                }))
                              }
                            />
                          </div>
                        </>
                      )}

                      {(form.type === 'COMPUESTO' || form.isService === 'true') && (
                        <div className="products-pricing-note">
                          {form.isService === 'true'
                            ? 'Los servicios no descuentan stock.'
                            : 'Las promos descuentan stock desde sus componentes.'}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>



              <div className="products-form-profit-preview">
                <div>
                  <small>Ganancia minorista</small>
                  <strong style={{ color: profitColor(formMinoristProfit) }}>
                    {fmtMoney(formMinoristProfit)}
                  </strong>
                  <span>{formatPercent(formMinoristPercent)}</span>
                </div>

                <div>
                  <small>Ganancia mayorista</small>
                  <strong style={{ color: profitColor(formWholesaleProfit) }}>
                    {fmtMoney(formWholesaleProfit)}
                  </strong>
                  <span>{formatPercent(formWholesalePercent)}</span>
                </div>
              </div>

              </section>

              <section className={`products-form-section ${productFormStep === 'componentes' ? 'products-form-section-active' : ''}`}>
                <div className="products-mobile-section-title">
                  <b>Componentes</b>
                  <small>Elegí qué productos descuenta esta promo o combo.</small>
                </div>

              {form.isService !== 'true' && form.type === 'COMPUESTO' && (
                <div className="card products-components-card" style={{ padding: 14, marginTop: 10 }}>
                  <div
                    className="products-components-head"
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      marginBottom: 10,
                    }}
                  >
                    <b>
                      <Layers size={14} /> Componentes de la promo
                    </b>

                    <button className="btn btn-secondary btn-sm" onClick={addComponent}>
                      <Plus size={13} /> Agregar
                    </button>
                  </div>

                  {components.map((c, idx) => (
                    <div key={idx} className="form-row products-form-row">
                      <div className="form-group">
                        <select
                          value={c.componentId}
                          onChange={(e) =>
                            setComponent(idx, 'componentId', e.target.value)
                          }
                        >
                          <option value="">
                            {loadingAllProducts
                              ? 'Cargando productos...'
                              : 'Seleccionar producto simple...'}
                          </option>
                          {simpleProducts.map((p) => (
                            <option key={p.id} value={p.id}>
                              {p.name} · stock {stockLabel(p, getProductStockMayorista(p))}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div className="form-group">
                        <input
                          placeholder="Cantidad"
                          value={c.quantity}
                          onChange={(e) =>
                            setComponent(idx, 'quantity', e.target.value)
                          }
                        />
                      </div>
                    </div>
                  ))}
                </div>
              )}
              </section>
            </div>

            <div className="modal-footer products-product-modal-footer">
              <button className="btn btn-secondary" onClick={() => setModal(null)}>
                Cancelar
              </button>

              <button
                className="btn btn-primary"
                onClick={saveProduct}
                disabled={saving || !form.name || !form.sku}
              >
                {saving ? <span className="spinner" /> : 'Guardar'}
              </button>
            </div>
          </div>
        </div>
        ,
        document.body
      )}

      {modal === 'sku-scanner' && typeof document !== 'undefined' &&
        createPortal(
        <div className="modal-overlay">
          <div className="modal products-scanner-modal">
            <div className="modal-header">
              <b>{skuScannerModeRef.current === 'search' ? 'Escanear SKU para buscar' : 'Escanear SKU'}</b>

              <button className="btn btn-ghost btn-sm" onClick={closeSkuScanner}>
                <X size={16} />
              </button>
            </div>

            <div className="modal-body products-scanner-body">
              <div className="products-scanner-info">
                <ScanBarcode size={18} />
                <div>
                  <b>
                    {skuScannerModeRef.current === 'search'
                      ? 'Apuntá al código del producto'
                      : 'Apuntá al código de barras o QR'}
                  </b>
                  <small>
                    {skuScannerModeRef.current === 'search'
                      ? 'Cuando lo detecte, se busca automáticamente por SKU.'
                      : 'Cuando lo detecte, se carga automáticamente en el campo SKU.'}
                  </small>
                </div>
              </div>

              <div className="products-scanner-frame">
                <div id={SKU_SCANNER_ELEMENT_ID} className="products-scanner-reader" />

                {scannerLoading && (
                  <div className="products-scanner-loading">
                    <span className="spinner" />
                    <p>Iniciando cámara...</p>
                  </div>
                )}
              </div>

              {scannerError ? (
                <div className="products-scanner-error">
                  <AlertTriangle size={16} />
                  <span>{scannerError}</span>
                </div>
              ) : (
                <p className="products-scanner-note">
                  Tip: acercá el código, evitá reflejos y usá buena luz.
                </p>
              )}
            </div>

            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={closeSkuScanner}>
                Cancelar
              </button>
            </div>
          </div>
        </div>
        ,
        document.body
      )}

      {modal === 'category' && typeof document !== 'undefined' &&
        createPortal(
        <div className="modal-overlay">
          <div className="modal products-small-modal">
            <div className="modal-header">
              <b>Nueva categoría</b>

              <button className="btn btn-ghost btn-sm" onClick={() => setModal(null)}>
                <X size={16} />
              </button>
            </div>

            <div className="modal-body">
              <div className="form-group">
                <label className="form-label">Nombre</label>
                <input
                  value={categoryForm.name}
                  onChange={(e) =>
                    setCategoryForm((p) => ({ ...p, name: e.target.value }))
                  }
                  placeholder="Ej: Bebidas, Agro, Repuestos"
                />
              </div>

              <div className="form-group">
                <label className="form-label">Descripción</label>
                <input
                  value={categoryForm.description}
                  onChange={(e) =>
                    setCategoryForm((p) => ({
                      ...p,
                      description: e.target.value,
                    }))
                  }
                />
              </div>
            </div>

            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setModal(null)}>
                Cancelar
              </button>

              <button
                className="btn btn-primary"
                onClick={saveCategory}
                disabled={saving || !categoryForm.name}
              >
                {saving ? <span className="spinner" /> : 'Crear'}
              </button>
            </div>
          </div>
        </div>
        ,
        document.body
      )}

      {confirmModal && typeof document !== 'undefined' &&
        createPortal(
        <div className="modal-overlay">
          <div className="modal products-small-modal" style={{ maxWidth: 440 }}>
            <div className="modal-header">
              <b>{confirmModal.title}</b>

              <button
                className="btn btn-ghost btn-sm"
                onClick={() => !confirmLoading && setConfirmModal(null)}
                disabled={confirmLoading}
              >
                <X size={16} />
              </button>
            </div>

            <div className="modal-body">
              <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
                <span
                  style={{
                    width: 38,
                    height: 38,
                    borderRadius: 10,
                    background: confirmModal.danger
                      ? 'rgba(239,68,68,0.12)'
                      : 'var(--surface2)',
                    display: 'grid',
                    placeItems: 'center',
                    flexShrink: 0,
                  }}
                >
                  <AlertTriangle
                    size={18}
                    style={{
                      color: confirmModal.danger ? 'var(--danger)' : 'var(--accent)',
                    }}
                  />
                </span>

                <p style={{ color: 'var(--text2)', fontSize: 13, lineHeight: 1.55, margin: 0 }}>
                  {confirmModal.message}
                </p>
              </div>
            </div>

            <div className="modal-footer">
              <button
                className="btn btn-secondary"
                onClick={() => setConfirmModal(null)}
                disabled={confirmLoading}
              >
                Cancelar
              </button>

              <button
                className={confirmModal.danger ? 'btn btn-danger' : 'btn btn-primary'}
                onClick={confirmAction}
                disabled={confirmLoading}
              >
                {confirmLoading ? <span className="spinner" /> : confirmModal.confirmText ?? 'Confirmar'}
              </button>
            </div>
          </div>
        </div>
        ,
        document.body
      )}

      <style jsx>{`
        .modal-overlay {
          position: fixed;
          inset: 0;
          z-index: 13000;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 18px;
          background: rgba(0, 0, 0, 0.45);
          overflow-y: auto;
        }

        .modal {
          margin: auto;
          max-height: calc(100dvh - 36px);
          overflow: hidden;
          display: flex;
          flex-direction: column;
        }

        .modal-body {
          overflow-y: auto;
        }

        .products-product-modal {
          width: min(1080px, calc(100vw - 36px));
        }

        .products-small-modal {
          width: min(520px, calc(100vw - 36px));
        }

        .products-scanner-modal {
          width: min(520px, calc(100vw - 36px));
        }

        .products-scanner-body {
          display: grid;
          gap: 12px;
          padding: 16px;
        }

        .products-scanner-info {
          display: flex;
          gap: 10px;
          align-items: flex-start;
          border: 1px solid var(--border);
          border-radius: 14px;
          background: var(--surface2);
          padding: 12px;
        }

        .products-scanner-info b {
          display: block;
          color: var(--text);
          font-size: 13px;
          line-height: 1.2;
          margin-bottom: 4px;
        }

        .products-scanner-info small {
          display: block;
          color: var(--text3);
          font-size: 12px;
          line-height: 1.35;
        }

        .products-scanner-frame {
          position: relative;
          min-height: 300px;
          overflow: hidden;
          border: 1px solid var(--border);
          border-radius: 16px;
          background: #000;
        }

        .products-scanner-reader {
          width: 100%;
          min-height: 300px;
        }

        .products-scanner-reader :global(video) {
          width: 100% !important;
          height: 300px !important;
          object-fit: cover !important;
        }

        .products-scanner-loading {
          position: absolute;
          inset: 0;
          display: grid;
          place-items: center;
          align-content: center;
          gap: 10px;
          background: rgba(0, 0, 0, 0.72);
          color: white;
          z-index: 2;
        }

        .products-scanner-loading p {
          margin: 0;
          font-size: 12px;
          font-weight: 800;
        }

        .products-scanner-error {
          display: flex;
          gap: 8px;
          align-items: flex-start;
          border: 1px solid rgba(239, 68, 68, 0.28);
          border-radius: 13px;
          background: rgba(239, 68, 68, 0.1);
          color: var(--danger);
          padding: 10px 12px;
          font-size: 12px;
          line-height: 1.35;
          font-weight: 800;
        }

        .products-scanner-note {
          margin: 0;
          color: var(--text3);
          font-size: 12px;
          line-height: 1.4;
        }

        .products-search-input-wrap {
          display: grid;
          grid-template-columns: minmax(0, 1fr) 42px;
          gap: 8px;
          align-items: center;
          width: 100%;
          min-width: 0;
        }

        .products-search-input-wrap input {
          width: 100%;
          min-width: 0;
        }

        .products-search-scan-btn {
          width: 42px;
          min-width: 42px;
          height: 38px;
          padding: 0 !important;
          justify-content: center;
        }

        .products-sku-input-wrap {
          display: grid;
          grid-template-columns: 1fr 42px;
          gap: 8px;
          align-items: center;
        }

        .products-sku-scan-btn {
          width: 42px;
          min-width: 42px;
          height: 38px;
          padding: 0 !important;
          justify-content: center;
        }

        .products-sku-helper {
          display: block;
          margin-top: 6px;
          color: var(--text3);
          font-size: 11px;
          line-height: 1.35;
        }

        .products-image-uploader {
          display: grid;
          gap: 8px;
          min-width: 0;
        }

        .products-image-actions {
          display: flex;
          gap: 8px;
          align-items: center;
          flex-wrap: wrap;
        }

        .products-image-btn,
        .products-image-clear {
          cursor: pointer;
          white-space: nowrap;
        }

        .products-image-helper {
          display: block;
          color: var(--text3);
          font-size: 12px;
          line-height: 1.4;
        }

        .products-image-filename {
          color: var(--text2);
          font-weight: 800;
          overflow-wrap: anywhere;
        }

        .products-product-modal-body {
          padding: 16px;
        }

        .products-pagination {
          border-top: 1px solid var(--border);
          padding: 14px;
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
          flex-wrap: wrap;
          background: var(--surface);
        }

        .products-pagination-info {
          color: var(--text3);
          font-size: 13px;
          font-weight: 900;
        }

        .products-pagination-actions {
          display: flex;
          align-items: center;
          gap: 8px;
          flex-wrap: wrap;
        }

        .products-pagination-page {
          color: var(--text2);
          font-size: 14px;
          font-weight: 900;
          padding: 0 6px;
        }

        .products-actions {
          align-items: center;
        }

        .products-actions .btn {
          white-space: nowrap;
          flex-shrink: 0;
        }

        .products-calculator-toggle {
          width: 34px;
          min-width: 34px;
          height: 34px;
          padding: 0 !important;
          justify-content: center;
        }

        .products-calculator-toggle.is-active {
          border-color: var(--accent);
          color: var(--accent);
          background: color-mix(in srgb, var(--accent) 12%, var(--surface));
        }

        .products-sort-select {
          min-width: 210px;
        }

        .products-row-actions {
          display: flex;
          align-items: center;
          gap: 5px;
          flex-wrap: wrap;
        }

        .products-table-card {
          min-width: 0;
          overflow: hidden;
        }

        .products-desktop-table {
          width: 100%;
          max-width: 100%;
          overflow-x: auto;
          overflow-y: hidden;
        }

        .products-desktop-table table {
          width: 100%;
          min-width: 0;
        }

        .products-desktop-table th,
        .products-desktop-table td {
          vertical-align: middle;
        }

        .products-category-action {
          display: flex;
          justify-content: flex-end;
          margin: 0 0 14px;
        }

        .products-category-btn {
          min-width: 190px;
          justify-content: center;
          white-space: nowrap;
        }

        .products-mobile-list {
          display: none;
        }

        .products-danger-text {
          color: var(--danger);
        }

        .products-profit-calculator {
          padding: 14px;
          margin-bottom: 18px;
          display: grid;
          gap: 12px;
        }

        .products-profit-calculator-head {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          gap: 12px;
        }

        .products-profit-calculator-actions {
          display: flex;
          align-items: center;
          gap: 8px;
          flex-shrink: 0;
        }

        .products-profit-calculator-head b {
          display: block;
          color: var(--text);
          font-size: 14px;
          line-height: 1.2;
          margin-bottom: 3px;
        }

        .products-profit-calculator-head small {
          display: block;
          color: var(--text3);
          font-size: 12px;
          line-height: 1.35;
        }

        .products-profit-calculator-grid {
          display: grid;
          grid-template-columns: repeat(3, minmax(0, 1fr));
          gap: 10px;
        }

        .products-profit-result-grid,
        .products-form-profit-preview {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 10px;
        }

        .products-profit-result-grid > div,
        .products-form-profit-preview > div {
          border: 1px solid var(--border);
          border-radius: 14px;
          background: var(--surface2);
          padding: 10px 12px;
          min-width: 0;
        }

        .products-profit-result-grid small,
        .products-form-profit-preview small,
        .products-profit-cell small {
          display: block;
          color: var(--text3);
          font-size: 10px;
          font-weight: 900;
          line-height: 1.15;
          margin-bottom: 3px;
        }

        .products-profit-result-grid strong,
        .products-form-profit-preview strong,
        .products-profit-cell strong {
          display: block;
          font-family: var(--mono);
          font-size: 15px;
          line-height: 1.15;
          font-weight: 900;
          overflow-wrap: anywhere;
        }

        .products-profit-result-grid span,
        .products-form-profit-preview span,
        .products-profit-cell span {
          display: block;
          margin-top: 3px;
          color: var(--text3);
          font-family: var(--mono);
          font-size: 12px;
          line-height: 1.15;
        }

        .products-profit-cell {
          display: grid;
          grid-template-columns: 1fr;
          gap: 6px;
          min-width: 0;
        }


        .products-mobile-form-tabs,
        .products-mobile-section-title {
          display: none;
        }

        .products-form-section {
          display: block;
        }


        .products-pricing-desktop-layout {
          display: grid;
          gap: 12px;
        }

        .products-pricing-shared-card,
        .products-pricing-channel-card {
          border: 1px solid var(--border);
          border-radius: 16px;
          background: var(--surface2);
          padding: 14px;
          min-width: 0;
        }

        .products-pricing-shared-card {
          display: grid;
          grid-template-columns: minmax(0, 1fr) 260px;
          gap: 14px;
          align-items: end;
        }

        .products-pricing-card-title,
        .products-pricing-channel-head {
          display: grid;
          gap: 3px;
          min-width: 0;
        }

        .products-pricing-card-title b,
        .products-pricing-channel-head b {
          color: var(--text);
          font-size: 14px;
          line-height: 1.2;
        }

        .products-pricing-card-title small,
        .products-pricing-channel-head small {
          color: var(--text3);
          font-size: 12px;
          line-height: 1.35;
        }

        .products-pricing-channel-grid {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 12px;
          align-items: stretch;
        }

        .products-pricing-channel-card {
          display: grid;
          gap: 12px;
          align-content: start;
        }

        .products-pricing-channel-head {
          padding-bottom: 10px;
          border-bottom: 1px solid var(--border);
        }

        .products-pricing-fields {
          display: grid;
          gap: 10px;
        }

        .products-pricing-fields .form-group,
        .products-pricing-shared-card .form-group {
          margin: 0;
        }

        .products-pricing-note {
          border: 1px dashed var(--border);
          border-radius: 13px;
          background: var(--surface);
          color: var(--text3);
          font-size: 12px;
          font-weight: 800;
          line-height: 1.4;
          padding: 11px 12px;
        }


        @media (min-width: 769px) {
          .products-stats-grid,
          .products-category-action,
          .products-filters,
          .products-table-card {
            width: 100%;
            max-width: 100%;
            min-width: 0;
          }

          .products-actions {
            margin-right: 0;
            max-width: 100%;
          }

          .products-desktop-table {
            overflow-x: hidden;
          }

          .products-desktop-table table {
            table-layout: fixed;
            width: 100%;
            min-width: 0;
          }

          .products-desktop-table th,
          .products-desktop-table td {
            padding-left: 10px;
            padding-right: 10px;
            font-size: 12px;
            line-height: 1.35;
            overflow: hidden;
          }

          .products-desktop-table th {
            font-size: 10px;
            letter-spacing: 0.18em;
          }

          .products-desktop-table td:nth-child(1) > div,
          .products-desktop-table td:nth-child(3) > div,
          .products-desktop-table td:nth-child(5) > div,
          .products-desktop-table td:nth-child(9) {
            min-width: 0;
          }

          .products-desktop-table td:nth-child(1) img,
          .products-desktop-table td:nth-child(1) span[style*='width: 34px'] {
            width: 30px !important;
            height: 30px !important;
            border-radius: 8px !important;
          }

          .products-desktop-table td:nth-child(1) div[style*='font-weight: 800'] {
            font-size: 12px !important;
            line-height: 1.2;
            max-width: 100%;
            overflow: hidden;
            text-overflow: ellipsis;
            white-space: nowrap;
          }

          .products-desktop-table td:nth-child(1) div[style*='maxWidth: 260'] {
            max-width: 100% !important;
          }

          .products-desktop-table td:nth-child(3) div,
          .products-desktop-table td:nth-child(4),
          .products-desktop-table td:nth-child(5) div,
          .products-desktop-table td:nth-child(6) span,
          .products-desktop-table td:nth-child(7) span {
            font-size: 13px !important;
          }

          .products-desktop-table td:nth-child(9) {
            color: var(--text2);
            font-size: 11px !important;
            line-height: 1.35;
            overflow: hidden;
            text-overflow: ellipsis;
          }

          .products-desktop-table td:nth-child(10) .btn {
            width: 28px;
            height: 28px;
            min-height: 28px;
            padding: 0;
          }

          .products-desktop-table th:nth-child(1),
          .products-desktop-table td:nth-child(1) {
            width: 15%;
          }

          .products-desktop-table th:nth-child(2),
          .products-desktop-table td:nth-child(2) {
            width: 10%;
          }

          .products-desktop-table th:nth-child(3),
          .products-desktop-table td:nth-child(3) {
            width: 11%;
          }

          .products-desktop-table th:nth-child(4),
          .products-desktop-table td:nth-child(4) {
            width: 8%;
          }

          .products-desktop-table th:nth-child(5),
          .products-desktop-table td:nth-child(5) {
            width: 11%;
          }

          .products-desktop-table th:nth-child(6),
          .products-desktop-table td:nth-child(6),
          .products-desktop-table th:nth-child(7),
          .products-desktop-table td:nth-child(7) {
            width: 10%;
          }

          .products-desktop-table th:nth-child(8),
          .products-desktop-table td:nth-child(8) {
            width: 8%;
          }

          .products-desktop-table th:nth-child(9),
          .products-desktop-table td:nth-child(9) {
            width: 8%;
          }

          .products-desktop-table th:nth-child(10),
          .products-desktop-table td:nth-child(10) {
            width: 9%;
          }
        }

        @media (max-width: 980px) {
          .products-stats-grid {
            grid-template-columns: repeat(2, minmax(0, 1fr)) !important;
          }
        }

        @media (max-width: 768px) {
          .products-actions {
            margin-right: 0;
          }

          .modal-overlay {
            align-items: flex-end;
            justify-content: center;
            padding: 0;
            overflow: hidden;
          }

          .modal {
            margin: 0;
            max-height: calc(100dvh - 8px);
          }

          .products-pagination {
            display: grid;
            grid-template-columns: 1fr;
            justify-items: stretch;
            padding: 10px;
            gap: 8px;
          }

          .products-pagination-info {
            text-align: center;
            font-size: 11px;
          }

          .products-pagination-actions {
            display: grid;
            grid-template-columns: 1fr;
            gap: 8px;
          }

          .products-pagination-actions button {
            width: 100%;
            justify-content: center;
          }

          .products-pagination-page {
            text-align: center;
          }

          .products-actions {
            width: 100%;
            display: grid !important;
            grid-template-columns: 44px 1fr;
            gap: 8px !important;
          }

          .products-actions button {
            width: 100%;
            justify-content: center;
          }

          .products-calculator-toggle {
            width: 44px;
            min-width: 44px;
            height: 36px;
          }

          .products-toast {
            top: 12px !important;
            right: 12px !important;
            left: 12px !important;
            min-width: 0 !important;
            max-width: none !important;
            z-index: 2147483647 !important;
          }

          .products-stats-grid {
            grid-template-columns: repeat(2, minmax(0, 1fr)) !important;
            gap: 8px !important;
            margin-bottom: 10px !important;
          }

          .products-stats-grid .stat-card {
            min-height: 66px;
            padding: 10px !important;
          }

          .products-stats-grid .stat-value {
            font-size: 18px !important;
            line-height: 1.1;
          }

          .products-stats-grid .stat-label {
            font-size: 10px !important;
            line-height: 1.2;
          }

          .products-category-action {
            justify-content: stretch;
            margin: 0 0 10px;
          }

          .products-category-btn {
            width: 100%;
            min-width: 0;
            height: 36px;
          }

          .products-filters {
            display: grid !important;
            grid-template-columns: 1fr !important;
            gap: 8px !important;
            margin-bottom: 10px !important;
          }

          .products-profit-calculator {
            padding: 10px;
            margin-bottom: 10px;
            border-radius: 18px;
          }

          .products-profit-calculator-head {
            display: grid;
            grid-template-columns: 1fr;
          }

          .products-profit-calculator-actions {
            width: 100%;
            display: grid;
            grid-template-columns: 1fr auto;
          }

          .products-profit-calculator-actions .btn:first-child {
            justify-content: center;
          }

          .products-profit-calculator-grid,
          .products-profit-result-grid,
          .products-form-profit-preview {
            grid-template-columns: 1fr !important;
            gap: 8px;
          }

          .products-search {
            min-width: 0 !important;
            width: 100%;
          }

          .products-search-input-wrap {
            grid-template-columns: minmax(0, 1fr) 42px;
          }

          .products-search input,
          .products-filter-select,
          .products-sort-select,
          .products-refresh-btn {
            width: 100% !important;
          }

          .products-refresh-btn {
            justify-content: center;
            height: 36px;
          }

          .products-search input,
          .products-filter-select,
          .products-sort-select {
            min-height: 36px;
            height: 36px;
            font-size: 13px;
          }

          .products-table-card {
            overflow: hidden;
            border-radius: 18px;
          }

          .products-desktop-table {
            display: none;
          }

          .products-mobile-list {
            display: grid;
            gap: 8px;
            padding: 10px;
          }

          .products-mobile-item {
            display: grid;
            gap: 8px;
            border: 1px solid var(--border);
            border-radius: 15px;
            background: var(--surface2);
            padding: 10px;
            min-width: 0;
          }

          .products-mobile-head {
            display: flex;
            align-items: flex-start;
            justify-content: space-between;
            gap: 10px;
            min-width: 0;
          }

          .products-mobile-img {
            width: 38px;
            height: 38px;
            border-radius: 10px;
            object-fit: cover;
            flex-shrink: 0;
            border: 1px solid var(--border);
          }

          .products-mobile-placeholder {
            background: var(--surface);
            display: grid;
            place-items: center;
            color: var(--text3);
          }

          .products-mobile-title {
            display: grid;
            gap: 3px;
            min-width: 0;
            flex: 1;
          }

          .products-mobile-title-line {
            display: flex;
            align-items: center;
            gap: 7px;
            min-width: 0;
          }

          .products-mobile-title-line b {
            flex: 1;
            min-width: 0;
          }

          .products-mobile-title-line .badge {
            flex-shrink: 0;
            font-size: 9px;
            padding: 3px 6px;
          }

          .products-mobile-title b {
            color: var(--text);
            font-size: 14px;
            line-height: 1.2;
            overflow: hidden;
            text-overflow: ellipsis;
            white-space: nowrap;
          }

          .products-mobile-title span {
            font-family: var(--mono);
            color: var(--text3);
            font-size: 11px;
            overflow: hidden;
            text-overflow: ellipsis;
            white-space: nowrap;
          }

          .products-mobile-title p {
            margin: 0;
            color: var(--text2);
            font-size: 11px;
            line-height: 1.35;
            overflow: hidden;
            display: -webkit-box;
            -webkit-line-clamp: 2;
            -webkit-box-orient: vertical;
          }

          .products-mobile-head > .badge {
            flex-shrink: 0;
          }

          .products-mobile-quick {
            display: grid;
            grid-template-columns: 1.2fr 1fr 1fr;
            gap: 6px;
          }

          .products-mobile-quick > div {
            min-width: 0;
            border-radius: 11px;
            background: var(--surface);
            padding: 7px 8px;
          }

          .products-mobile-quick small {
            display: block;
            color: var(--text3);
            font-size: 9.5px;
            font-weight: 800;
            line-height: 1.15;
            margin-bottom: 3px;
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
          }

          .products-mobile-quick strong {
            display: block;
            font-family: var(--mono);
            font-size: 13px;
            line-height: 1.15;
            color: var(--text);
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
          }

          .products-mobile-data {
            display: grid;
            grid-template-columns: 1fr;
            gap: 8px;
          }

          .products-mobile-data > div {
            display: flex;
            align-items: center;
            justify-content: space-between;
            gap: 12px;
            border-radius: 13px;
            background: var(--surface);
            padding: 9px 10px;
            min-width: 0;
          }

          .products-mobile-data small,
          .products-mobile-components small {
            color: var(--text3);
            font-size: 11px;
            font-weight: 800;
          }

          .products-mobile-data strong {
            font-family: var(--mono);
            font-size: 12px;
            text-align: right;
            overflow-wrap: anywhere;
          }

          .products-mobile-components {
            display: grid;
            gap: 5px;
            border-radius: 13px;
            background: var(--surface);
            padding: 10px;
          }

          .products-mobile-components p {
            margin: 0;
            color: var(--text2);
            font-size: 12px;
            line-height: 1.45;
            overflow-wrap: anywhere;
          }

          .products-mobile-actions {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 7px;
          }

          .products-mobile-actions button {
            width: 100%;
            justify-content: center;
            min-height: 32px;
          }

          .products-mobile-sheet-backdrop {
            position: fixed;
            inset: 0;
            z-index: 12000;
            display: flex;
            align-items: flex-end;
            justify-content: center;
            background: rgba(0, 0, 0, 0.48);
            padding: 0;
          }

          .products-mobile-sheet {
            width: 100%;
            max-height: min(82dvh, 620px);
            overflow: hidden;
            display: flex;
            flex-direction: column;
            border-radius: 22px 22px 0 0;
            border: 1px solid var(--border);
            background: var(--surface);
            box-shadow: 0 -18px 60px rgba(0, 0, 0, 0.35);
          }

          .products-mobile-sheet-handle {
            width: 44px;
            height: 4px;
            border-radius: 999px;
            background: var(--border);
            margin: 10px auto 8px;
            flex-shrink: 0;
          }

          .products-mobile-sheet-header {
            display: flex;
            align-items: center;
            justify-content: space-between;
            gap: 12px;
            padding: 0 14px 12px;
            border-bottom: 1px solid var(--border);
          }

          .products-mobile-sheet-product {
            display: flex;
            align-items: center;
            gap: 10px;
            min-width: 0;
            flex: 1;
          }

          .products-mobile-sheet-product img,
          .products-mobile-sheet-product span {
            width: 42px;
            height: 42px;
            border-radius: 12px;
            border: 1px solid var(--border);
            flex-shrink: 0;
            object-fit: cover;
          }

          .products-mobile-sheet-product span {
            display: grid;
            place-items: center;
            background: var(--surface2);
            color: var(--text3);
          }

          .products-mobile-sheet-product b {
            display: block;
            font-size: 14px;
            line-height: 1.2;
            color: var(--text);
            overflow: hidden;
            text-overflow: ellipsis;
            white-space: nowrap;
          }

          .products-mobile-sheet-product small {
            display: block;
            margin-top: 3px;
            color: var(--text3);
            font-size: 11px;
            line-height: 1.2;
            overflow: hidden;
            text-overflow: ellipsis;
            white-space: nowrap;
          }

          .products-mobile-sheet-body {
            overflow-y: auto;
            padding: 12px 14px;
            display: grid;
            gap: 10px;
          }

          .products-mobile-sheet-grid {
            display: grid;
            grid-template-columns: repeat(2, minmax(0, 1fr));
            gap: 8px;
          }

          .products-mobile-sheet-grid > div,
          .products-mobile-sheet-box {
            border: 1px solid var(--border);
            border-radius: 14px;
            background: var(--surface2);
            padding: 10px;
            min-width: 0;
          }

          .products-mobile-sheet-grid small,
          .products-mobile-sheet-box small {
            display: block;
            color: var(--text3);
            font-size: 10px;
            font-weight: 800;
            margin-bottom: 5px;
          }

          .products-mobile-sheet-grid strong {
            display: block;
            font-family: var(--mono);
            font-size: 14px;
            color: var(--text);
            overflow-wrap: anywhere;
          }

          .products-mobile-sheet-box p {
            margin: 0;
            color: var(--text2);
            font-size: 12px;
            line-height: 1.45;
            overflow-wrap: anywhere;
          }

          .products-mobile-sheet-actions {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 10px;
            padding: 12px 14px calc(12px + env(safe-area-inset-bottom));
            border-top: 1px solid var(--border);
            background: var(--surface);
          }

          .products-mobile-sheet-actions button {
            width: 100%;
            justify-content: center;
          }

          .products-product-modal,
          .products-small-modal {
            width: calc(100vw - 24px) !important;
            max-width: calc(100vw - 24px) !important;
            max-height: calc(100dvh - 24px);
            overflow: auto;
            border-radius: 18px;
          }

          .products-product-modal {
            align-self: flex-end;
            width: 100vw !important;
            max-width: 100vw !important;
            height: min(96dvh, calc(100dvh - 6px));
            max-height: min(96dvh, calc(100dvh - 6px));
            border-radius: 22px 22px 0 0;
            overflow: hidden;
            display: flex;
            flex-direction: column;
          }

          .products-product-modal .modal-header {
            position: relative;
            top: auto;
            z-index: 5;
            flex-shrink: 0;
            background: var(--surface);
            border-bottom: 1px solid var(--border);
            min-height: 52px;
          }

          .products-product-modal-body {
            flex: 1 1 auto;
            min-height: 0;
            padding: 0 !important;
            overflow-y: auto !important;
            overflow-x: hidden;
            background: var(--bg);
            -webkit-overflow-scrolling: touch;
            overscroll-behavior: contain;
            padding-bottom: 92px !important;
          }

          .products-mobile-form-tabs {
            position: sticky;
            top: 0;
            z-index: 4;
            display: grid;
            grid-template-columns: repeat(2, minmax(0, 1fr));
            gap: 7px;
            padding: 10px 12px;
            border-bottom: 1px solid var(--border);
            background: var(--surface);
          }

          .products-mobile-form-tabs button {
            border: 1px solid var(--border);
            background: var(--surface2);
            color: var(--text2);
            border-radius: 999px;
            min-height: 34px;
            padding: 0 10px;
            font-size: 11px;
            font-weight: 900;
            white-space: nowrap;
          }

          .products-mobile-form-tabs button.is-active {
            border-color: var(--accent);
            color: var(--accent);
            background: color-mix(in srgb, var(--accent) 12%, var(--surface));
          }

          .products-form-section {
            display: none;
            padding: 12px;
          }

          .products-form-section-active {
            display: grid;
            gap: 10px;
          }

          .products-mobile-section-title {
            display: grid;
            gap: 3px;
            border: 1px solid var(--border);
            border-radius: 16px;
            background: var(--surface);
            padding: 11px 12px;
          }

          .products-mobile-section-title b {
            font-size: 14px;
            line-height: 1.2;
            color: var(--text);
          }

          .products-mobile-section-title small {
            color: var(--text3);
            font-size: 11px;
            line-height: 1.35;
          }

          .products-form-section .form-group,
          .products-form-section .form-row,
          .products-form-section .products-price-grid,
          .products-form-section .products-components-card {
            border: 1px solid var(--border);
            border-radius: 15px;
            background: var(--surface);
            padding: 10px;
          }

          .products-form-section .form-row .form-group,
          .products-form-section .products-price-grid .form-group,
          .products-form-section .products-components-card .form-group {
            border: 0;
            border-radius: 0;
            background: transparent;
            padding: 0;
          }

          .products-form-section input,
          .products-form-section select,
          .products-form-section textarea {
            min-height: 38px;
            font-size: 14px;
          }

          .products-form-section textarea {
            min-height: 78px !important;
          }

          .products-image-actions {
            display: grid;
            grid-template-columns: 1fr;
          }

          .products-image-btn,
          .products-image-clear {
            width: 100%;
            justify-content: center;
            min-height: 38px;
          }

          .products-product-modal-footer {
            position: relative;
            bottom: auto;
            z-index: 6;
            flex-shrink: 0;
            padding: 10px 12px calc(10px + env(safe-area-inset-bottom));
            border-top: 1px solid var(--border);
            background: var(--surface);
            box-shadow: 0 -12px 30px rgba(0, 0, 0, 0.22);
          }

          .products-form-row {
            grid-template-columns: 1fr !important;
            gap: 12px !important;
          }

          .products-price-grid {
            grid-template-columns: 1fr !important;
            gap: 12px !important;
          }

          .products-components-card {
            padding: 12px !important;
            border-radius: 16px;
          }

          .products-components-head {
            gap: 10px;
            align-items: flex-start;
          }

          .products-components-head b {
            display: inline-flex;
            align-items: center;
            gap: 6px;
            font-size: 13px;
          }

          .modal-footer {
            display: grid;
            grid-template-columns: 1fr;
            gap: 10px;
          }

          .modal-footer button {
            width: 100%;
            justify-content: center;
          }
        }

        @media (max-width: 420px) {
          .products-mobile-list {
            padding: 8px;
          }

          .products-mobile-item {
            border-radius: 14px;
            padding: 9px;
          }

          .products-mobile-head {
            align-items: center;
          }

          .products-mobile-img {
            width: 36px;
            height: 36px;
          }

          .products-mobile-title b,
          .products-mobile-title span {
            white-space: nowrap;
          }

          .products-mobile-quick {
            grid-template-columns: repeat(3, minmax(0, 1fr));
          }

          .products-mobile-quick > div {
            padding: 6px;
          }

          .products-mobile-quick small {
            font-size: 9px;
          }

          .products-mobile-quick strong {
            font-size: 11px;
          }

          .products-mobile-actions {
            grid-template-columns: 1fr 1fr;
          }

          .products-mobile-sheet-grid,
          .products-mobile-sheet-actions {
            grid-template-columns: 1fr;
          }

          .products-mobile-form-tabs {
            display: flex;
            overflow-x: auto;
            scrollbar-width: none;
          }

          .products-mobile-form-tabs::-webkit-scrollbar {
            display: none;
          }

          .products-mobile-form-tabs button {
            flex: 0 0 auto;
          }

          .products-components-head {
            flex-direction: column;
          }

          .products-components-head button {
            width: 100%;
            justify-content: center;
          }
        }
      `}</style>
    </AppLayout>
  );
}