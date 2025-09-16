import React, { memo, useMemo, useCallback, useState, useEffect } from 'react';
import { FixedSizeList as List } from 'react-window';
import { Box, TextField, CircularProgress } from '@mui/material';

// Virtual scrolling component for large datasets
const VirtualizedList = memo(({ 
  items = [], 
  height = 400, 
  itemHeight = 50, 
  renderItem, 
  searchable = false,
  loading = false,
  loadMore,
  hasNextPage = false,
  ...props 
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  
  // Memoized filtered items
  const filteredItems = useMemo(() => {
    if (!searchable || !searchTerm) return items;
    return items.filter(item => 
      JSON.stringify(item).toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [items, searchTerm, searchable]);

  // Debounced search
  const handleSearch = useCallback(
    debounce((value) => setSearchTerm(value), 300),
    []
  );

  // Load more when near end
  const handleItemsRendered = useCallback(({ visibleStopIndex }) => {
    if (
      hasNextPage &&
      !loading &&
      loadMore &&
      visibleStopIndex > filteredItems.length - 5
    ) {
      loadMore();
    }
  }, [hasNextPage, loading, loadMore, filteredItems.length]);

  const Row = useCallback(({ index, style }) => {
    const item = filteredItems[index];
    if (!item) return null;
    
    return (
      <div style={style}>
        {renderItem(item, index)}
      </div>
    );
  }, [filteredItems, renderItem]);

  return (
    <Box {...props}>
      {searchable && (
        <TextField
          fullWidth
          placeholder="Search..."
          onChange={(e) => handleSearch(e.target.value)}
          sx={{ mb: 2 }}
        />
      )}
      
      <List
        height={height}
        itemCount={filteredItems.length}
        itemSize={itemHeight}
        onItemsRendered={handleItemsRendered}
      >
        {Row}
      </List>
      
      {loading && (
        <Box display="flex" justifyContent="center" mt={2}>
          <CircularProgress size={24} />
        </Box>
      )}
    </Box>
  );
});

// Debounce utility
function debounce(func, wait) {
  let timeout;
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
}

VirtualizedList.displayName = 'VirtualizedList';

export default VirtualizedList;
