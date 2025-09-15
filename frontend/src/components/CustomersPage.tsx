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
} from '@mui/material';
import {
  Add as AddIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  Person as PersonIcon,
} from '@mui/icons-material';
import { customersService } from '../services/api';
import toast from 'react-hot-toast';

// ============================================================================
// TYPES & INTERFACES
// ============================================================================

/**
 * Customer interface for customer management
 */
interface Customer {
  id: string;
  name: string;
  documentType?: string;
  documentNumber?: string;
  taxId?: string; // Primary field in database
  email?: string;
  phone?: string;
  address?: string;
  city?: string;
  creditLimit?: number;
  isActive: boolean;
  createdAt: string;
}

/**
 * Form data interface for customer creation/editing
 */
interface CustomerFormData {
  name: string;
  documentType: string;
  documentNumber: string;
  email: string;
  phone: string;
  address: string;
  city: string;
  creditLimit: number;
}

// ============================================================================
// CONSTANTS & CONFIGURATION
// ============================================================================

/**
 * Document type options
 */
const DOCUMENT_TYPES = [
  { value: 'CC', label: 'Cédula de Ciudadanía' },
  { value: 'CE', label: 'Cédula de Extranjería' },
  { value: 'NIT', label: 'NIT' },
  { value: 'RUT', label: 'RUT' },
  { value: 'PASSPORT', label: 'Pasaporte' },
];

/**
 * Default form data for new customers
 */
const DEFAULT_FORM_DATA: CustomerFormData = {
  name: '',
  documentType: 'CC',
  documentNumber: '',
  email: '',
  phone: '',
  address: '',
  city: '',
  creditLimit: 0,
};

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

// ============================================================================
// MAIN COMPONENT
// ============================================================================

/**
 * CustomersPage Component
 * 
 * Manages customer data including:
 * - Viewing customer list
 * - Creating new customers
 * - Editing existing customers
 * - Deleting customers
 * 
 * @returns JSX element for the customer management page
 */
