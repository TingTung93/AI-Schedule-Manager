import React from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  Box,
  Typography,
  Button,
  Container,
  Paper
} from '@mui/material';
import {
  Home,
  ArrowBack
} from '@mui/icons-material';

const NotFoundPage = () => {
  const navigate = useNavigate();

  return (
    <Container maxWidth="sm">
      <Box
        sx={{
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          p: 3
        }}
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.5 }}
        >
          <Paper
            sx={{
              p: 6,
              textAlign: 'center',
              borderRadius: 4,
              boxShadow: 3
            }}
          >
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ delay: 0.2, type: "spring", stiffness: 200 }}
            >
              <Typography
                variant="h1"
                sx={{
                  fontSize: '8rem',
                  fontWeight: 'bold',
                  background: 'linear-gradient(45deg, #1976d2, #42a5f5)',
                  backgroundClip: 'text',
                  WebkitBackgroundClip: 'text',
                  WebkitTextFillColor: 'transparent',
                  mb: 2
                }}
              >
                404
              </Typography>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4, duration: 0.5 }}
            >
              <Typography variant="h4" gutterBottom fontWeight="bold">
                Page Not Found
              </Typography>
              <Typography variant="body1" color="textSecondary" paragraph>
                The page you're looking for doesn't exist or has been moved.
                Let's get you back on track!
              </Typography>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.6, duration: 0.5 }}
            >
              <Box sx={{ mt: 4, display: 'flex', gap: 2, justifyContent: 'center' }}>
                <Button
                  variant="contained"
                  startIcon={<Home />}
                  onClick={() => navigate('/dashboard')}
                  size="large"
                >
                  Go Home
                </Button>
                <Button
                  variant="outlined"
                  startIcon={<ArrowBack />}
                  onClick={() => navigate(-1)}
                  size="large"
                >
                  Go Back
                </Button>
              </Box>
            </motion.div>
          </Paper>
        </motion.div>
      </Box>
    </Container>
  );
};

export default NotFoundPage;