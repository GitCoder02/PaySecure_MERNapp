import React, { useState } from 'react';
import { TextField, Button, Typography, Container, Box } from '@mui/material';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';

const RegisterForm = () => {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [upiId, setUpiId] = useState('');
  const [upiPin, setUpiPin] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    try {
      const res = await axios.post('http://localhost:5000/api/auth/register', {
        name,
        email,
        password,
        upiId,
        pin: upiPin, // backend expects "pin"
      });

      setSuccess(res.data.message);
      setTimeout(() => navigate('/login'), 2000); // redirect after 2s
    } catch (err) {
      setError(err.response?.data?.message || 'Registration failed');
    }
  };

  return (
    <Container maxWidth="sm">
      <Box sx={{ mt: 10, p: 4, boxShadow: 3, borderRadius: 2 }}>
        <Typography variant="h4" align="center" gutterBottom>
          Register
        </Typography>

        {error && <Typography color="error">{error}</Typography>}
        {success && <Typography color="primary">{success}</Typography>}

        <form onSubmit={handleSubmit}>
          <TextField
            label="Name"
            fullWidth
            margin="normal"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
          />
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
          <TextField
            label="UPI ID"
            type="text"
            fullWidth
            margin="normal"
            value={upiId}
            onChange={(e) => setUpiId(e.target.value)}
            required
          />
          <TextField
            label="UPI PIN"
            type="password"
            fullWidth
            margin="normal"
            value={upiPin}
            onChange={(e) => setUpiPin(e.target.value)}
            inputProps={{ maxLength: 4 }}
            required
          />

          <Button
            type="submit"
            variant="contained"
            color="primary"
            fullWidth
            sx={{ mt: 2 }}
          >
            Register
          </Button>

          {/* 👇 Go to Login Button */}
          <Button
            variant="outlined"
            color="secondary"
            fullWidth
            sx={{ mt: 2 }}
            onClick={() => navigate('/login')}
          >
            Go to Login
          </Button>
        </form>
      </Box>
    </Container>
  );
};

export default RegisterForm;