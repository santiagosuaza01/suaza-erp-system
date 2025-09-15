import React, { useState, useEffect, useMemo } from 'react';
import {
  Box,
  Paper,
  Typography,
  Button,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  CircularProgress,
  Chip,
  Grid,
  Card,
  CardContent,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Autocomplete,
  Divider,
  List,
  ListItem,
  ListItemText,
} from '@mui/material';
import {
  Add as AddIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  ShoppingCart as ShoppingCartIcon,
  Receipt as ReceiptIcon,
} from '@mui/icons-material';
import { salesService, customersService, productsService, type Customer, type Product, type Sale } from '../services/api';
import toast from 'react-hot-toast';

// ============================================================================
// TYPES & INTERFACES
// ============================================================================

/**
 * Extended sale item interface for form handling
 */
interface SaleItemForm {
  productId: string;
  quantity: number;
  unitPrice: number;
}

/**
 * Form data interface for sale creation/editing
 */
interface SaleFormData {
  customerId: string | null;
  customerName: string;
  paymentMethod: string;
  discount: number;
  items: SaleItemForm[];
}

/**
 * Payment method options
 */
type PaymentMethod = 'cash' | 'credit' | 'transfer';

/**
 * Sale status options
 */
type SaleStatus = 'PENDING' | 'PAID' | 'CANCELLED';

/**
 * Calculated totals interface
 */
interface SaleTotals {
  subtotal: number;
  discount: number;
  taxAmount: number;
  totalAmount: number;
}

// ============================================================================
// CONSTANTS & CONFIGURATION
// ============================================================================

/**
 * Tax rate for Colombia (IVA 19%)
 */
const TAX_RATE = 0.19;

/**
 * Payment method options with labels
 */
const PAYMENT_METHODS: Record<PaymentMethod, string> = {
  cash: 'Efectivo',
  credit: 'Crédito',
  transfer: 'Transferencia',
};

/**
 * Sale status options with labels
 */
const SALE_STATUS_LABELS: Record<SaleStatus, string> = {
  PENDING: 'Pendiente',
  PAID: 'Pagado',
  CANCELLED: 'Cancelado',
};

/**
 * Sale status color mapping
 */
const SALE_STATUS_COLORS: Record<SaleStatus, 'warning' | 'success' | 'error' | 'default'> = {
  PENDING: 'warning',
  PAID: 'success',
  CANCELLED: 'error',
};

/**
 * Default form data for new sales
 */
const DEFAULT_FORM_DATA: SaleFormData = {
  customerId: null,
  customerName: '',
  paymentMethod: 'cash',
  discount: 0,
  items: [],
};

/**
 * General customer name for sales without specific customer
 */
const GENERAL_CUSTOMER_NAME = 'Cliente General';

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Formats currency values for Colombian Pesos
 * @param amount - The amount to format
 * @returns Formatted currency string
 */
const formatCurrency = (amount: number): string => {
  return new Intl.NumberFormat('es-CO', {
    style: 'currency',
    currency: 'COP',
  }).format(amount);
};

/**
 * Gets the display label for a sale status
 * @param status - The sale status
 * @returns Human-readable status label
 */
const getStatusLabel = (status: string): string => {
  return SALE_STATUS_LABELS[status as SaleStatus] || status;
};

/**
 * Gets the color for a sale status chip
 * @param status - The sale status
 * @returns Material-UI color for the chip
 */
const getStatusColor = (status: string): 'warning' | 'success' | 'error' | 'default' => {
  return SALE_STATUS_COLORS[status as SaleStatus] || 'default';
};

/**
 * Calculates sale totals including tax and discount
 * @param items - Array of sale items
 * @param discount - Discount amount
 * @returns Calculated totals object
 */
const calculateSaleTotals = (items: SaleItemForm[], discount: number): SaleTotals => {
  const subtotal = items.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0);
  const taxAmount = (subtotal - discount) * TAX_RATE;
  const totalAmount = subtotal - discount + taxAmount;

  return { subtotal, discount, taxAmount, totalAmount };
};

