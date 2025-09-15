import React, { useState, useRef } from 'react';
import { 
  Box, 
  TextField, 
  Button, 
  Typography, 
  Paper,
  IconButton,
  InputAdornment
} from '@mui/material';
import { QrCode, QrCodeScanner, ContentCopy, Check } from '@mui/icons-material';

interface BarcodeScannerProps {
  onScan: (code: string) => void;
  placeholder?: string;
  label?: string;
}

const BarcodeScanner: React.FC<BarcodeScannerProps> = ({ 
  onScan, 
  placeholder = "Escanear código de barras o QR",
  label = "Código de barras"
}) => {
  const [scannedCode, setScannedCode] = useState('');
  const [isManual, setIsManual] = useState(false);
  const [copied, setCopied] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleScan = () => {
    if (scannedCode.trim()) {
      onScan(scannedCode.trim());
      setScannedCode('');
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleScan();
    }
  };

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(scannedCode);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Error al copiar:', err);
    }
  };

  const toggleMode = () => {
    setIsManual(!isManual);
    if (!isManual) {
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  };

  return (
    <Paper elevation={2} sx={{ p: 2, maxWidth: 400 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
        <QrCodeScanner sx={{ mr: 1, color: 'primary.main' }} />
        <Typography variant="h6" component="h3">
          Lector de Códigos
        </Typography>
      </Box>

      <Box sx={{ mb: 2 }}>
        <TextField
          ref={inputRef}
          fullWidth
          label={label}
          placeholder={placeholder}
          value={scannedCode}
          onChange={(e) => setScannedCode(e.target.value)}
          onKeyPress={handleKeyPress}
          InputProps={{
            endAdornment: (
              <InputAdornment position="end">
                <IconButton
                  onClick={handleCopy}
                  disabled={!scannedCode}
                  size="small"
                >
                  {copied ? <Check color="success" /> : <ContentCopy />}
                </IconButton>
              </InputAdornment>
            ),
          }}
        />
      </Box>

      <Box sx={{ display: 'flex', gap: 1, mb: 2 }}>
        <Button
          variant="contained"
          onClick={handleScan}
          disabled={!scannedCode.trim()}
          fullWidth
          startIcon={<QrCode />}
        >
          Procesar Código
        </Button>
        
        <Button
          variant="outlined"
          onClick={toggleMode}
          startIcon={isManual ? <QrCodeScanner /> : <QrCode />}
        >
          {isManual ? 'Modo Escáner' : 'Modo Manual'}
        </Button>
      </Box>

      {isManual && (
        <Box sx={{ mt: 2, p: 2, bgcolor: 'grey.50', borderRadius: 1 }}>
          <Typography variant="body2" color="text.secondary">
            💡 <strong>Modo Manual:</strong> Escribe el código directamente o usa un lector USB de códigos de barras.
          </Typography>
        </Box>
      )}

      {!isManual && (
        <Box sx={{ mt: 2, p: 2, bgcolor: 'blue.50', borderRadius: 1 }}>
          <Typography variant="body2" color="text.secondary">
            📱 <strong>Modo Escáner:</strong> Usa la cámara de tu dispositivo o un escáner físico.
          </Typography>
        </Box>
      )}
    </Paper>
  );
};

export default BarcodeScanner; 