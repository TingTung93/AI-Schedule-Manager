import React, { useState, useRef } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Alert,
  Typography,
  Box,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  IconButton,
  Chip
} from '@mui/material';
import { CloudUpload, Close, CheckCircle, Error as ErrorIcon } from '@mui/icons-material';
import PropTypes from 'prop-types';
import api from '../../services/api';
import ProgressIndicator from './ProgressIndicator';

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
const SUPPORTED_FORMATS = {
  'text/csv': 'CSV',
  'application/vnd.ms-excel': 'Excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'Excel'
};

/**
 * ImportDialog Component
 *
 * Handles schedule data import from CSV and Excel files
 * Features: file upload, format validation, preview, progress tracking
 */
const ImportDialog = ({ open, onClose, onImport }) => {
  const [selectedFile, setSelectedFile] = useState(null);
  const [format, setFormat] = useState('csv');
  const [preview, setPreview] = useState(null);
  const [errors, setErrors] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [result, setResult] = useState(null);
  const [dragActive, setDragActive] = useState(false);
  const fileInputRef = useRef(null);

  const handleReset = () => {
    setSelectedFile(null);
    setFormat('csv');
    setPreview(null);
    setErrors([]);
    setUploading(false);
    setProgress(0);
    setResult(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleClose = () => {
    handleReset();
    onClose();
  };

  const validateFile = (file) => {
    const validationErrors = [];

    // Check file size
    if (file.size > MAX_FILE_SIZE) {
      validationErrors.push(`File size exceeds 10MB limit (${(file.size / 1024 / 1024).toFixed(2)}MB)`);
    }

    // Check file type
    const fileType = file.type;
    const fileExtension = file.name.split('.').pop().toLowerCase();

    if (!SUPPORTED_FORMATS[fileType] && !['csv', 'xlsx', 'xls'].includes(fileExtension)) {
      validationErrors.push('Unsupported file format. Please use CSV or Excel (.xlsx, .xls)');
    }

    // Auto-detect format from extension
    if (fileExtension === 'csv') {
      setFormat('csv');
    } else if (['xlsx', 'xls'].includes(fileExtension)) {
      setFormat('excel');
    }

    return validationErrors;
  };

  const parsePreviewData = (data) => {
    // Parse first 5 rows for preview
    const lines = data.split('\n').slice(0, 6); // Header + 5 rows
    if (lines.length < 2) {
      return null;
    }

    const headers = lines[0].split(',').map(h => h.trim());
    const rows = lines.slice(1).map(line => {
      const values = line.split(',').map(v => v.trim());
      return headers.reduce((obj, header, index) => {
        obj[header] = values[index] || '';
        return obj;
      }, {});
    }).filter(row => Object.values(row).some(v => v)); // Filter empty rows

    return { headers, rows };
  };

  const handleFileSelect = async (file) => {
    if (!file) return;

    const validationErrors = validateFile(file);
    if (validationErrors.length > 0) {
      setErrors(validationErrors);
      setSelectedFile(null);
      setPreview(null);
      return;
    }

    setErrors([]);
    setSelectedFile(file);

    // Read file for preview
    if (file.type === 'text/csv' || file.name.endsWith('.csv')) {
      const reader = new FileReader();
      reader.onload = (e) => {
        const text = e.target.result;
        const previewData = parsePreviewData(text);
        setPreview(previewData);
      };
      reader.readAsText(file);
    } else {
      // For Excel files, show basic info without preview
      setPreview({
        headers: ['Excel file selected - preview will be available after upload'],
        rows: []
      });
    }
  };

  const handleFileChange = (event) => {
    const file = event.target.files[0];
    handleFileSelect(file);
  };

  const handleDrag = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    const file = e.dataTransfer.files[0];
    if (file) {
      handleFileSelect(file);
    }
  };

  const handleUpload = async () => {
    if (!selectedFile) {
      setErrors(['Please select a file to upload']);
      return;
    }

    setUploading(true);
    setProgress(0);
    setErrors([]);
    setResult(null);

    const formData = new FormData();
    formData.append('file', selectedFile);
    formData.append('format', format);

    try {
      // Simulate progress (real progress would come from upload events)
      const progressInterval = setInterval(() => {
        setProgress(prev => {
          if (prev >= 90) {
            clearInterval(progressInterval);
            return 90;
          }
          return prev + 10;
        });
      }, 200);

      const response = await api.post('/api/data-io/import', formData, {
        headers: {
          'Content-Type': 'multipart/form-data'
        },
        onUploadProgress: (progressEvent) => {
          const percentCompleted = Math.round((progressEvent.loaded * 100) / progressEvent.total);
          setProgress(percentCompleted);
        }
      });

      clearInterval(progressInterval);
      setProgress(100);

      if (response.data.success) {
        setResult({
          success: true,
          created: response.data.shifts_created || 0,
          updated: response.data.shifts_updated || 0,
          errors: response.data.errors || []
        });

        // Call onImport callback
        if (onImport) {
          onImport(response.data);
        }
      } else {
        setErrors([response.data.message || 'Import failed']);
      }
    } catch (error) {
      console.error('Import error:', error);
      setErrors([
        error.response?.data?.message ||
        error.response?.data?.error ||
        'Failed to import file. Please check the format and try again.'
      ]);
      setProgress(0);
    } finally {
      setUploading(false);
    }
  };

  return (
    <Dialog
      open={open}
      onClose={handleClose}
      maxWidth="md"
      fullWidth
      PaperProps={{
        sx: { minHeight: '500px' }
      }}
    >
      <DialogTitle>
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <CloudUpload />
            <Typography variant="h6">Import Schedule Data</Typography>
          </Box>
          <IconButton onClick={handleClose} size="small">
            <Close />
          </IconButton>
        </Box>
      </DialogTitle>

      <DialogContent dividers>
        {/* File Upload Area */}
        {!result && (
          <Box
            sx={{
              border: 2,
              borderColor: dragActive ? 'primary.main' : 'divider',
              borderStyle: 'dashed',
              borderRadius: 2,
              p: 4,
              textAlign: 'center',
              backgroundColor: dragActive ? 'action.hover' : 'background.paper',
              cursor: 'pointer',
              mb: 3,
              transition: 'all 0.2s ease'
            }}
            onDragEnter={handleDrag}
            onDragLeave={handleDrag}
            onDragOver={handleDrag}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
          >
            <CloudUpload sx={{ fontSize: 48, color: 'primary.main', mb: 2 }} />
            <Typography variant="h6" gutterBottom>
              {selectedFile ? selectedFile.name : 'Drop file here or click to browse'}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Supported formats: CSV, Excel (.xlsx, .xls)
            </Typography>
            <Typography variant="caption" color="text.secondary">
              Maximum file size: 10MB
            </Typography>
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv,.xlsx,.xls,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,text/csv"
              onChange={handleFileChange}
              style={{ display: 'none' }}
            />
          </Box>
        )}

        {/* Format Selection */}
        {selectedFile && !result && (
          <FormControl fullWidth sx={{ mb: 3 }}>
            <InputLabel>File Format</InputLabel>
            <Select
              value={format}
              onChange={(e) => setFormat(e.target.value)}
              label="File Format"
              disabled={uploading}
            >
              <MenuItem value="csv">CSV (Comma-Separated Values)</MenuItem>
              <MenuItem value="excel">Excel (.xlsx, .xls)</MenuItem>
            </Select>
          </FormControl>
        )}

        {/* Error Display */}
        {errors.length > 0 && (
          <Alert severity="error" sx={{ mb: 2 }}>
            <Typography variant="subtitle2" gutterBottom>
              Validation Errors:
            </Typography>
            <ul style={{ margin: 0, paddingLeft: 20 }}>
              {errors.map((error, index) => (
                <li key={index}>{error}</li>
              ))}
            </ul>
          </Alert>
        )}

        {/* Progress Indicator */}
        {uploading && (
          <ProgressIndicator
            progress={progress}
            message={progress < 100 ? 'Uploading and processing file...' : 'Finalizing import...'}
          />
        )}

        {/* Preview Table */}
        {preview && preview.rows.length > 0 && !result && !uploading && (
          <Box sx={{ mb: 2 }}>
            <Typography variant="subtitle1" gutterBottom>
              Preview (First 5 rows)
            </Typography>
            <TableContainer component={Paper} variant="outlined" sx={{ maxHeight: 300 }}>
              <Table size="small" stickyHeader>
                <TableHead>
                  <TableRow>
                    {preview.headers.map((header, index) => (
                      <TableCell key={index} sx={{ fontWeight: 'bold', backgroundColor: 'action.hover' }}>
                        {header}
                      </TableCell>
                    ))}
                  </TableRow>
                </TableHead>
                <TableBody>
                  {preview.rows.map((row, rowIndex) => (
                    <TableRow key={rowIndex}>
                      {preview.headers.map((header, colIndex) => (
                        <TableCell key={colIndex}>{row[header]}</TableCell>
                      ))}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          </Box>
        )}

        {/* Success Result */}
        {result && result.success && (
          <Box sx={{ textAlign: 'center', py: 3 }}>
            <CheckCircle sx={{ fontSize: 64, color: 'success.main', mb: 2 }} />
            <Typography variant="h5" gutterBottom>
              Import Successful!
            </Typography>
            <Box sx={{ display: 'flex', gap: 2, justifyContent: 'center', my: 3 }}>
              <Chip
                label={`${result.created} Created`}
                color="success"
                variant="outlined"
              />
              {result.updated > 0 && (
                <Chip
                  label={`${result.updated} Updated`}
                  color="info"
                  variant="outlined"
                />
              )}
            </Box>
            {result.errors && result.errors.length > 0 && (
              <Alert severity="warning" sx={{ mt: 2 }}>
                <Typography variant="subtitle2" gutterBottom>
                  {result.errors.length} row(s) had issues:
                </Typography>
                <ul style={{ margin: 0, paddingLeft: 20, textAlign: 'left' }}>
                  {result.errors.slice(0, 5).map((error, index) => (
                    <li key={index}>{error}</li>
                  ))}
                  {result.errors.length > 5 && (
                    <li>...and {result.errors.length - 5} more</li>
                  )}
                </ul>
              </Alert>
            )}
          </Box>
        )}
      </DialogContent>

      <DialogActions sx={{ px: 3, py: 2 }}>
        {!result ? (
          <>
            <Button onClick={handleReset} disabled={uploading}>
              Clear
            </Button>
            <Button onClick={handleClose} disabled={uploading}>
              Cancel
            </Button>
            <Button
              onClick={handleUpload}
              variant="contained"
              disabled={!selectedFile || uploading || errors.length > 0}
              startIcon={<CloudUpload />}
            >
              {uploading ? 'Uploading...' : 'Import'}
            </Button>
          </>
        ) : (
          <Button onClick={handleClose} variant="contained">
            Done
          </Button>
        )}
      </DialogActions>
    </Dialog>
  );
};

ImportDialog.propTypes = {
  open: PropTypes.bool.isRequired,
  onClose: PropTypes.func.isRequired,
  onImport: PropTypes.func
};

export default ImportDialog;
