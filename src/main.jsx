import React from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App.jsx';
import './style.css';

const basename = import.meta.env.BASE_URL.replace(/\/$/, '');
const redirect = new URLSearchParams(window.location.search).get('p');
if (redirect?.startsWith('/')) {
  window.history.replaceState(null, '', `${basename}${redirect}`);
}

createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter basename={basename}>
      <App />
    </BrowserRouter>
  </React.StrictMode>
);
