import React from 'react';
import ReactDOM from 'react-dom/client';
import { AnnaApp } from './AnnaApp';
import '../index.css';

const root = document.getElementById('root');
if (!root) throw new Error('Anna tutoring root element is missing');

ReactDOM.createRoot(root).render(
  <React.StrictMode>
    <AnnaApp />
  </React.StrictMode>,
);
