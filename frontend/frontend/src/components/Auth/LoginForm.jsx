import React, { useState, useContext } from 'react';
import { TextField, Button, Typography, Container, Box } from '@mui/material';
import axios from 'axios';
import { AuthContext } from '../../context/AuthContext';
import { useNavigate } from 'react-router-dom';

const LoginForm = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const { setToken } = useContext(AuthContext);
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    try {
      const res = await axios.post('http://localhost:5000/api/auth/login', {
        email,
        password,
      });

      setToken(res.data.token); // store token in AuthContext
      navigate('/dashboard'); // redirect to protected dashboard
    } catch (err) {
      setError(err.response?.data?.message || 'Login failed');
    }
  };

  return (
    <Container maxWidth="sm">
      <Box sx={{ mt: 10, p: 4, boxShadow: 3, borderRadius: 2 }}>
        <Typography variant="h4" align="center" gutterBottom>
          Login
        </Typography>

        {error && <Typography color="error">{error}</Typography>}

        <form onSubmit={handleSubmit}>
          <TextField
            label="Email"
            type="email"
            fullWidth
            margin="normal"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
          <TextField
            label="Password"
            type="password"
            fullWidth
            margin="normal"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />

          <Button
            type="submit"
            variant="contained"
            color="primary"
            fullWidth
            sx={{ mt: 2 }}
          >
            Login
          </Button>
        </form>

        {/* Register redirect button */}
        <Typography align="center" sx={{ mt: 2 }}>
          Don’t have an account?
        </Typography>
        <Button
          variant="outlined"
          color="secondary"
          fullWidth
          sx={{ mt: 1 }}
          onClick={() => navigate('/register')}
        >
          Register
        </Button>
      </Box>
    </Container>
  );
};

export default LoginForm;