import React from 'react';
import { ToastContainer, toast, Slide } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';

// Module-level toast utilities
export const notifySuccess = (message) => toast.success(message, {
  position: 'top-right',
  autoClose: 4000,
  hideProgressBar: true,
  closeOnClick: true,
  pauseOnHover: true,
  draggable: true,
  theme: 'colored',
});

export const notifyError = (message) => toast.error(message, {
  position: 'top-right',
  autoClose: 5000,
  hideProgressBar: true,
  closeOnClick: true,
  pauseOnHover: true,
  draggable: true,
  theme: 'colored',
});

export const notifyInfo = (message) => toast.info(message, {
  position: 'top-right',
  autoClose: 4000,
  hideProgressBar: true,
  closeOnClick: true,
  pauseOnHover: true,
  draggable: true,
  theme: 'colored',
});

export { toast };

// ToastContainer wrapper (required for rendering)
export const ToastProvider = ({ children }) => (
  <>
    {children}
    <ToastContainer
      position="top-right"
      autoClose={4000}
      hideProgressBar={true}
      newestOnTop
      closeOnClick
      rtl={false}
      pauseOnFocusLoss
      draggable
      pauseOnHover
      theme="colored"
      transition={Slide}
      style={{
        fontFamily: 'system-ui, -apple-system, sans-serif',
        maxWidth: '400px',
      }}
      toastClassName="tp-toast"
    />
  </>
);

