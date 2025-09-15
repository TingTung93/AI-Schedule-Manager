import React from 'react';
import { motion } from 'framer-motion';
import { Box, Typography } from '@mui/material';
import RuleInput from '../components/RuleInput';

const RulesPage = () => {
  return (
    <Box sx={{ p: 3 }}>
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
      >
        <Box mb={4}>
          <Typography variant="h4" fontWeight="bold" gutterBottom>
            Business Rules Management
          </Typography>
          <Typography variant="body1" color="textSecondary">
            Configure scheduling rules and constraints for your organization
          </Typography>
        </Box>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.1 }}
      >
        <RuleInput />
      </motion.div>
    </Box>
  );
};

export default RulesPage;