const CustomersPage: React.FC = () => {
  // ============================================================================
  // STATE MANAGEMENT
  // ============================================================================
  
  // Data state
  const [customers, setCustomers] = useState<Customer[]>([]);
  
  // UI state
  const [loading, setLoading] = useState<boolean>(true);
  const [openDialog, setOpenDialog] = useState<boolean>(false);
  
  // Form state
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null);
  const [formData, setFormData] = useState<CustomerFormData>(DEFAULT_FORM_DATA);

  // ============================================================================
  // EFFECTS
  // ============================================================================
  
  useEffect(() => {
    initializeData();
  }, []);

  // ============================================================================
  // DATA FETCHING FUNCTIONS
  // ============================================================================
  
  /**
   * Initializes customer data
   */
  const initializeData = async (): Promise<void> => {
    try {
      setLoading(true);
      await fetchCustomers();
    } catch (error) {
      console.error('Error initializing customer data:', error);
      toast.error('Error al cargar los datos de clientes');
    } finally {
      setLoading(false);
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
      toast.error('Error al cargar clientes');
    }
  };

  // ============================================================================
  // STATISTICS & COMPUTED VALUES
  // ============================================================================
  
  /**
   * Calculates customer statistics using memoization for performance
   */
  const customerStats = useMemo(() => {
    const totalCustomers = customers.length;
    const activeCustomers = customers.filter(c => c.isActive).length;
    const totalCreditLimit = customers.reduce((sum, c) => sum + (c.creditLimit || 0), 0);
    const averageCreditLimit = totalCustomers > 0 ? totalCreditLimit / totalCustomers : 0;

    return {
      totalCustomers,
      activeCustomers,
      totalCreditLimit,
      averageCreditLimit,
    };
  }, [customers]);

  // ============================================================================
  // DIALOG MANAGEMENT FUNCTIONS
  // ============================================================================
  
  /**
   * Opens the customer dialog for creating or editing a customer
   * @param customer - Optional customer to edit, if not provided creates a new customer
   */
  const handleOpenDialog = (customer?: Customer): void => {
    if (customer) {
      setEditingCustomer(customer);
      setFormData({
        name: customer.name,
        documentType: customer.documentType || 'CC',
        documentNumber: customer.documentNumber || customer.taxId || '',
        email: customer.email || '',
        phone: customer.phone || '',
        address: customer.address || '',
        city: customer.city || '',
        creditLimit: customer.creditLimit || 0,
      });
    } else {
      setEditingCustomer(null);
      setFormData(DEFAULT_FORM_DATA);
    }
    setOpenDialog(true);
  };

  /**
   * Closes the customer dialog and resets form state
   */
  const handleCloseDialog = (): void => {
    setOpenDialog(false);
    setEditingCustomer(null);
    setFormData(DEFAULT_FORM_DATA);
  };

  // ============================================================================
  // FORM HANDLING FUNCTIONS
  // ============================================================================
  
  /**
   * Handles the submission of the customer form
   */
  const handleSubmit = async (): Promise<void> => {
    try {
      if (editingCustomer) {
        await customersService.update(editingCustomer.id, formData);
        toast.success('Cliente actualizado exitosamente');
      } else {
        await customersService.create(formData);
        toast.success('Cliente creado exitosamente');
      }
      
      handleCloseDialog();
      await fetchCustomers();
    } catch (error: any) {
      if (error.response?.data?.errors) {
        const validationErrors = error.response.data.errors;
        const errorMessages = validationErrors.map((e: any) => e.msg).join(', ');
        toast.error(`Errores de validación: ${errorMessages}`);
      } else {
        const errorMessage = 
          error.response?.data?.error ||
          error.response?.data?.message ||
          'Error al guardar cliente';
        toast.error(errorMessage);
      }
      console.error('Error submitting customer:', error);
    }
  };

  /**
   * Handles the deletion of a customer
   * @param id - The ID of the customer to delete
   */
  const handleDelete = async (id: string): Promise<void> => {
    if (window.confirm('¿Estás seguro de que quieres eliminar este cliente?')) {
      try {
        await customersService.delete(id);
        toast.success('Cliente eliminado exitosamente');
        await fetchCustomers();
      } catch (error: any) {
        const errorMessage = 
          error.response?.data?.error ||
          error.response?.data?.message ||
          'Error al eliminar cliente';
        toast.error(errorMessage);
        console.error('Error deleting customer:', error);
      }
    }
  };


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
          👥 Gestión de Clientes
        </Typography>
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={() => handleOpenDialog()}
        >
          Nuevo Cliente
        </Button>
      </Box>

      {/* Estadísticas */}
      <Grid container spacing={3} sx={{ mb: 3 }}>
        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center' }}>
                <PersonIcon color="primary" sx={{ mr: 2 }} />
                <Box>
                  <Typography variant="h6">{customerStats.totalCustomers}</Typography>
                  <Typography variant="body2" color="text.secondary">
                    Total Clientes
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
                <PersonIcon color="success" sx={{ mr: 2 }} />
                <Box>
                  <Typography variant="h6">{customerStats.activeCustomers}</Typography>
                  <Typography variant="body2" color="text.secondary">
                    Clientes Activos
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
                <PersonIcon color="warning" sx={{ mr: 2 }} />
                <Box>
                  <Typography variant="h6">
                    {customers.filter(c => !c.isActive).length}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Clientes Inactivos
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
                <PersonIcon color="info" sx={{ mr: 2 }} />
                <Box>
                  <Typography variant="h6">
                    {formatCurrency(customerStats.totalCreditLimit)}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Límite Total
                  </Typography>
                </Box>
              </Box>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Tabla de clientes */}
      <Paper>
        <TableContainer>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>Nombre</TableCell>
                <TableCell>NIT/CC</TableCell>
                <TableCell>Email</TableCell>
                <TableCell>Teléfono</TableCell>
                <TableCell>Ciudad</TableCell>
                <TableCell>Límite Crédito</TableCell>
                <TableCell>Estado</TableCell>
                <TableCell>Acciones</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {customers.map((customer) => (
                <TableRow key={customer.id}>
                  <TableCell>{customer.name}</TableCell>
                  <TableCell>{customer.documentNumber || customer.taxId}</TableCell>
                  <TableCell>{customer.email || 'N/A'}</TableCell>
                  <TableCell>{customer.phone || 'N/A'}</TableCell>
                  <TableCell>{customer.city || 'N/A'}</TableCell>
                  <TableCell>{formatCurrency(customer.creditLimit || 0)}</TableCell>
                  <TableCell>
                    <Chip
                      label={customer.isActive ? 'Activo' : 'Inactivo'}
                      color={customer.isActive ? 'success' : 'default'}
                      size="small"
                    />
                  </TableCell>
                  <TableCell>
                    <IconButton
                      size="small"
                      onClick={() => handleOpenDialog(customer)}
                    >
                      <EditIcon />
                    </IconButton>
                    <IconButton
                      size="small"
                      onClick={() => handleDelete(customer.id)}
                      color="error"
                    >
                      <DeleteIcon />
                    </IconButton>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      </Paper>

      {/* Dialog para crear/editar cliente */}
      <Dialog open={openDialog} onClose={handleCloseDialog} maxWidth="md" fullWidth>
        <DialogTitle>
          {editingCustomer ? 'Editar Cliente' : 'Nuevo Cliente'}
        </DialogTitle>
        <DialogContent>
          <Grid container spacing={2} sx={{ mt: 1 }}>
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                label="Nombre Completo"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                required
              />
            </Grid>
            <Grid item xs={12} sm={3}>
              <FormControl fullWidth required>
                <InputLabel>Tipo de Documento</InputLabel>
                <Select
                  value={formData.documentType}
                  onChange={(e) => setFormData({ ...formData, documentType: e.target.value })}
                  label="Tipo de Documento"
                >
                  {DOCUMENT_TYPES.map((type) => (
                    <MenuItem key={type.value} value={type.value}>
                      {type.label}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} sm={3}>
              <TextField
                fullWidth
                label="Número de Documento"
                value={formData.documentNumber}
                onChange={(e) => setFormData({ ...formData, documentNumber: e.target.value })}
                required
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                label="Email"
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                label="Teléfono"
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
              />
            </Grid>
            <Grid item xs={12}>
              <TextField
                fullWidth
                label="Dirección"
                value={formData.address}
                onChange={(e) => setFormData({ ...formData, address: e.target.value })}
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                label="Ciudad"
                value={formData.city}
                onChange={(e) => setFormData({ ...formData, city: e.target.value })}
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                label="Límite de Crédito"
                type="number"
                value={formData.creditLimit || ''}
                onChange={(e) => setFormData({ ...formData, creditLimit: e.target.value ? Number(e.target.value) : 0 })}
                placeholder="0"
              />
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseDialog}>Cancelar</Button>
          <Button onClick={handleSubmit} variant="contained">
            {editingCustomer ? 'Actualizar' : 'Crear'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default CustomersPage;
