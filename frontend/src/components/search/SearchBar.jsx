import { useState, useCallback } from 'react';
import { TextField, InputAdornment, IconButton } from '@mui/material';
import { Search, Clear } from '@mui/icons-material';
import { debounce } from 'lodash';

const SearchBar = ({ onSearch, placeholder = 'Search...', debounceMs = 300 }) => {
  const [value, setValue] = useState('');

  const debouncedSearch = useCallback(
    debounce((searchTerm) => {
      onSearch(searchTerm);
    }, debounceMs),
    [onSearch, debounceMs]
  );

  const handleChange = (e) => {
    const newValue = e.target.value;
    setValue(newValue);
    debouncedSearch(newValue);
  };

  const handleClear = () => {
    setValue('');
    onSearch('');
  };

  return (
    <TextField
      fullWidth
      value={value}
      onChange={handleChange}
      placeholder={placeholder}
      InputProps={{
        startAdornment: (
          <InputAdornment position="start">
            <Search />
          </InputAdornment>
        ),
        endAdornment: value && (
          <InputAdornment position="end">
            <IconButton onClick={handleClear} size="small" aria-label="Clear search">
              <Clear />
            </IconButton>
          </InputAdornment>
        )
      }}
      sx={{ mb: 2 }}
    />
  );
};

export default SearchBar;
