import React, { useState, useEffect } from 'react';
import {
  Box,
  Paper,
  Typography,
  Grid,
  Card,
  CardContent,
  Button,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Chip,
  CircularProgress,
} from '@mui/material';
import {
  TrendingUp as TrendingUpIcon,
  TrendingDown as TrendingDownIcon,
  Assessment as AssessmentIcon,
  Inventory as InventoryIcon,
  People as PeopleIcon,
  ShoppingCart as ShoppingCartIcon,
} from '@mui/icons-material';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
} from 'recharts';
import { salesService, customersService, productsService } from '../services/api';
import toast from 'react-hot-toast';

interface ReportData {
  totalSales: number;
  totalCustomers: number;
  totalProducts: number;
  lowStockProducts: number;
  salesByMonth: Array<{
    month: string;
    sales: number;
    count: number;
  }>;
  topProducts: Array<{
    name: string;
    sales: number;
    quantity: number;
  }>;
  salesByPaymentMethod: Array<{
    method: string;
    count: number;
    amount: number;
  }>;
  recentSales: Array<{
    id: string;
    invoiceNumber: string;
    customerName: string;
    totalAmount: number;
    createdAt: string;
  }>;
}

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884D8'];

const ReportsPage: React.FC = () => {
  const [reportData, setReportData] = useState<ReportData | null>(null);
  const [loading, setLoading] = useState(true);
  const [dateRange, setDateRange] = useState('30');

  useEffect(() => {
    fetchReportData();
  }, [dateRange]);

  const fetchReportData = async () => {
    try {
      setLoading(true);
      
      // Obtener datos reales de las APIs
      const [salesRes, customersRes, productsRes] = await Promise.all([
        salesService.getAll(),
        customersService.getAll(),
        productsService.getAll()
      ]);

      const sales = salesRes.data.sales || salesRes.data;
      const customers = customersRes.data.customers || customersRes.data;
      const products = productsRes.data.products || productsRes.data;

      console.log('=== DEBUGGING REPORTS ===');
      console.log('Sales response:', salesRes);
      console.log('Sales data:', sales);
      console.log('Customers data:', customers);
      console.log('Products data:', products);

      // Calcular ventas totales reales
      const totalSales = sales.reduce((sum: number, sale: any) => sum + parseFloat(sale.totalAmount), 0);
      console.log('Total sales calculated:', totalSales);

      // Calcular métodos de pago reales
      const paymentMethodsMap = new Map();
      sales.forEach((sale: any) => {
        const method = sale.paymentMethod;
        if (paymentMethodsMap.has(method)) {
          const current = paymentMethodsMap.get(method);
          paymentMethodsMap.set(method, {
            method: method,
            count: current.count + 1,
            amount: current.amount + parseFloat(sale.totalAmount)
          });
        } else {
          paymentMethodsMap.set(method, {
            method: method,
            count: 1,
            amount: parseFloat(sale.totalAmount)
          });
        }
      });

      const salesByPaymentMethod = Array.from(paymentMethodsMap.values());

      // Calcular productos más vendidos
      const productSalesMap = new Map();
      
      // Procesar todas las ventas y sus items
      sales.forEach((sale: any) => {
        if (sale.items && Array.isArray(sale.items)) {
          sale.items.forEach((item: any) => {
            const productId = item.productId;
            const quantity = parseInt(item.quantity) || 0;
            const totalPrice = parseFloat(item.totalPrice) || 0;
            
            if (productSalesMap.has(productId)) {
              const current = productSalesMap.get(productId);
              productSalesMap.set(productId, {
                productId: productId,
                name: item.product?.name || 'Producto desconocido',
                quantity: current.quantity + quantity,
                sales: current.sales + totalPrice
              });
            } else {
              productSalesMap.set(productId, {
                productId: productId,
                name: item.product?.name || 'Producto desconocido',
                quantity: quantity,
                sales: totalPrice
              });
            }
          });
        }
      });

      // Convertir a array y ordenar por ventas (descendente)
      const topProducts = Array.from(productSalesMap.values())
        .sort((a, b) => b.sales - a.sales)
        .slice(0, 5); // Top 5 productos

      console.log('Top products calculated:', topProducts);

      const realData: ReportData = {
        totalSales: totalSales,
        totalCustomers: customers.length,
        totalProducts: products.length,
        lowStockProducts: products.filter((p: any) => p.stock < 10).length,
        salesByMonth: [
          { month: 'Ene', sales: 0, count: 0 },
          { month: 'Feb', sales: 0, count: 0 },
          { month: 'Mar', sales: 0, count: 0 },
          { month: 'Abr', sales: 0, count: 0 },
          { month: 'May', sales: 0, count: 0 },
          { month: 'Jun', sales: totalSales, count: sales.length },
        ],
        topProducts: topProducts,
        salesByPaymentMethod: salesByPaymentMethod,
        recentSales: sales.slice(0, 5).map((sale: any) => ({
          id: sale.id,
          invoiceNumber: sale.invoiceNumber,
          customerName: sale.customer?.name || sale.customerName || 'Cliente General',
          totalAmount: parseFloat(sale.totalAmount),
          createdAt: new Date(sale.createdAt).toLocaleDateString(),
        })),
      };
      
      setReportData(realData);
    } catch (error: any) {
      console.error('=== REPORTS ERROR ===');
      console.error('Full error:', error);
      console.error('Error response:', error.response);
      console.error('Error message:', error.message);
      
      toast.error('Error al cargar reportes');
      console.error('Error fetching reports:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('es-CO', {
      style: 'currency',
      currency: 'COP',
    }).format(amount);
  };

  const formatNumber = (num: number) => {
    return new Intl.NumberFormat('es-CO').format(num);
  };

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="400px">
        <CircularProgress />
      </Box>
    );
  }

  if (!reportData) {
    return (
      <Box sx={{ p: 3 }}>
        <Typography variant="h6">No hay datos disponibles</Typography>
      </Box>
    );
  }

  return (
    <Box sx={{ p: 3 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h4" component="h1">
          📊 Reportes y Análisis
        </Typography>
        <FormControl sx={{ minWidth: 120 }}>
          <InputLabel>Período</InputLabel>
          <Select
            value={dateRange}
            onChange={(e) => setDateRange(e.target.value)}
          >
            <MenuItem value="7">Últimos 7 días</MenuItem>
            <MenuItem value="30">Últimos 30 días</MenuItem>
            <MenuItem value="90">Últimos 90 días</MenuItem>
            <MenuItem value="365">Último año</MenuItem>
          </Select>
        </FormControl>
      </Box>

      {/* Métricas principales */}
      <Grid container spacing={3} sx={{ mb: 4 }}>
        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center' }}>
                <ShoppingCartIcon color="primary" sx={{ mr: 2, fontSize: 40 }} />
                <Box>
                  <Typography variant="h5" color="primary" sx={{ fontSize: { xs: '1.2rem', sm: '1.5rem', md: '2rem' } }}>
                    {formatCurrency(reportData.totalSales)}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Ventas Totales
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
                <PeopleIcon color="success" sx={{ mr: 2, fontSize: 40 }} />
                <Box>
                  <Typography variant="h4" color="success.main">
                    {reportData.totalCustomers}
                  </Typography>
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
                <InventoryIcon color="info" sx={{ mr: 2, fontSize: 40 }} />
                <Box>
                  <Typography variant="h4" color="info.main">
                    {reportData.totalProducts}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Productos en Stock
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
                <TrendingDownIcon color="warning" sx={{ mr: 2, fontSize: 40 }} />
                <Box>
                  <Typography variant="h4" color="warning.main">
                    {reportData.lowStockProducts}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Stock Bajo
                  </Typography>
                </Box>
              </Box>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Gráficos */}
      <Grid container spacing={3} sx={{ mb: 4 }}>
        {/* Ventas por mes */}
        <Grid item xs={12} md={8}>
          <Paper sx={{ p: 3 }}>
            <Typography variant="h6" gutterBottom>
              📈 Ventas por Mes
            </Typography>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={reportData.salesByMonth}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="month" />
                <YAxis tickFormatter={(value) => formatCurrency(value)} />
                <Tooltip formatter={(value) => formatCurrency(Number(value))} />
                <Legend />
                <Line
                  type="monotone"
                  dataKey="sales"
                  stroke="#2E7D32"
                  strokeWidth={2}
                  name="Ventas"
                />
              </LineChart>
            </ResponsiveContainer>
          </Paper>
        </Grid>

        {/* Métodos de pago */}
        <Grid item xs={12} md={4}>
          <Paper sx={{ p: 3 }}>
            <Typography variant="h6" gutterBottom>
              💳 Métodos de Pago
            </Typography>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={reportData.salesByPaymentMethod}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ method, amount }) => `${method}: ${formatCurrency(amount)}`}
                  outerRadius={60}
                  fill="#8884d8"
                  dataKey="amount"
                >
                  {reportData.salesByPaymentMethod.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip formatter={(value) => formatCurrency(Number(value))} />
              </PieChart>
            </ResponsiveContainer>
          </Paper>
        </Grid>
      </Grid>

      {/* Productos más vendidos */}
      <Grid container spacing={3} sx={{ mb: 4 }}>
        <Grid item xs={12} md={6}>
          <Paper sx={{ p: 3 }}>
            <Typography variant="h6" gutterBottom>
              🏆 Productos Más Vendidos
            </Typography>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={reportData.topProducts}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" />
                <YAxis tickFormatter={(value) => formatCurrency(value)} />
                <Tooltip formatter={(value) => formatCurrency(Number(value))} />
                <Bar dataKey="sales" fill="#4CAF50" />
              </BarChart>
            </ResponsiveContainer>
          </Paper>
        </Grid>

        {/* Ventas recientes */}
        <Grid item xs={12} md={6}>
          <Paper sx={{ p: 3 }}>
            <Typography variant="h6" gutterBottom>
              🕒 Ventas Recientes
            </Typography>
            <TableContainer>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>Factura</TableCell>
                    <TableCell>Cliente</TableCell>
                    <TableCell>Total</TableCell>
                    <TableCell>Fecha</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {reportData.recentSales.map((sale) => (
                    <TableRow key={sale.id}>
                      <TableCell>{sale.invoiceNumber}</TableCell>
                      <TableCell>{sale.customerName}</TableCell>
                      <TableCell>{formatCurrency(sale.totalAmount)}</TableCell>
                      <TableCell>
                        {new Date(sale.createdAt).toLocaleDateString()}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          </Paper>
        </Grid>
      </Grid>

      {/* Resumen de rendimiento */}
      <Grid container spacing={3}>
        <Grid item xs={12} md={4}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                📊 Resumen de Rendimiento
              </Typography>
              <Box sx={{ mt: 2 }}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                  <Typography variant="body2">Promedio por Venta:</Typography>
                  <Typography variant="body2" fontWeight="bold">
                    {formatCurrency(reportData.totalSales / 80)}
                  </Typography>
                </Box>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                  <Typography variant="body2">Ventas por Día:</Typography>
                  <Typography variant="body2" fontWeight="bold">
                    {formatNumber(Math.round(80 / 30))}
                  </Typography>
                </Box>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                  <Typography variant="body2">Ticket Promedio:</Typography>
                  <Typography variant="body2" fontWeight="bold">
                    {formatCurrency(reportData.totalSales / 80)}
                  </Typography>
                </Box>
                <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                  <Typography variant="body2">Crecimiento:</Typography>
                  <Chip
                    label="+12.5%"
                    color="success"
                    size="small"
                    icon={<TrendingUpIcon />}
                  />
                </Box>
              </Box>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} md={4}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                🎯 Objetivos del Mes
              </Typography>
              <Box sx={{ mt: 2 }}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                  <Typography variant="body2">Meta de Ventas:</Typography>
                  <Typography variant="body2" fontWeight="bold">
                    {formatCurrency(20000000)}
                  </Typography>
                </Box>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                  <Typography variant="body2">Progreso:</Typography>
                  <Typography variant="body2" fontWeight="bold">
                    78.75%
                  </Typography>
                </Box>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                  <Typography variant="body2">Faltante:</Typography>
                  <Typography variant="body2" fontWeight="bold">
                    {formatCurrency(4250000)}
                  </Typography>
                </Box>
                <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                  <Typography variant="body2">Días Restantes:</Typography>
                  <Typography variant="body2" fontWeight="bold">
                    19 días
                  </Typography>
                </Box>
              </Box>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} md={4}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                ⚠️ Alertas
              </Typography>
              <Box sx={{ mt: 2 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                  <TrendingDownIcon color="warning" sx={{ mr: 1 }} />
                  <Typography variant="body2">
                    {reportData.lowStockProducts} productos con stock bajo
                  </Typography>
                </Box>
                <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                  <AssessmentIcon color="info" sx={{ mr: 1 }} />
                  <Typography variant="body2">
                    Meta de ventas al 78.75%
                  </Typography>
                </Box>
                <Box sx={{ display: 'flex', alignItems: 'center' }}>
                  <PeopleIcon color="success" sx={{ mr: 1 }} />
                  <Typography variant="body2">
                    {reportData.totalCustomers} clientes activos
                  </Typography>
                </Box>
              </Box>
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    </Box>
  );
};

export default ReportsPage;