// ============================================================================
// MAIN COMPONENT
// ============================================================================

/**
 * SalesPage Component
 * 
 * Manages the complete sales workflow including:
 * - Viewing sales history
 * - Creating new sales
 * - Editing existing sales
 * - Managing sale items and calculations
 * 
 * @returns JSX element for the sales management page
 */
const SalesPage: React.FC = () => {
  // ============================================================================
  // STATE MANAGEMENT
  // ============================================================================
  
  // Data state
  const [sales, setSales] = useState<Sale[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  
  // UI state
  const [loading, setLoading] = useState<boolean>(true);
  const [openDialog, setOpenDialog] = useState<boolean>(false);
  
  // Form state
  const [editingSale, setEditingSale] = useState<Sale | null>(null);
  const [saleItems, setSaleItems] = useState<SaleItemForm[]>([]);
  const [formData, setFormData] = useState<SaleFormData>(DEFAULT_FORM_DATA);

  // ============================================================================
  // EFFECTS
  // ============================================================================
  
  useEffect(() => {
    initializeData();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ============================================================================
  // DATA FETCHING FUNCTIONS
  // ============================================================================
  
  /**
   * Initializes all required data for the component
   */
  const initializeData = async (): Promise<void> => {
    try {
      setLoading(true);
      await Promise.all([
        fetchSales(),
        fetchCustomers(),
        fetchProducts(),
      ]);
    } catch (error) {
      console.error('Error initializing data:', error);
      toast.error('Error al cargar los datos');
    } finally {
      setLoading(false);
    }
  };

  /**
   * Fetches all sales from the API
   */
  const fetchSales = async (): Promise<void> => {
    try {
      const response = await salesService.getAll();
      setSales(response.data.sales || response.data);
    } catch (error) {
      console.error('Error fetching sales:', error);
      toast.error('Error al cargar ventas');
    }
  };

  /**
   * Fetches all customers from the API
   */
  const fetchCustomers = async (): Promise<void> => {
    try {
      const response = await customersService.getAll();
      setCustomers(response.data.customers || response.data);
    } catch (error) {
      console.error('Error fetching customers:', error);
    }
  };

  /**
   * Fetches all products from the API
   */
  const fetchProducts = async (): Promise<void> => {
    try {
      const response = await productsService.getAll();
      setProducts(response.data.products || response.data);
    } catch (error) {
      console.error('Error fetching products:', error);
    }
  };

  // ============================================================================
  // DIALOG MANAGEMENT FUNCTIONS
  // ============================================================================
  
  /**
   * Opens the sale dialog for creating or editing a sale
   * @param sale - Optional sale to edit, if not provided creates a new sale
   */
  const handleOpenDialog = (sale?: Sale): void => {
    if (sale) {
      setEditingSale(sale);
      setFormData({
        customerId: sale.customer?.id || null,
        customerName: sale.customerName || '',
        paymentMethod: sale.paymentMethod,
        discount: sale.discount,
        items: sale.items.map(item => ({
          productId: item.productId,
          quantity: item.quantity,
          unitPrice: item.unitPrice
        }))
      });
      setSaleItems(sale.items.map(item => ({
        productId: item.productId,
        quantity: item.quantity,
        unitPrice: item.unitPrice
      })));
    } else {
      setEditingSale(null);
      setFormData(DEFAULT_FORM_DATA);
      setSaleItems([]);
    }
    setOpenDialog(true);
  };

  /**
   * Closes the sale dialog and resets form state
   */
  const handleCloseDialog = (): void => {
    setOpenDialog(false);
    setEditingSale(null);
    setSaleItems([]);
    setFormData(DEFAULT_FORM_DATA);
  };

  // ============================================================================
  // SALE ITEMS MANAGEMENT FUNCTIONS
  // ============================================================================
  
  /**
   * Adds a product to the current sale
   * @param product - The product to add
   */
  const addProductToSale = (product: Product): void => {
    const existingItem = saleItems.find(item => item.productId === product.id);

    if (existingItem) {
      if (existingItem.quantity < product.stock) {
        setSaleItems(prev =>
          prev.map(item =>
            item.productId === product.id
              ? { ...item, quantity: item.quantity + 1 }
              : item
          )
        );
      } else {
        toast.error('No hay suficiente stock disponible');
      }
    } else {
      if (product.stock > 0) {
        setSaleItems(prev => [
          ...prev,
          {
            productId: product.id,
            product,
            quantity: 1,
            unitPrice: product.price,
          },
        ]);
      } else {
        toast.error('Producto sin stock');
      }
    }
  };

  /**
   * Updates the quantity of a product in the sale
   * @param productId - The ID of the product to update
   * @param quantity - The new quantity
   */
  const updateItemQuantity = (productId: string, quantity: number): void => {
    if (quantity <= 0) {
      removeItem(productId);
      return;
    }

    const product = products.find(p => p.id === productId);
    if (product && quantity <= product.stock) {
      setSaleItems(prev =>
        prev.map(item =>
          item.productId === productId ? { ...item, quantity } : item
        )
      );
    } else {
      toast.error('No hay suficiente stock disponible');
    }
  };

  /**
   * Removes a product from the current sale
   * @param productId - The ID of the product to remove
   */
  const removeItem = (productId: string): void => {
    setSaleItems(prev => prev.filter(item => item.productId !== productId));
  };

  // ============================================================================
  // CALCULATION & SUBMISSION FUNCTIONS
  // ============================================================================
  
  /**
   * Calculates the current sale totals using memoization for performance
   */
  const currentTotals = useMemo((): SaleTotals => {
    return calculateSaleTotals(saleItems, formData.discount);
  }, [saleItems, formData.discount]);

  /**
   * Handles the submission of the sale form
   */
  const handleSubmit = async (): Promise<void> => {
    if (saleItems.length === 0) {
      toast.error('Debe agregar al menos un producto');
      return;
    }

    // Allow sales without specific customer (General Customer)
    const customerId = formData.customerId || null;
    const customerName = formData.customerName || GENERAL_CUSTOMER_NAME;

    try {
      const saleData = {
        customerId,
        customerName,
        paymentMethod: formData.paymentMethod,
        items: saleItems.map(item => ({
          productId: item.productId,
          quantity: parseInt(item.quantity.toString()),
          unitPrice: parseFloat(item.unitPrice.toString()),
        })),
      };

      if (editingSale) {
        await salesService.update(editingSale.id, saleData);
        toast.success('Venta actualizada exitosamente');
      } else {
        await salesService.create(saleData);
        toast.success('Venta creada exitosamente');
      }

      handleCloseDialog();
      await fetchSales();
    } catch (error: any) {
      const errorMessage = 
        error.response?.data?.error ||
        error.response?.data?.message ||
        'Error al guardar venta';
      
      toast.error(errorMessage);
      console.error('Error submitting sale:', error);
    }
  };

  // ============================================================================
  // STATISTICS & COMPUTED VALUES
  // ============================================================================
  
  /**
   * Calculates sales statistics using memoization for performance
   */
  const salesStats = useMemo(() => {
    const totalSales = sales.length;
    const paidSales = sales.filter(s => s.status === 'PAID').length;
    const pendingSales = sales.filter(s => s.status === 'PENDING').length;
    const totalRevenue = sales.reduce((sum, s) => sum + s.totalAmount, 0);

    return {
      totalSales,
      paidSales,
      pendingSales,
      totalRevenue,
    };
  }, [sales]);

  /**
   * Gets available products with stock for the autocomplete
   */
  const availableProducts = useMemo(() => {
    return products.filter(p => p.stock > 0);
  }, [products]);

  // ============================================================================
  // RENDER CONDITIONS
  // ============================================================================
  
  if (loading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="400px">
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box sx={{ p: 3 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h4" component="h1">
          🛒 Gestión de Ventas
        </Typography>
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={() => handleOpenDialog()}
        >
          Nueva Venta
        </Button>
      </Box>

      {/* Sales Statistics Cards */}
      <Grid container spacing={3} sx={{ mb: 3 }}>
        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center' }}>
                <ShoppingCartIcon color="primary" sx={{ mr: 2 }} />
                <Box>
                  <Typography variant="h6">{salesStats.totalSales}</Typography>
                  <Typography variant="body2" color="text.secondary">
                    Total Ventas
                  </Typography>
                </Box>
              </Box>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center' }}>
                <ReceiptIcon color="success" sx={{ mr: 2 }} />
                <Box>
                  <Typography variant="h6">{salesStats.paidSales}</Typography>
                  <Typography variant="body2" color="text.secondary">
                    Ventas Pagadas
                  </Typography>
                </Box>
              </Box>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center' }}>
                <ShoppingCartIcon color="warning" sx={{ mr: 2 }} />
                <Box>
                  <Typography variant="h6">{salesStats.pendingSales}</Typography>
                  <Typography variant="body2" color="text.secondary">
                    Ventas Pendientes
                  </Typography>
                </Box>
              </Box>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center' }}>
                <ReceiptIcon color="info" sx={{ mr: 2 }} />
                <Box>
                  <Typography variant="h6">
                    {formatCurrency(salesStats.totalRevenue)}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Total Vendido
                  </Typography>
                </Box>
              </Box>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Tabla de ventas */}
      <Paper>
        <TableContainer>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>Factura</TableCell>
                <TableCell>Cliente</TableCell>
                <TableCell>Fecha</TableCell>
                <TableCell>Total</TableCell>
                <TableCell>Método de Pago</TableCell>
                <TableCell>Estado</TableCell>
                <TableCell>Acciones</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {sales.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} align="center">
                    <Typography variant="body2" color="text.secondary">
                      No hay ventas registradas
                    </Typography>
                  </TableCell>
                </TableRow>
              ) : (
                sales.map((sale) => (
                  <TableRow key={sale.id}>
                    <TableCell>{sale.invoiceNumber}</TableCell>
                    <TableCell>{sale.customer?.name || sale.customerName || GENERAL_CUSTOMER_NAME}</TableCell>
                    <TableCell>{new Date(sale.createdAt).toLocaleDateString()}</TableCell>
                    <TableCell>{formatCurrency(sale.totalAmount)}</TableCell>
                    <TableCell>{sale.paymentMethod}</TableCell>
                    <TableCell>
                      <Chip
                        label={getStatusLabel(sale.status)}
                        color={getStatusColor(sale.status) as any}
                        size="small"
                      />
                    </TableCell>
                    <TableCell>
                      <IconButton
                        size="small"
                        onClick={() => handleOpenDialog(sale)}
                      >
                        <EditIcon />
                      </IconButton>
                      <IconButton
                        size="small"
                        color="error"
                      >
                        <DeleteIcon />
                      </IconButton>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </TableContainer>
      </Paper>

      {/* Dialog para crear/editar venta */}
      <Dialog open={openDialog} onClose={handleCloseDialog} maxWidth="lg" fullWidth>
        <DialogTitle>
          {editingSale ? 'Editar Venta' : 'Nueva Venta'}
        </DialogTitle>
        <DialogContent>
          <Grid container spacing={3} sx={{ mt: 1 }}>
            {/* Información del cliente */}
            <Grid item xs={12} md={6}>
              <Typography variant="h6" gutterBottom>Información del Cliente</Typography>
              <Grid container spacing={2}>
                <Grid item xs={12}>
                  <FormControl fullWidth>
                    <InputLabel>Cliente</InputLabel>
                    <Select
                      value={formData.customerId}
                      onChange={(e) => setFormData({ ...formData, customerId: e.target.value })}
                    >
                      <MenuItem value="">Cliente General</MenuItem>
                      {customers.map((customer) => (
                        <MenuItem key={customer.id} value={customer.id}>
                          {customer.name} - {customer.taxId}
                        </MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                </Grid>
                <Grid item xs={12}>
                  <TextField
                    fullWidth
                    label="Nombre del Cliente (si no está registrado)"
                    value={formData.customerName}
                    onChange={(e) => setFormData({ ...formData, customerName: e.target.value })}
                  />
                </Grid>
                <Grid item xs={12} sm={6}>
                  <FormControl fullWidth>
                    <InputLabel>Método de Pago</InputLabel>
                    <Select
                      value={formData.paymentMethod}
                      onChange={(e) => setFormData({ ...formData, paymentMethod: e.target.value })}
                    >
                      {Object.entries(PAYMENT_METHODS).map(([value, label]) => (
                        <MenuItem key={value} value={value}>
                          {label}
                        </MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                </Grid>
                <Grid item xs={12} sm={6}>
                  <TextField
                    fullWidth
                    label="Descuento"
                    type="number"
                    value={formData.discount}
                    onChange={(e) => setFormData({ ...formData, discount: Number(e.target.value) })}
                  />
                </Grid>
              </Grid>
            </Grid>

            {/* Productos disponibles */}
            <Grid item xs={12} md={6}>
              <Typography variant="h6" gutterBottom>Productos Disponibles</Typography>
              <Autocomplete
                options={availableProducts}
                getOptionLabel={(option) => `${option.code} - ${option.name} (Stock: ${option.stock})`}
                renderInput={(params) => (
                  <TextField {...params} label="Buscar producto" />
                )}
                onChange={(_, value) => {
                  if (value) addProductToSale(value);
                }}
              />
            </Grid>

            {/* Items de la venta */}
            <Grid item xs={12}>
              <Typography variant="h6" gutterBottom>Productos en la Venta</Typography>
              <List>
                {saleItems.map((item) => {
                  const product = products.find(p => p.id === item.productId);
                  return (
                    <ListItem key={item.productId} sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <ListItemText
                        primary={`${product?.code || 'N/A'} - ${product?.name || 'Producto no encontrado'}`}
                        secondary={`Precio: ${formatCurrency(item.unitPrice)} | Stock: ${product?.stock || 0}`}
                      />
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <TextField
                        size="small"
                        type="number"
                        value={item.quantity}
                        onChange={(e) => updateItemQuantity(item.productId, Number(e.target.value))}
                        sx={{ width: 80 }}
                      />
                      <Typography variant="body2" sx={{ minWidth: 100 }}>
                        {formatCurrency(item.quantity * item.unitPrice)}
                      </Typography>
                      <IconButton
                        size="small"
                        onClick={() => removeItem(item.productId)}
                        color="error"
                      >
                        <DeleteIcon />
                      </IconButton>
                    </Box>
                  </ListItem>
                  );
                })}
              </List>
            </Grid>

            {/* Sale Totals */}
            <Grid item xs={12}>
              <Divider />
              <Box sx={{ display: 'flex', justifyContent: 'space-between', mt: 2 }}>
                <Typography>Subtotal:</Typography>
                <Typography>{formatCurrency(currentTotals.subtotal)}</Typography>
              </Box>
              <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                <Typography>Descuento:</Typography>
                <Typography>-{formatCurrency(currentTotals.discount)}</Typography>
              </Box>
              <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                <Typography>IVA (19%):</Typography>
                <Typography>{formatCurrency(currentTotals.taxAmount)}</Typography>
              </Box>
              <Divider />
              <Box sx={{ display: 'flex', justifyContent: 'space-between', fontWeight: 'bold' }}>
                <Typography variant="h6">Total:</Typography>
                <Typography variant="h6">{formatCurrency(currentTotals.totalAmount)}</Typography>
              </Box>
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseDialog}>Cancelar</Button>
          <Button onClick={handleSubmit} variant="contained">
            {editingSale ? 'Actualizar' : 'Crear Venta'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default SalesPage;
